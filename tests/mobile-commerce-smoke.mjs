import test from "node:test";
import assert from "node:assert/strict";
import { MobileCommerceClient, mobileCommerceIntent } from "../apps/mobile-consumer/src/mobile-commerce.ts";
const ID="60000000-0000-4000-8000-000000000001", token="hn1_"+Buffer.alloc(32,8).toString("base64url");
const cart={Id:ID,BuyerId:"PRIVATE",Version:2,Items:[{ProductId:ID,Quantity:2}]};
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{"Content-Type":"application/json"}});
function setup(handler, initial=token) {
 let current=initial, removed=0; const calls=[];
 const store={read:async()=>current,write:async t=>{current=t;},remove:async()=>{current=null;removed++;}};
 const client=new MobileCommerceClient("https://api.henna.test",store,async(url,options)=>{calls.push({url,options});return handler(url,options,store);});
 return {client,calls,store,current:()=>current,removed:()=>removed};
}
test("native buyer cart uses SecureStore bearer and strips private aggregate fields",async()=>{
 const s=setup(()=>json({items:[cart],page:1,pageSize:20}));
 assert.deepEqual(await s.client.cart(),{id:ID,version:2,items:[{productId:ID,quantity:2}]});
 assert.equal(s.calls[0].options.headers.Authorization,"Bearer "+token);assert.equal(s.calls[0].options.credentials,"omit");assert.equal(s.calls[0].options.redirect,"error");assert.equal(s.current(),token);
});
test("public offers never read native credentials",async()=>{
 const client=new MobileCommerceClient("https://api.henna.test",{read:async()=>{throw Error("must not read");},write:async()=>{},remove:async()=>{}},async(url,o)=>{assert.equal(o.headers.Authorization,undefined);return json({items:[],page:1,pageSize:20});});
 assert.deepEqual(await client.offers(ID),[]);
});
test("outage keeps SecureStore, 401 removes only the rejected current session",async()=>{
 const s=setup(()=>json({},503));await assert.rejects(s.client.cart(),e=>e.status===503);assert.equal(s.current(),token);assert.equal(s.removed(),0);
 const expired=setup(()=>json({},401));await assert.rejects(expired.client.cart(),e=>e.status===401);assert.equal(expired.current(),null);
 const changed=setup(async(url,o,store)=>{await store.write("hn1_"+Buffer.alloc(32,9).toString("base64url"));return json({},401);});await assert.rejects(changed.client.cart(),e=>e.status===401);assert.equal(changed.removed(),0);
});
test("guest, corrupt keychain and unavailable keychain fail closed",async()=>{
 const guest=setup(()=>{throw Error("no fetch");},null);await assert.rejects(guest.client.cart(),e=>e.status===401);assert.equal(guest.calls.length,0);
 const corrupt=setup(()=>{throw Error("no fetch");},"invalid");await assert.rejects(corrupt.client.cart(),e=>e.status===401);assert.equal(corrupt.removed(),1);
 const client=new MobileCommerceClient("https://api.henna.test",{read:async()=>{throw Error();},write:async()=>{},remove:async()=>{}},async()=>{throw Error("no fetch");});await assert.rejects(client.cart(),e=>e.status===503);
});
test("same frozen command can recover an ambiguous response without changing payload or key",async()=>{
 let attempt=0;const s=setup(()=>++attempt===1?json({},503):json(cart));
 const intent=mobileCommerceIntent("cart-items",{productId:ID,quantity:2,expectedVersion:1},ID);assert.equal(Object.isFrozen(intent),true);
 await assert.rejects(s.client.post(intent),e=>e.status===503);await s.client.post(intent);
 assert.equal(s.calls[0].options.body,s.calls[1].options.body);assert.equal(s.calls[0].options.headers["Idempotency-Key"],ID);assert.equal(s.calls[1].options.headers["Idempotency-Key"],ID);
});
test("only buyer routes and bounded page values reach the API",async()=>{
 const s=setup(url=>json({items:[],page:Number(new URL(url).searchParams.get("page")),pageSize:20}));
 for(const path of ["constructor","__proto__","admin","orders/"+ID+"/cancel?x=1"])assert.throws(()=>s.client.read(path),e=>e.status===404);
 for(const p of [0,1.5,10001])assert.throws(()=>s.client.orders(p),e=>e.status===400);
 assert.equal(s.calls.length,0);assert.deepEqual(await s.client.orders(2),[]);assert.equal(s.calls[0].url,"https://api.henna.test/api/v1/orders?page=2");
});
test("malformed money, redirected responses and wrong page never become empty success",async()=>{
 const s=setup(()=>json({items:[{BalanceRial:9007199254740992}],page:1,pageSize:20}));await assert.rejects(s.client.read("wallet"),e=>e.status===503);
 const page=setup(()=>json({items:[],page:1,pageSize:20}));await assert.rejects(page.client.orders(2),e=>e.status===503);
 const redirected=setup(()=>{const r=json({items:[],page:1,pageSize:20});Object.defineProperty(r,"redirected",{value:true});return r;});await assert.rejects(redirected.client.cart(),e=>e.status===503);
 const oversized=setup(()=>new Response("x".repeat(512001),{headers:{"Content-Type":"application/json"}}));await assert.rejects(oversized.client.cart(),e=>e.status===503);
});
test("incident transport uses owner routes only and never allows staff decisions or generic commands",async()=>{
 const raw={Id:ID,OrderId:ID,OrderItemId:ID,Type:"DAMAGED_ITEM",Quantity:1,State:"UNDER_REVIEW",ReportedAtUtc:"2026-10-04T20:00:00Z",ReturnDueAtUtc:null,CollectedAtUtc:null,RefundRial:0,BuyerId:"PRIVATE",EvidenceReference:"PRIVATE"};
 const s=setup(url=>url.endsWith(`/me/evidence/${ID}/discard`)
  ?json({evidenceId:ID,deleted:true})
  :url.includes("me/evidence")
   ?json({evidenceId:ID,sha256:"A".repeat(64),contentType:"image/jpeg",size:12})
   :url.includes("me/incidents")?json({items:[raw],page:2,pageSize:20}):json(raw));
 assert.equal((await s.client.incidents(2))[0].state,"UNDER_REVIEW");assert.equal(s.calls[0].url,"https://api.henna.test/api/v1/me/incidents?page=2");
 const evidence=mobileCommerceIntent("evidence",{contentType:"image/jpeg",contentBase64:"PHOTO"},ID);assert.equal((await s.client.post(evidence)).evidenceId,ID);assert.equal(s.calls[1].url,"https://api.henna.test/api/v1/me/evidence");
 await s.client.post(mobileCommerceIntent(`orders/${ID}/incidents`,{orderItemId:ID,type:"DAMAGED_ITEM",quantity:1,evidenceId:ID},ID));
 await s.client.post(mobileCommerceIntent(`item-returns/${ID}/confirm-collection`,{},ID));
 const discarded=await s.client.post(mobileCommerceIntent(`evidence/${ID}/discard`,{},ID));
 assert.deepEqual(discarded,{evidenceId:ID,deleted:true});
 assert.equal(s.calls[4].url,`https://api.henna.test/api/v1/me/evidence/${ID}/discard`);
 for(const path of [`support/incidents/${ID}/decision`,`seller/item-returns/${ID}/contact`,`commerce/commands/SAVE_EVIDENCE`,`me/incidents?accountId=${ID}`])assert.throws(()=>mobileCommerceIntent(path,{},ID),e=>e.status===404);
 assert.equal(s.calls.length,5);assert.equal(JSON.stringify(await s.client.incidents(2)).includes("PRIVATE"),false);
});

