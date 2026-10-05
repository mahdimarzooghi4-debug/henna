import {
  BuyerCommerceError,
  commerceId,
  type BuyerWallet,
  type BuyerWithdrawal,
} from "../../../packages/buyer-commerce/contracts.ts";
import {
  mobileCommerceIntent,
  type MobileCommerceClient,
  type MobileCommerceIntent,
} from "./mobile-commerce.ts";
import type { MobilePendingCommerceStore } from "./pending-commerce.ts";

export type WalletDraft={
  amountRial:string;
  ibanVerificationRequestReference:string;
};
export type NativeWalletState={
  wallet:BuyerWallet|null;
  withdrawals:BuyerWithdrawal[]|null;
  page:number;
  busy:boolean;
  error:BuyerCommerceError|null;
  intent:MobileCommerceIntent|null;
  draft:WalletDraft;
  message:string;
};
const blank=():WalletDraft=>({
  amountRial:"",
  ibanVerificationRequestReference:"",
});
export const initialNativeWalletState=():NativeWalletState=>({
  wallet:null,withdrawals:null,page:1,busy:false,error:null,
  intent:null,draft:blank(),message:"",
});

export class NativeWalletController{
  private active=false;
  private locked=false;
  private epoch=0;
  private state=initialNativeWalletState();
  private api:MobileCommerceClient;
  private uuid:()=>string;
  private notify:(state:NativeWalletState)=>void;
  private pending?:MobilePendingCommerceStore;

  constructor(
    api:MobileCommerceClient,
    uuid:()=>string,
    notify:(state:NativeWalletState)=>void,
    pending?:MobilePendingCommerceStore,
  ){
    this.api=api;this.uuid=uuid;this.notify=notify;this.pending=pending;
  }
  private emit(patch:Partial<NativeWalletState>){
    this.state={...this.state,...patch};
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
      const restored=await this.pending?.restore("wallet");
      if(restored){
        let draft=this.state.draft;
        if(restored.intent.path==="withdrawals"){
          const body=JSON.parse(restored.intent.body) as Record<string,unknown>;
          if(typeof body.amountRial!=="number"||
             typeof body.ibanVerificationRequestReference!=="string")throw Error();
          draft={
            amountRial:String(body.amountRial),
            ibanVerificationRequestReference:
              body.ibanVerificationRequestReference,
          };
        }
        this.emit({
          intent:restored.intent,draft,
          message:"درخواست برداشتِ تأییدنشده از اجرای قبلی بازیابی شد.",
        });
      }
      await this.load();
    }catch{
      if(this.active)this.emit({
        error:new BuyerCommerceError(503),
        message:"بازیابی امن عملیات مالی قبلی انجام نشد؛ برداشت تازه‌ای ارسال نمی‌شود.",
      });
    }
  }

  private async load(){
    const epoch=++this.epoch;
    this.emit({busy:true,error:null});
    try{
      const [wallet,withdrawals]=await Promise.all([
        this.api.wallet(),
        this.api.withdrawals(this.state.page),
      ]);
      if(this.active&&epoch===this.epoch)
        this.emit({wallet,withdrawals});
    }catch(error){
      if(this.active&&epoch===this.epoch){
        const normalized=error instanceof BuyerCommerceError
          ?error:new BuyerCommerceError(503);
        this.emit({
          error:normalized,
          ...(normalized.status===401
            ?{wallet:null,withdrawals:null,draft:blank()}:{})
        });
      }
    }finally{
      if(this.active&&epoch===this.epoch)this.emit({busy:false});
    }
  }

  async refresh(){
    if(this.locked||this.state.intent)return;
    await this.load();
  }

  edit(patch:Partial<WalletDraft>){
    if(this.locked||this.state.busy||this.state.intent)return;
    this.emit({draft:{...this.state.draft,...patch},message:""});
  }

  canRequest(){
    const amount=this.state.draft.amountRial;
    const reference=this.state.draft.ibanVerificationRequestReference.trim();
    return !this.state.busy&&!this.state.intent&&!this.state.error&&
      /^[0-9]{1,15}$/.test(amount)&&Number(amount)>0&&
      reference.length>0&&reference.length<=240;
  }

  async request(){
    if(this.locked||!this.canRequest())return;
    this.emit({intent:mobileCommerceIntent("withdrawals",{
      amountRial:Number(this.state.draft.amountRial),
      ibanVerificationRequestReference:
        this.state.draft.ibanVerificationRequestReference.trim(),
    },this.uuid())});
    await this.retry();
  }

  async cancel(id:string){
    if(this.locked||this.state.busy||this.state.intent||!commerceId(id)||
       !this.state.withdrawals?.some(item=>
         item.id===id&&item.state==="OWNERSHIP_VERIFICATION_PENDING"))return;
    this.emit({intent:mobileCommerceIntent(
      `withdrawals/${id}/cancel`,{},this.uuid())});
    await this.retry();
  }

  async retry(){
    if(this.locked||this.state.busy||!this.state.intent)return;
    this.locked=true;
    const epoch=++this.epoch,intent=this.state.intent;
    this.emit({busy:true,error:null,message:""});
    let reload=false;
    try{
      await this.pending?.save("wallet",intent);
      await this.api.post<BuyerWithdrawal>(intent);
      try{await this.pending?.clear(intent.key);}catch{}
      if(this.active&&epoch===this.epoch){
        this.emit({
          intent:null,
          ...(intent.path==="withdrawals"?{draft:blank()}:{}),
          message:intent.path==="withdrawals"
            ?"درخواست برداشت ثبت شد و مبلغ در hold قرار گرفت؛ انتقال بانکی انجام نشده است."
            :"درخواست برداشت لغو شد و مبلغ به کیف پول برگشت.",
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
            ?"نتیجه عملیات مالی قطعی نیست؛ همان درخواست را برای تکرار امن دوباره بزنید."
            :normalized.message,
          ...(normalized.status!==503?{intent:null}:{}),
          ...(normalized.status===401
            ?{error:normalized,wallet:null,withdrawals:null}:{})
        });
        reload=normalized.status===409;
      }
    }finally{
      this.locked=false;
      if(this.active&&epoch===this.epoch){
        this.emit({busy:false});
        if(reload)await this.load();
      }
    }
  }

  async page(delta:1|-1){
    if(this.locked||this.state.busy||this.state.intent||
       !this.state.withdrawals||
       delta===1&&this.state.withdrawals.length<20)return;
    const page=this.state.page+delta;
    if(page<1||page>10000)return;
    this.emit({page});
    await this.load();
  }
}
