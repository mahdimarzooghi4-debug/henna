import { BuyerCommerceError, commerceId, type BuyerOrder } from "../../../packages/buyer-commerce/contracts.ts";
import { mobileCommerceIntent, type MobileCommerceClient, type MobileCommerceIntent } from "./mobile-commerce.ts";
import type { MobilePendingCommerceStore } from "./pending-commerce.ts";
export type NativeOrdersState={page:number;selectedId:string|null;orders:BuyerOrder[]|null;order:BuyerOrder|null;busy:boolean;error:BuyerCommerceError|null;intent:MobileCommerceIntent|null;received:boolean;message:string};
export const initialNativeOrdersState=(selectedId:string|null=null):NativeOrdersState=>({page:1,selectedId:commerceId(selectedId??"")?selectedId:null,orders:null,order:null,busy:false,error:null,intent:null,received:false,message:""});
export class NativeOrdersController {
 private active=false;private epoch=0;private locked=false;private state:NativeOrdersState;
 private api:MobileCommerceClient;private uuid:()=>string;private notify:(s:NativeOrdersState)=>void;private pending?:MobilePendingCommerceStore;
 constructor(api:MobileCommerceClient,uuid:()=>string,notify:(s:NativeOrdersState)=>void,selectedId:string|null=null,pending?:MobilePendingCommerceStore){this.api=api;this.uuid=uuid;this.notify=notify;this.state=initialNativeOrdersState(selectedId);this.pending=pending;}
 private emit(p:Partial<NativeOrdersState>){this.state={...this.state,...p};if(this.active)this.notify(this.state);}
 start(){this.active=true;if(this.pending)void this.resume();else void this.refresh();}stop(){this.active=false;this.epoch++;}
 private async resume(){
  try{
   const restored=await this.pending?.restore("orders");
   if(restored){
    const match=/^orders\/([0-9a-f-]+)\//i.exec(restored.intent.path);
    this.emit({intent:restored.intent,
      selectedId:match&&commerceId(match[1])?match[1].toLowerCase():this.state.selectedId,
      message:"درخواست سفارشِ تأییدنشده از اجرای قبلی بازیابی شد."});
    return;
   }
   await this.refresh();
  }catch{
   if(this.active)this.emit({error:new BuyerCommerceError(503),message:"بازیابی امن درخواست قبلی انجام نشد؛ فرمان تازه‌ای ارسال نمی‌شود."});
  }
 }
 async refresh(){if(this.locked||this.state.intent)return;const epoch=++this.epoch;const {selectedId,page}=this.state;this.emit({busy:true,error:null,orders:null,order:null,received:false});try{const result=selectedId?await this.api.order(selectedId):await this.api.orders(page);if(this.active&&epoch===this.epoch)this.emit(selectedId?{order:result as BuyerOrder}:{orders:result as BuyerOrder[]});}catch(e){if(this.active&&epoch===this.epoch)this.emit({error:e instanceof BuyerCommerceError?e:new BuyerCommerceError(503)});}finally{if(this.active&&epoch===this.epoch)this.emit({busy:false});}}
 async open(id:string|null){if(this.state.busy||this.state.intent||this.locked||id!==null&&!commerceId(id))return;this.emit({selectedId:id,message:""});await this.refresh();}
 async page(delta:1|-1){if(this.state.busy||this.state.intent||this.locked||this.state.selectedId||!this.state.orders||delta===1&&this.state.orders.length<20)return;const page=this.state.page+delta;if(page<1||page>10000)return;this.emit({page,message:""});await this.refresh();}
 consent(received:boolean){if(!this.state.busy&&!this.state.intent&&!this.locked&&this.state.order?.state==="READY_FOR_PICKUP")this.emit({received});}
 async change(action:"cancel"|"pickup-confirmation"){const s=this.state,o=s.order;if(!o||s.busy||s.intent||this.locked||s.error)return;if(action==="cancel"&&!["PAID","PREPARING","READY_FOR_PICKUP"].includes(o.state))return;if(action==="pickup-confirmation"&&(o.state!=="READY_FOR_PICKUP"||!s.received))return;this.emit({intent:mobileCommerceIntent(`orders/${o.id}/${action}`,{expectedVersion:o.version},this.uuid())});await this.retry();}
 async retry(){if(this.locked||this.state.busy||!this.state.intent)return;this.locked=true;const epoch=++this.epoch,intent=this.state.intent;this.emit({busy:true,error:null,message:""});let reload=false;try{
   await this.pending?.save("orders",intent);
   const order=await this.api.post<BuyerOrder>(intent);
   try{await this.pending?.clear(intent.key);}catch{}
   if(this.active&&epoch===this.epoch)this.emit({order,intent:null,received:false,message:order.state==="CANCELLED"?"لغو سفارش در سرور تأیید شد.":"دریافت سفارش در سرور تأیید شد."});
  }catch(e){
   const error=e instanceof BuyerCommerceError?e:new BuyerCommerceError(503);
   if(error.status!==503)try{await this.pending?.clear(intent.key);}catch{}
   if(this.active&&epoch===this.epoch){this.emit({message:error.message,received:false,...(error.status!==503?{intent:null}:{}),...(error.status===401?{error,orders:null,order:null}: {})});reload=error.status===409;}
  }finally{this.locked=false;if(this.active&&epoch===this.epoch){this.emit({busy:false});if(reload)await this.refresh();}}}
}
