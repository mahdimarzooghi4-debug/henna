import assert from "node:assert/strict";
import test from "node:test";
import {
  MobilePendingCommerceStore,
} from "../apps/mobile-consumer/src/pending-commerce.ts";
import {
  mobileCommerceIntent,
} from "../apps/mobile-consumer/src/mobile-commerce.ts";

const KEY="81000000-0000-4000-8000-000000000001";
const KEY2="81000000-0000-4000-8000-000000000002";
const KEY3="81000000-0000-4000-8000-000000000007";
const PRODUCT="81000000-0000-4000-8000-000000000003";
const ORDER="81000000-0000-4000-8000-000000000004";
const ITEM="81000000-0000-4000-8000-000000000005";
const EVIDENCE="81000000-0000-4000-8000-000000000006";
const PHOTO="file:///documents/hana-evidence/evidence.jpg";
const JPEG="/9j/2Q==";

function fixture(initial=null){
  let text=initial;
  const files=new Map([[PHOTO,JPEG],
    ["file:///documents/hana-evidence/orphan.jpg",JPEG]]);
  const store=new MobilePendingCommerceStore({
    read:async()=>text,
    write:async value=>{text=value;},
    remove:async()=>{text=null;},
  },{
    readBase64:async uri=>{
      if(!files.has(uri))throw Error("missing");
      return files.get(uri);
    },
    remove:async uri=>{files.delete(uri);},
    cleanup:async keep=>{
      for(const uri of [...files.keys()])if(uri!==keep)files.delete(uri);
    },
  });
  return {store,raw:()=>text,files};
}

test("pending commerce preserves exact intent and refuses a second unresolved command",async()=>{
  const f=fixture();
  const intent=mobileCommerceIntent("cart-items",{
    productId:PRODUCT,quantity:2,expectedVersion:7,
  },KEY);
  await f.store.save("cart",intent);
  assert.deepEqual(await f.store.route(),{
    screen:"cart",selectedOrderId:null,incidentOrderId:null,
  });
  assert.deepEqual((await f.store.restore("cart"))?.intent,intent);

  const changed=mobileCommerceIntent("cart-items",{
    productId:PRODUCT,quantity:3,expectedVersion:7,
  },KEY2);
  await assert.rejects(()=>f.store.save("cart",changed));
  assert.deepEqual((await f.store.restore("cart"))?.intent,intent);
  assert.equal(await f.store.clear(KEY2),false);
  assert.equal(await f.store.clear(KEY),true);
  assert.equal(f.raw(),null);
});

test("evidence recovery stores no base64 and advances only from the known prior key",async()=>{
  const f=fixture();
  const evidence=mobileCommerceIntent("evidence",{
    contentType:"image/jpeg",contentBase64:JPEG,
  },KEY);
  const context={
    orderId:ORDER,itemId:ITEM,type:"DAMAGED_ITEM",
    quantity:1,photoUri:PHOTO,
  };
  await f.store.save("incidents",evidence,context);
  assert.equal(f.raw().includes(JPEG),false);
  assert.equal(f.raw().includes("contentBase64"),false);
  assert.equal(f.files.has(PHOTO),true);

  await f.store.cleanupPhotos();
  assert.equal(f.files.has(PHOTO),true);
  assert.equal(f.files.size,1);

  const restored=await f.store.restore("incidents");
  assert.equal(restored.intent.key,KEY);
  assert.deepEqual(JSON.parse(restored.intent.body),{
    contentType:"image/jpeg",contentBase64:JPEG,
  });
  assert.deepEqual(restored.incident,context);

  const report=mobileCommerceIntent(`orders/${ORDER}/incidents`,{
    orderItemId:ITEM,type:"DAMAGED_ITEM",quantity:1,evidenceId:EVIDENCE,
  },KEY2);
  await assert.rejects(()=>f.store.advance(KEY2,"incidents",report,context));
  await f.store.advance(KEY,"incidents",report,context);
  const raw=f.raw();
  assert.equal(raw.includes(JPEG),false);
  assert.equal(raw.includes(EVIDENCE),true);
  assert.equal((await f.store.restore("incidents")).intent.key,KEY2);

  const cleanup=mobileCommerceIntent(`evidence/${EVIDENCE}/discard`,{},KEY3);
  await f.store.advance(KEY2,"incidents",cleanup,context);
  const cleanupRestored=await f.store.restore("incidents");
  assert.equal(cleanupRestored.intent.path,`evidence/${EVIDENCE}/discard`);
  assert.equal(cleanupRestored.intent.key,KEY3);
  assert.equal(await f.store.clear(KEY3),true);
  assert.equal(f.files.has(PHOTO),false);
});

test("corrupted persisted state fails closed instead of being treated as empty",async()=>{
  const f=fixture('{"version":1,"scope":"checkout","path":"orders","key":"bad"}');
  await assert.rejects(()=>f.store.route());
  const next=mobileCommerceIntent("orders",{
    quoteId:ORDER,creditGrantId:null,
    unavailableDisposition:"KEEP",confirmUnavailable:true,
  },KEY);
  await assert.rejects(()=>f.store.save("checkout",next));
  assert.notEqual(f.raw(),null);
});
