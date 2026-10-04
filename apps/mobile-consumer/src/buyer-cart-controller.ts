import { BuyerCommerceError, type BuyerCart } from "../../../packages/buyer-commerce/contracts.ts";
import { mobileCommerceIntent, type MobileCommerceClient, type MobileCommerceIntent } from "./mobile-commerce.ts";
import type { MobileCatalogClient } from "./mobile-catalog.ts";
export type NativeCartState = { cart: BuyerCart | null; names: Record<string,string>; error: BuyerCommerceError | null; busy: boolean; intent: MobileCommerceIntent | null; message: string };
export const initialNativeCartState = (): NativeCartState => ({cart:null,names:{},error:null,busy:false,intent:null,message:""});
export class NativeCartController {
  private active=false; private epoch=0; private locked=false; private state=initialNativeCartState();
  private readonly api: MobileCommerceClient; private readonly catalog: MobileCatalogClient; private readonly uuid:()=>string; private readonly notify:(s:NativeCartState)=>void;
  constructor(api:MobileCommerceClient,catalog:MobileCatalogClient,uuid:()=>string,notify:(s:NativeCartState)=>void) {this.api=api;this.catalog=catalog;this.uuid=uuid;this.notify=notify;}
  private emit(patch:Partial<NativeCartState>) {this.state={...this.state,...patch};if(this.active)this.notify(this.state);}
  start() {this.active=true;void this.refresh();}
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
    try {const cart=await this.api.post<BuyerCart>(intent);if(!this.active||epoch!==this.epoch)return;this.emit({intent:null,message:"سبد به‌روز شد."});await this.show(cart,epoch);}
    catch(e){if(!this.active||epoch!==this.epoch)return;const error=e instanceof BuyerCommerceError?e:new BuyerCommerceError(503);this.emit({message:error.message,...(error.status!==503?{intent:null}:{}),...(error.status===401?{cart:null,error}: {})});if(error.code==="CART_VERSION_CHANGED"){this.locked=false;await this.refresh();}}
    finally{this.locked=false;if(this.active&&epoch===this.epoch)this.emit({busy:false});}
  }
}
