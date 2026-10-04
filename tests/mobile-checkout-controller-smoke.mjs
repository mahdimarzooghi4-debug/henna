import test from "node:test";
import assert from "node:assert/strict";
import { NativeCheckoutController,nativeCheckoutAmounts } from "../apps/mobile-consumer/src/buyer-checkout-controller.ts";
import { BuyerCommerceError } from "../packages/buyer-commerce/contracts.ts";
const ID="60000000-0000-4000-8000-000000000001",OTHER="60000000-0000-4000-8000-000000000002";
let now=Date.parse("2026-10-04T19:00:00Z");
const quote={id:ID,sellerId:ID,purchaseType:"PERSONAL",fulfillmentMode:"PICKUP",items:[{productId:ID,quantity:2,unitPriceRial:1000}],itemsTotalRial:2000,unavailable:[{productId:OTHER,quantity:1}],expiresAtUtc:"2026-10-04T19:05:00Z",used:false};
const catalog={detail:async id=>({status:"ok",data:{id,name:"کالای آزمون",categoryId:ID}})};
const wait=async fn=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,1));}throw Error("state not settled");};
function fixture(post,overrides={}){let state;const data={comparison:[{sellerId:ID,storeName:"فروشگاه آزمون",available:quote.items,unavailable:quote.unavailable,itemsTotalRial:2000}],addresses:[{id:ID,text:"نشانی آزمون"}],credits:[{id:ID,availableRial:2000,categoryIds:[ID],expiresAtUtc:"2026-10-05T19:00:00Z"}],wallet:{balanceRial:0},...overrides};
 const api={cart:async()=>({id:ID,version:1,items:[{productId:ID,quantity:2},{productId:OTHER,quantity:1}]}),read:async path=>data[path],post,order:async()=>({id:ID,state:"PAID"})};const c=new NativeCheckoutController(api,catalog,()=>ID,s=>state=s,()=>now);c.start();return{c,api,state:()=>state};}
test("partial cart requires explicit choice and consent; ambiguous order retries original key after expiry",async()=>{
 now=Date.parse("2026-10-04T19:00:00Z");let attempts=[];const f=fixture(async intent=>{if(intent.path==="quotes")return quote;attempts.push(intent);if(attempts.length===1)throw new BuyerCommerceError(503);return {id:ID,state:"PAID"};});await wait(()=>f.state()?.data&&!f.state().busy);
 f.c.choose({sellerId:ID,addressId:ID});await f.c.quote();f.c.review({creditId:ID});assert.equal(nativeCheckoutAmounts(f.state(),now).canPlace,false);await f.c.place();assert.equal(attempts.length,0);
 f.c.review({disposition:"KEEP",confirmed:true});assert.equal(nativeCheckoutAmounts(f.state(),now).canPlace,true);await f.c.place();assert.ok(f.state().intent);f.c.review({disposition:"REMOVE"});assert.equal(f.state().disposition,"KEEP");
 now+=600000;await f.c.place();assert.equal(attempts.length,1);await f.c.retry();assert.equal(attempts[0],attempts[1]);assert.deepEqual(JSON.parse(attempts[1].body),{quoteId:ID,creditGrantId:ID,unavailableDisposition:"KEEP",confirmUnavailable:true});assert.equal(f.state().order.id,ID);assert.equal(f.state().intent,null);f.c.stop();
});
test("legal purchase clears support credit, insufficient cash and expired quotes block new orders",async()=>{
 now=Date.parse("2026-10-04T19:00:00Z");let orders=0;const f=fixture(async i=>{if(i.path==="orders")orders++;return {...quote,purchaseType:JSON.parse(i.body).purchaseType};});await wait(()=>f.state()?.data&&!f.state().busy);f.c.choose({sellerId:ID,addressId:ID});await f.c.quote();f.c.review({creditId:ID,disposition:"KEEP",confirmed:true});
 f.c.choose({purchaseType:"LEGAL"});assert.equal(f.state().creditId,"");assert.equal(f.state().quote,null);await f.c.quote();f.c.review({disposition:"KEEP",confirmed:true});assert.equal(nativeCheckoutAmounts(f.state(),now).canPlace,false);await f.c.place();assert.equal(orders,0);f.c.stop();
});
test("address retry retains generated address ID and snapshot",async()=>{
 let attempts=[];const f=fixture(async i=>{attempts.push(i);if(attempts.length===1)throw new BuyerCommerceError(503);return{id:ID,text:"نشانی جدید"};});await wait(()=>f.state()?.data&&!f.state().busy);await f.c.saveAddress(ID,"نشانی جدید",35,51);assert.ok(f.state().intent);await f.c.saveAddress(OTHER,"عوض‌شده",36,52);await f.c.retry();assert.equal(attempts[0],attempts[1]);assert.equal(JSON.parse(attempts[1].body).addressId,ID);assert.equal(f.state().addressId,ID);assert.equal(f.state().data.addresses.length,1);f.api.cart=async()=>{throw new BuyerCommerceError(401);};await f.c.refresh();assert.equal(f.state().data,null);assert.equal(f.state().error.status,401);f.c.stop();
});
test("stopped checkout does not publish late results",async()=>{let resolve,count=0;const c=new NativeCheckoutController({cart:()=>new Promise(r=>resolve=r),read:async()=>[]},catalog,()=>ID,()=>count++);c.start();c.stop();resolve({items:[]});await new Promise(r=>setTimeout(r,5));assert.equal(count,1);});

test("expired quote cannot create a new financial command",async()=>{now=Date.parse("2026-10-04T19:00:00Z");let orders=0;const f=fixture(async i=>{if(i.path==="orders")orders++;return quote;});await wait(()=>f.state()?.data&&!f.state().busy);f.c.choose({sellerId:ID,addressId:ID});await f.c.quote();f.c.review({creditId:ID,disposition:"KEEP",confirmed:true});now+=600000;assert.equal(nativeCheckoutAmounts(f.state(),now).canPlace,false);await f.c.place();assert.equal(orders,0);f.c.stop();});