test("native buyer notifications and support use only owner routes",async()=>{
 const notification={Id:ID,AccountId:"SECRET",Code:"REPLY_TICKET",
  ResourceId:ID,CreatedAtUtc:"2026-10-05T09:00:00Z",Read:false};
 const ticket={Id:ID,AccountId:"SECRET",Subject:"پیگیری",Message:"متن",
  State:"ANSWERED",CreatedAtUtc:"2026-10-05T09:10:00Z",Reply:"پاسخ"};
 const s=setup((url,o)=>{
  if(url.includes("/me/notifications?"))
   return json({items:[notification],page:2,pageSize:20});
  if(url.endsWith(`/me/notifications/${ID}/read`))
   return json({...notification,Read:true});
  if(url.includes("/me/tickets?"))
   return json({items:[ticket],page:3,pageSize:20});
  if(url.endsWith("/support/tickets"))return json(ticket);
  throw Error("unexpected "+url);
 });
 const notifications=await s.client.notifications(2);
 assert.equal(notifications[0].code,"REPLY_TICKET");
 assert.equal(JSON.stringify(notifications).includes("SECRET"),false);
 const tickets=await s.client.tickets(3);
 assert.equal(tickets[0].reply,"پاسخ");
 assert.equal(JSON.stringify(tickets).includes("SECRET"),false);
 const read=mobileCommerceIntent(`notifications/${ID}/read`,{},ID);
 assert.equal((await s.client.post(read)).read,true);
 const opened=mobileCommerceIntent("tickets",{
  subject:"پیگیری",message:"متن",
 },ID);
 assert.equal((await s.client.post(opened)).state,"ANSWERED");
 assert.equal(s.calls[0].url,
  "https://api.henna.test/api/v1/me/notifications?page=2");
 assert.equal(s.calls[1].url,
  "https://api.henna.test/api/v1/me/tickets?page=3");
 assert.equal(s.calls[2].url,
  `https://api.henna.test/api/v1/me/notifications/${ID}/read`);
 assert.equal(s.calls[3].url,
  "https://api.henna.test/api/v1/support/tickets");
});
