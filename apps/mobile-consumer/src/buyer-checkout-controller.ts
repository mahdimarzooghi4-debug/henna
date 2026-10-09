import { BuyerCommerceError, commerceId, type BuyerCart, type BuyerComparison, type BuyerAddress, type BuyerCredit, type BuyerQuote, type BuyerOrder } from "../../../packages/buyer-commerce/contracts.ts";
import { mobileCommerceIntent, type MobileCommerceClient, type MobileCommerceIntent } from "./mobile-commerce.ts";
import type { MobileCatalogClient, CatalogProduct } from "./mobile-catalog.ts";
import type { MobilePendingCommerceStore } from "./pending-commerce.ts";
export type NativeCheckoutData={cart:BuyerCart;comparisons:BuyerComparison[];addresses:BuyerAddress[];credits:BuyerCredit[];balanceRial:number;products:Record<string,CatalogProduct>};
export type NativeCheckoutState={data:NativeCheckoutData|null;error:BuyerCommerceError|null;busy:boolean;intent:MobileCommerceIntent|null;sellerId:string;addressId:string;purchaseType:"PERSONAL"|"LEGAL";quote:BuyerQuote|null;creditId:string;disposition:""|"KEEP"|"REMOVE";confirmed:boolean;order:BuyerOrder|null;message:string};
export const initialNativeCheckoutState=():NativeCheckoutState=>({data:null,error:null,busy:false,intent:null,sellerId:"",addressId:"",purchaseType:"PERSONAL",quote:null,creditId:"",disposition:"",confirmed:false,order:null,message:""});
export function nativeCheckoutAmounts(s:NativeCheckoutState,now:number) {
 const q=s.quote;const credits=s.purchaseType==="PERSONAL"&&q&&s.data?s.data.credits.filter(c=>c.availableRial>0&&Date.parse(c.expiresAtUtc)>now&&q.items.every(i=>s.data!.products[i.productId]&&c.categoryIds.includes(s.data!.products[i.productId].categoryId))):[];
 const credit=q?Math.min(credits.find(c=>c.id===s.creditId)?.availableRial??0,q.itemsTotalRial):0;const cash=(q?.itemsTotalRial??0)-credit;
 return {credits,credit,cash,canPlace:!!q&&!q.used&&Date.parse(q.expiresAtUtc)>now&&!s.busy&&!s.intent&&!s.error&&!!s.data&&cash<=s.data.balanceRial&&!!s.disposition&&(!q.unavailable.length||s.confirmed)&&(!s.creditId||credits.some(c=>c.id===s.creditId))};
}
export class NativeCheckoutController {
 private active=false;private epoch=0;private locked=false;private state=initialNativeCheckoutState();
 private readonly api:MobileCommerceClient;private readonly catalog:MobileCatalogClient;private readonly uuid:()=>string;private readonly notify:(s:NativeCheckoutState)=>void;private readonly now:()=>number;private readonly pending?:MobilePendingCommerceStore;
 constructor(api:MobileCommerceClient,catalog:MobileCatalogClient,uuid:()=>string,notify:(s:NativeCheckoutState)=>void,now=Date.now,pending?:MobilePendingCommerceStore){this.api=api;this.catalog=catalog;this.uuid=uuid;this.notify=notify;this.now=now;this.pending=pending;}
 private emit(p:Partial<NativeCheckoutState>){this.state={...this.state,...p};if(this.active)this.notify(this.state);}
 start(){this.active=true;if(this.pending)void this.resume();else void this.refresh();}stop(){this.active=false;this.epoch++;}
 private async resume(){
  try{
   const restored=await this.pending?.restore("checkout");
   if(restored)this.emit({intent:restored.intent,message:"درخواست خریدِ تأییدنشده از اجرای قبلی بازیابی شد."});
   await this.refresh();
  }catch{
   if(this.active)this.emit({error:new BuyerCommerceError(503),message:"بازیابی امن درخواست قبلی انجام نشد؛ خرید تازه‌ای ارسال نمی‌شود."});
  }
 }
 async refresh(){if(this.locked)return;const epoch=++this.epoch;this.emit({data:null,error:null,busy:true,quote:null,confirmed:false,creditId:""});
  try {if(this.state.order){const order=await this.api.order(this.state.order.id);if(this.active&&epoch===this.epoch)this.emit({order});return;}
   const [cart,comparisons,addresses,credits,wallet]=await Promise.all([this.api.cart(),this.api.read<BuyerComparison[]>("comparison"),this.api.read<BuyerAddress[]>("addresses"),this.api.read<BuyerCredit[]>("credits"),this.api.read<{balanceRial:number}>("wallet")]);
   const products:Record<string,CatalogProduct>={};await Promise.all(cart.items.map(async i=>{const r=await this.catalog.detail(i.productId);if(r.status==="ok")products[i.productId]=r.data;}));
   if(this.active&&epoch===this.epoch)this.emit({data:{cart,comparisons,addresses,credits,balanceRial:wallet.balanceRial,products},sellerId:"",addressId:addresses[0]?.id??""});
  }catch(e){if(this.active&&epoch===this.epoch)this.emit({error:e instanceof BuyerCommerceError?e:new BuyerCommerceError(503),order:null});}finally{if(this.active&&epoch===this.epoch)this.emit({busy:false});}}
 choose(p:Partial<Pick<NativeCheckoutState,"sellerId"|"addressId"|"purchaseType">>){if(this.locked||this.state.busy||this.state.intent)return;
  if(p.sellerId!==undefined&&!this.state.data?.comparisons.some(c=>c.sellerId===p.sellerId))return;if(p.addressId!==undefined&&!this.state.data?.addresses.some(a=>a.id===p.addressId))return;
  if(p.purchaseType!==undefined&&!["PERSONAL","LEGAL"].includes(p.purchaseType))return;this.emit({...p,quote:null,creditId:"",confirmed:false,disposition:"",message:""});}
 review(p:Partial<Pick<NativeCheckoutState,"creditId"|"disposition"|"confirmed">>){if(!this.locked&&!this.state.busy&&!this.state.intent)this.emit(p);}
 async saveAddress(cityId:string,text:string,latitude:number,longitude:number){if(!commerceId(cityId)||!text.trim()||text.trim().length>1000||!Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isFinite(longitude)||Math.abs(longitude)>180)return;
  await this.begin("addresses",{addressId:this.uuid(),cityId,text:text.trim(),latitude,longitude});}
 async quote(){const s=this.state;if(!s.sellerId||!s.addressId||!s.data)return;await this.begin("quotes",{sellerId:s.sellerId,addressId:s.addressId,purchaseType:s.purchaseType,fulfillmentMode:"PICKUP"});}
 async place(){if(!nativeCheckoutAmounts(this.state,this.now()).canPlace)return;await this.begin("orders",{quoteId:this.state.quote!.id,creditGrantId:this.state.creditId||null,unavailableDisposition:this.state.disposition,confirmUnavailable:this.state.confirmed});}
 private async begin(path:string,input:object){if(this.locked||this.state.busy||this.state.intent||this.state.order)return;this.emit({intent:mobileCommerceIntent(path,input,this.uuid())});await this.retry();}
 async retry(){if(this.locked||this.state.busy||!this.state.intent)return;this.locked=true;const epoch=++this.epoch,intent=this.state.intent;this.emit({busy:true,message:""});
  try {
   await this.pending?.save("checkout",intent);
   const result=await this.api.post(intent);
   try{await this.pending?.clear(intent.key);}catch{}
   if(!this.active||epoch!==this.epoch)return;
   if(intent.path==="quotes"){const quote=result as BuyerQuote;this.emit({quote,creditId:"",confirmed:false,disposition:quote.unavailable.length?"":"KEEP",intent:null});}
   else if(intent.path==="orders")this.emit({order:result as BuyerOrder,intent:null,quote:null,message:"سفارش ثبت شد؛ مبلغ از موجودی حساب کسر شد."});
   else{const address=result as BuyerAddress;this.emit({data:this.state.data?{...this.state.data,addresses:[address,...this.state.data.addresses.filter(a=>a.id!==address.id)]}:null,addressId:address.id,intent:null,quote:null,message:"نشانی ذخیره شد."});}
  }catch(e){
   const error=e instanceof BuyerCommerceError?e:new BuyerCommerceError(503);
   if(error.status!==503)try{await this.pending?.clear(intent.key);}catch{}
   if(this.active&&epoch===this.epoch)this.emit({message:error.message,...(error.status!==503?{intent:null}:{}),...(error.status===401?{error,data:null,order:null}: {})});
  }
  finally{this.locked=false;if(this.active&&epoch===this.epoch)this.emit({busy:false});}}
}
