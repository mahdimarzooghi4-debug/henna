import { BuyerCommerceError, type BuyerCart } from "../../../packages/buyer-commerce/contracts.ts";
import { mobileCommerceIntent, type MobileCommerceClient, type MobileCommerceIntent } from "./mobile-commerce.ts";
import type { MobileCatalogClient } from "./mobile-catalog.ts";
import type { MobilePendingCommerceStore } from "./pending-commerce.ts";
export type NativeCartState = { cart: BuyerCart | null; names: Record<string,string>; error: BuyerCommerceError | null; busy: boolean; intent: MobileCommerceIntent | null; message: string };
export const initialNativeCartState = (): NativeCartState => ({cart:null,names:{},error:null,busy:false,intent:null,message:""});
export class NativeCartController {
  private active=false; private epoch=0; private locked=false; private state=initialNativeCartState();
  private readonly api: MobileCommerceClient; private readonly catalog: MobileCatalogClient; private readonly uuid:()=>string; private readonly notify:(s:NativeCartState)=>void; private readonly pending?:MobilePendingCommerceStore;
  constructor(api:MobileCommerceClient,catalog:MobileCatalogClient,uuid:()=>string,notify:(s:NativeCartState)=>void,pending?:MobilePendingCommerceStore) {this.api=api;this.catalog=catalog;this.uuid=uuid;this.notify=notify;this.pending=pending;}
  private emit(patch:Partial<NativeCartState>) {this.state={...this.state,...patch};if(this.active)this.notify(this.state);}
  start() {this.active=true;void this.resume();}
  private async resume() {
    try {
      const restored=await this.pending?.restore("cart");
      if(restored)this.emit({intent:restored.intent,message:"درخواست سبدِ تأییدنشده از اجرای قبلی بازیابی شد."});
      await this.refresh();
    } catch {
      if(this.active)this.emit({error:new BuyerCommerceError(503),message:"بازیابی امن درخواست قبلی انجام نشد؛ تغییر جدیدی ارسال نمی‌شود."});
    }
  }
  stop() {this.active=false;this.epoch++;}
  async refresh() {
    if(this.locked)return;const epoch=++this.epoch;this.emit({cart:null,error:null,busy:true});
    try {const cart=await this.api.cart();if(!this.active||epoch!==this.epoch)return;await this.show(cart,epoch);}
    catch(e){if(this.active&&epoch===this.epoch)this.emit({error:e instanceof BuyerCommerceError?e:new BuyerCommerceError(503)});}
    finally{if(this.active&&epoch===this.epoch)this.emit({busy:false});}
  }
  private async show(cart:BuyerCart,epoch:number) {
    const names:Record<string,string>={};await Promise.all(cart.items.map(async i=>{const r=await this.catalog.detail(i.productId);names[i.productId]=r.status==="ok"?r.data.name:r.status==="notFound"?"کالای خارج از انتشار":"نام کالا فعلاً دریافت نشد";}));
    if(this.active&&epoch===this.epoch)this.emit({cart,names,error:null});
  }
  async set(productId:string,quantity:number) {
    if(this.locked||this.state.busy||this.state.intent||!this.state.cart||!Number.isInteger(quantity)||quantity<0||quantity>999)return;
    this.emit({intent:mobileCommerceIntent("cart-items",{productId,quantity,expectedVersion:this.state.cart.version},this.uuid())});await this.retry();
  }
  async retry() {
    if(this.locked||!this.state.intent)return;this.locked=true;const epoch=++this.epoch;const intent=this.state.intent;this.emit({busy:true,message:""});
    try {
      await this.pending?.save("cart",intent);
      const cart=await this.api.post<BuyerCart>(intent);
      try{await this.pending?.clear(intent.key);}catch{}
      if(!this.active||epoch!==this.epoch)return;
      this.emit({intent:null,message:"سبد به‌روز شد."});await this.show(cart,epoch);
    }
    catch(e){
      const error=e instanceof BuyerCommerceError?e:new BuyerCommerceError(503);
      if(error.status!==503)try{await this.pending?.clear(intent.key);}catch{}
      if(!this.active||epoch!==this.epoch)return;
      this.emit({message:error.message,...(error.status!==503?{intent:null}:{}),...(error.status===401?{cart:null,error}: {})});
      if(error.code==="CART_VERSION_CHANGED"){this.locked=false;await this.refresh();}
    }
    finally{this.locked=false;if(this.active&&epoch===this.epoch)this.emit({busy:false});}
  }
}
