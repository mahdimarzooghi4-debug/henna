import { BuyerCommerceError,commerceId,type BuyerIncident,type BuyerIncidentOrder,type BuyerEvidence } from "../../../packages/buyer-commerce/contracts.ts";
import { mobileCommerceIntent,type MobileCommerceClient,type MobileCommerceIntent } from "./mobile-commerce.ts";
import type {
 MobilePendingCommerceStore,PendingIncidentContext,
} from "./pending-commerce.ts";
export type IncidentPhoto={uri:string;base64:string};
export type IncidentDraft={itemId:string;type:"DAMAGED_ITEM"|"MISSING_ITEM";quantity:number;photo:IncidentPhoto|null};
export type NativeIncidentsState={order:BuyerIncidentOrder|null;incidents:BuyerIncident[]|null;page:number;busy:boolean;error:BuyerCommerceError|null;intent:MobileCommerceIntent|null;draft:IncidentDraft;returnConsent:string|null;message:string};
const blankDraft=():IncidentDraft=>({itemId:"",type:"DAMAGED_ITEM",quantity:1,photo:null});
export const initialNativeIncidentsState=():NativeIncidentsState=>({order:null,incidents:null,page:1,busy:false,error:null,intent:null,draft:blankDraft(),returnConsent:null,message:""});
export function reportWindowOpen(order:BuyerIncidentOrder|null,now:number){return !!order&&order.state==="COLLECTED"&&!!order.receivedAtUtc&&now>=Date.parse(order.receivedAtUtc)&&now<=Date.parse(order.receivedAtUtc)+3600000;}
export function evidencePhotoValid(photo:IncidentPhoto|null){if(!photo||!photo.uri||typeof photo.base64!=="string"||!/^\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(photo.base64)||photo.base64.length%4!==0)return false;const bytes=photo.base64.length/4*3-(photo.base64.endsWith("==")?2:photo.base64.endsWith("=")?1:0);return bytes>=12&&bytes<=40000;}
export class NativeIncidentsController {
 private active=false;private epoch=0;private locked=false;private state=initialNativeIncidentsState();private snapshot:IncidentDraft|null=null;
 private api:MobileCommerceClient;private uuid:()=>string;private notify:(s:NativeIncidentsState)=>void;private orderId:string|null;private now:()=>number;private pending?:MobilePendingCommerceStore;
 constructor(api:MobileCommerceClient,uuid:()=>string,notify:(s:NativeIncidentsState)=>void,orderId:string|null,now=Date.now,pending?:MobilePendingCommerceStore){this.api=api;this.uuid=uuid;this.notify=notify;this.orderId=commerceId(orderId)?orderId:null;this.now=now;this.pending=pending;}
 private emit(p:Partial<NativeIncidentsState>){this.state={...this.state,...p};if(this.active)this.notify(this.state);}
 start(){this.active=true;if(this.pending)void this.resume();else void this.refresh();}stop(){this.active=false;this.epoch++;}
 private context():PendingIncidentContext|null{
  const d=this.snapshot;
  return d?.photo&&this.orderId?{orderId:this.orderId,itemId:d.itemId,
   type:d.type,quantity:d.quantity,photoUri:d.photo.uri}:null;
 }
 private async resume(){
  try{
   const restored=await this.pending?.restore("incidents");
   if(!restored){await this.refresh();return;}
   if(restored.incident){
    this.orderId=restored.incident.orderId;
    let base64="";
    if(restored.intent.path==="evidence"){
     const body=JSON.parse(restored.intent.body) as Record<string,unknown>;
     if(typeof body.contentBase64!=="string")throw Error();
     base64=body.contentBase64;
    }
    this.snapshot={itemId:restored.incident.itemId,type:restored.incident.type,
     quantity:restored.incident.quantity,
     photo:{uri:restored.incident.photoUri,base64}};
   }
   const [incidents,order]=await Promise.all([
    this.api.incidents(this.state.page),
    this.orderId?this.api.incidentOrder(this.orderId):Promise.resolve(null),
   ]);
   if(order&&order.id!==this.orderId)throw new BuyerCommerceError(503);
   if(this.active)this.emit({incidents,order,intent:restored.intent,
    ...(this.snapshot?{draft:this.snapshot}:{}),
    message:"درخواست گزارش/مرجوعیِ تأییدنشده از اجرای قبلی بازیابی شد."});
  }catch{
   if(this.active)this.emit({error:new BuyerCommerceError(503),
    message:"بازیابی امن درخواست قبلی انجام نشد؛ فرمان تازه‌ای ارسال نمی‌شود."});
  }
 }
 async refresh(){if(this.locked||this.state.intent)return;const epoch=++this.epoch;this.emit({busy:true,error:null,order:null,incidents:null,returnConsent:null});try{const [incidents,order]=await Promise.all([this.api.incidents(this.state.page),this.orderId?this.api.incidentOrder(this.orderId):Promise.resolve(null)]);if(order&&order.id!==this.orderId)throw new BuyerCommerceError(503);if(this.active&&epoch===this.epoch)this.emit({incidents,order});}catch(e){if(this.active&&epoch===this.epoch){const error=e instanceof BuyerCommerceError?e:new BuyerCommerceError(503);this.emit({error,...(error.status===401?{draft:blankDraft()}: {})});}}finally{if(this.active&&epoch===this.epoch)this.emit({busy:false});}}
 edit(p:Partial<IncidentDraft>){if(!this.locked&&!this.state.busy&&!this.state.intent){
  const old=this.state.draft.photo;
  if(p.photo!==undefined&&old&&p.photo?.uri!==old.uri)
   void this.pending?.discardPhoto(old.uri).catch(()=>{});
  this.emit({draft:{...this.state.draft,...p},message:""});
 }}
 consent(id:string|null){if(!this.locked&&!this.state.busy&&!this.state.intent&&(id===null||this.state.incidents?.some(i=>i.id===id&&i.state==="AWAITING_RETURN")))this.emit({returnConsent:id});}
 async page(delta:1|-1){if(this.locked||this.state.busy||this.state.intent||!this.state.incidents||delta===1&&this.state.incidents.length<20)return;const page=this.state.page+delta;if(page<1||page>10000)return;this.emit({page});await this.refresh();}
 canReport(){const s=this.state,d=s.draft,item=s.order?.incidentItems.find(i=>i.id===d.itemId);return !s.busy&&!s.intent&&!s.error&&reportWindowOpen(s.order,this.now())&&!!item&&Number.isInteger(d.quantity)&&d.quantity>=1&&d.quantity<=item.quantity-item.refundedQuantity&&["DAMAGED_ITEM","MISSING_ITEM"].includes(d.type)&&evidencePhotoValid(d.photo);}
 async report(){if(this.locked||!this.canReport())return;const d=this.state.draft;this.snapshot={...d,photo:d.photo?{...d.photo}:null};this.emit({intent:mobileCommerceIntent("evidence",{contentType:"image/jpeg",contentBase64:d.photo!.base64},this.uuid())});await this.retry();}
 async confirmReturn(id:string){if(this.locked||this.state.busy||this.state.intent||this.state.error||this.state.returnConsent!==id||!this.state.incidents?.some(i=>i.id===id&&i.state==="AWAITING_RETURN"))return;this.emit({intent:mobileCommerceIntent(`item-returns/${id}/confirm-collection`,{},this.uuid())});await this.retry();}
 async retry(){if(this.locked||this.state.busy||!this.state.intent)return;
  const intent=this.state.intent;
  if(intent.path==="evidence"&&(!this.snapshot||!this.orderId||!this.state.order)){
   await this.resume();return;
  }
  if(intent.path==="evidence"&&!reportWindowOpen(this.state.order,this.now())){
   try{await this.pending?.clear(intent.key);}catch{}
   this.snapshot=null;this.emit({intent:null,draft:blankDraft(),
    message:"مهلت ثبت گزارش پایان یافته است؛ عکس محلی پاک شد و درخواست تازه‌ای ارسال نشد."});return;
  }
  this.locked=true;const epoch=++this.epoch;this.emit({busy:true,message:"",error:null});let next=false,reload=false;
  try{
   await this.pending?.save("incidents",intent,this.context());
   const result=await this.api.post<BuyerEvidence|BuyerIncident>(intent);
   if(!this.active||epoch!==this.epoch)return;
   if(intent.path==="evidence"){
    const d=this.snapshot;
    if(!d||!this.orderId||!reportWindowOpen(this.state.order,this.now())){
     try{await this.pending?.clear(intent.key);}catch{}
     this.emit({intent:null,draft:blankDraft(),
      message:"عکس ذخیره شد، اما مهلت ثبت گزارش پایان یافته است."});
     this.snapshot=null;return;
    }
    const follow=mobileCommerceIntent(`orders/${this.orderId}/incidents`,
     {orderItemId:d.itemId,type:d.type,quantity:d.quantity,
      evidenceId:(result as BuyerEvidence).evidenceId},this.uuid());
    if(this.pending)await this.pending.advance(intent.key,"incidents",follow,this.context());
    this.emit({intent:follow});next=true;
   }else{
    try{await this.pending?.clear(intent.key);}catch{}
    this.snapshot=null;this.emit({intent:null,draft:blankDraft(),returnConsent:null,
     message:intent.path.startsWith("orders/")?"گزارش ثبت شد و منتظر بررسی پشتیبانی است.":"تحویل کالای مرجوعی در سرور تأیید شد."});reload=true;
   }
  }catch(e){
   const error=e instanceof BuyerCommerceError?e:new BuyerCommerceError(503);
   if(error.status!==503)try{await this.pending?.clear(intent.key);}catch{}
   if(this.active&&epoch===this.epoch){
    const photoReset=error.status!==503&&intent.path==="evidence"
     ?{draft:{...this.state.draft,photo:null}}:{};
    this.emit({message:error.message,returnConsent:null,
     ...(error.status!==503?{intent:null}:{}),...photoReset,
     ...(error.status===401?{error,order:null,incidents:null,draft:blankDraft()}: {})});
    if(error.status!==503)this.snapshot=null;reload=error.status===409;
   }
  }finally{this.locked=false;if(this.active&&epoch===this.epoch){this.emit({busy:false});if(next)await this.retry();else if(reload)await this.refresh();}}
 }
}
