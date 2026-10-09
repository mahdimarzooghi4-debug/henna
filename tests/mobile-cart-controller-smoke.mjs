import test from "node:test";
import assert from "node:assert/strict";
import { NativeCartController } from "../apps/mobile-consumer/src/buyer-cart-controller.ts";
import { BuyerCommerceError } from "../packages/buyer-commerce/contracts.ts";
const ID="60000000-0000-4000-8000-000000000001";
const cart={id:ID,version:1,items:[{productId:ID,quantity:1}]};
const wait=async(condition)=>{for(let i=0;i<100;i++){if(condition())return;await new Promise(r=>setTimeout(r,1));}throw Error("state did not settle");};
const catalog={detail:async()=>({status:"ok",data:{name:"کالای واقعی آزمایشی"}})};
test("native cart retries the original absolute quantity and version after ambiguous response",async()=>{
 let state,attempt=0;const intents=[];
 const api={cart:async()=>cart,post:async intent=>{intents.push(intent);if(++attempt===1)throw new BuyerCommerceError(503);return {...cart,version:2,items:[{productId:ID,quantity:2}]};}};
 const c=new NativeCartController(api,catalog,()=>ID,s=>state=s);c.start();await wait(()=>state?.cart&&!state.busy);
 await c.set(ID,2);assert.equal(state.intent.key,ID);assert.equal(state.cart.items[0].quantity,1);await c.set(ID,3);assert.equal(intents.length,1);
 await c.retry();assert.equal(intents[0],intents[1]);assert.deepEqual(JSON.parse(intents[1].body),{productId:ID,quantity:2,expectedVersion:1});assert.equal(state.cart.items[0].quantity,2);assert.equal(state.intent,null);c.stop();
});
test("cart conflict refreshes current server version; revoked session hides old cart",async()=>{
 let state,reads=0;const api={cart:async()=>({...cart,version:++reads}),post:async()=>{throw new BuyerCommerceError(409,"CART_VERSION_CHANGED");}};
 const c=new NativeCartController(api,catalog,()=>ID,s=>state=s);c.start();await wait(()=>state?.cart&&!state.busy);await c.set(ID,2);assert.equal(state.cart.version,2);assert.equal(state.intent,null);
 api.cart=async()=>{throw new BuyerCommerceError(401);};await c.refresh();assert.equal(state.cart,null);assert.equal(state.error.status,401);c.stop();
});
test("stopped cart rejects stale asynchronous rendering",async()=>{
 let resolve,state,count=0;const api={cart:()=>new Promise(r=>resolve=r)};
 const c=new NativeCartController(api,catalog,()=>ID,s=>{state=s;count++;});c.start();c.stop();resolve(cart);await new Promise(r=>setTimeout(r,5));assert.equal(count,1);assert.equal(state.cart,null);
});
