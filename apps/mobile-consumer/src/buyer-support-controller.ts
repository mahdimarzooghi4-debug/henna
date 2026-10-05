import {
  BuyerCommerceError,
  commerceId,
  type BuyerNotification,
  type BuyerTicket,
} from "../../../packages/buyer-commerce/contracts.ts";
import {
  mobileCommerceIntent,
  type MobileCommerceClient,
  type MobileCommerceIntent,
} from "./mobile-commerce.ts";
import type { MobilePendingCommerceStore } from "./pending-commerce.ts";

export type BuyerSupportDraft = { subject:string; message:string };
export type NativeBuyerSupportState = {
  notifications:BuyerNotification[]|null;
  tickets:BuyerTicket[]|null;
  notificationPage:number;
  ticketPage:number;
  busy:boolean;
  error:BuyerCommerceError|null;
  intent:MobileCommerceIntent|null;
  draft:BuyerSupportDraft;
  message:string;
};
const blankDraft=():BuyerSupportDraft=>({subject:"",message:""});
export const initialNativeBuyerSupportState=():NativeBuyerSupportState=>({
  notifications:null,tickets:null,notificationPage:1,ticketPage:1,
  busy:false,error:null,intent:null,draft:blankDraft(),message:"",
});

export class NativeBuyerSupportController {
  private active=false;
  private epoch=0;
  private locked=false;
  private state=initialNativeBuyerSupportState();
  private api:MobileCommerceClient;
  private uuid:()=>string;
  private notify:(state:NativeBuyerSupportState)=>void;
  private pending?:MobilePendingCommerceStore;

  constructor(
    api:MobileCommerceClient,
    uuid:()=>string,
    notify:(state:NativeBuyerSupportState)=>void,
    pending?:MobilePendingCommerceStore,
  ){
    this.api=api;this.uuid=uuid;this.notify=notify;this.pending=pending;
  }

  private emit(partial:Partial<NativeBuyerSupportState>){
    this.state={...this.state,...partial};
    if(this.active)this.notify(this.state);
  }

  start(){
    this.active=true;
    if(this.pending)void this.resume();
    else void this.refresh();
  }
  stop(){this.active=false;this.epoch++;}

  private async resume(){
    try{
      const restored=await this.pending?.restore("support");
      if(restored){
        let draft=this.state.draft;
        if(restored.intent.path==="tickets"){
          const body=JSON.parse(restored.intent.body) as Record<string,unknown>;
          if(typeof body.subject!=="string"||typeof body.message!=="string")
            throw Error();
          draft={subject:body.subject,message:body.message};
        }
        this.emit({
          intent:restored.intent,draft,
          message:"درخواست پشتیبانیِ تأییدنشده از اجرای قبلی بازیابی شد.",
        });
      }
      await this.loadLists();
    }catch{
      if(this.active)this.emit({
        error:new BuyerCommerceError(503),
        message:"بازیابی امن درخواست قبلی انجام نشد؛ فرمان تازه‌ای ارسال نمی‌شود.",
      });
    }
  }

  private async loadLists(){
    const epoch=++this.epoch;
    this.emit({busy:true,error:null});
    try{
      const [notifications,tickets]=await Promise.all([
        this.api.notifications(this.state.notificationPage),
        this.api.tickets(this.state.ticketPage),
      ]);
      if(this.active&&epoch===this.epoch)
        this.emit({notifications,tickets});
    }catch(error){
      if(this.active&&epoch===this.epoch){
        const normalized=error instanceof BuyerCommerceError
          ?error:new BuyerCommerceError(503);
        this.emit({
          error:normalized,
          ...(normalized.status===401
            ?{notifications:null,tickets:null,draft:blankDraft()}:{})
        });
      }
    }finally{
      if(this.active&&epoch===this.epoch)this.emit({busy:false});
    }
  }

  async refresh(){
    if(this.locked||this.state.intent)return;
    await this.loadLists();
  }

  edit(partial:Partial<BuyerSupportDraft>){
    if(this.locked||this.state.busy||this.state.intent)return;
    this.emit({draft:{...this.state.draft,...partial},message:""});
  }

  canOpenTicket(){
    const d=this.state.draft;
    return !this.state.busy&&!this.state.intent&&!this.state.error&&
      d.subject.trim().length>0&&d.subject.trim().length<=120&&
      d.message.trim().length>0&&d.message.trim().length<=2000;
  }

  async openTicket(){
    if(this.locked||!this.canOpenTicket())return;
    this.emit({intent:mobileCommerceIntent("tickets",{
      subject:this.state.draft.subject.trim(),
      message:this.state.draft.message.trim(),
    },this.uuid())});
    await this.retry();
  }

  async markRead(id:string){
    if(this.locked||this.state.busy||this.state.intent||
       !commerceId(id)||!this.state.notifications?.some(
         item=>item.id===id&&!item.read))return;
    this.emit({intent:mobileCommerceIntent(
      `notifications/${id}/read`,{},this.uuid())});
    await this.retry();
  }

  async retry(){
    if(this.locked||this.state.busy||!this.state.intent)return;
    this.locked=true;
    const epoch=++this.epoch,intent=this.state.intent;
    this.emit({busy:true,error:null,message:""});
    let reload=false;
    try{
      await this.pending?.save("support",intent);
      await this.api.post<BuyerTicket|BuyerNotification>(intent);
      try{await this.pending?.clear(intent.key);}catch{}
      if(this.active&&epoch===this.epoch){
        this.emit({
          intent:null,
          ...(intent.path==="tickets"?{draft:blankDraft()}:{}),
          message:intent.path==="tickets"
            ?"تیکت برای پشتیبانی حنا ثبت شد."
            :"اعلان به‌عنوان خوانده‌شده ثبت شد.",
        });
        reload=true;
      }
    }catch(error){
      const normalized=error instanceof BuyerCommerceError
        ?error:new BuyerCommerceError(503);
      if(normalized.status!==503)
        try{await this.pending?.clear(intent.key);}catch{}
      if(this.active&&epoch===this.epoch){
        this.emit({
          message:normalized.status===503
            ?"نتیجه درخواست قطعی نیست؛ همان اقدام را برای تکرار امن دوباره بزنید."
            :normalized.message,
          ...(normalized.status!==503?{intent:null}:{}),
          ...(normalized.status===401
            ?{error:normalized,notifications:null,tickets:null}:{})
        });
        reload=normalized.status===409;
      }
    }finally{
      this.locked=false;
      if(this.active&&epoch===this.epoch){
        this.emit({busy:false});
        if(reload)await this.loadLists();
      }
    }
  }

  async notificationPage(delta:1|-1){
    if(this.locked||this.state.busy||this.state.intent||
       !this.state.notifications||
       delta===1&&this.state.notifications.length<20)return;
    const page=this.state.notificationPage+delta;
    if(page<1||page>10000)return;
    this.emit({notificationPage:page});
    await this.loadLists();
  }

  async ticketPage(delta:1|-1){
    if(this.locked||this.state.busy||this.state.intent||
       !this.state.tickets||delta===1&&this.state.tickets.length<20)return;
    const page=this.state.ticketPage+delta;
    if(page<1||page>10000)return;
    this.emit({ticketPage:page});
    await this.loadLists();
  }
}
