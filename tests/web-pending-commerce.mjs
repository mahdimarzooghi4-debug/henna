import assert from "node:assert/strict";
import test from "node:test";
import {
  clearWebCommerceIntent,
  persistWebCommerceIntent,
  restoreWebCommerceIntent,
} from "../apps/web-marketplace/lib/web-pending-commerce.ts";
const PRODUCT="91000000-0000-4000-8000-000000000001";
const SELLER="91000000-0000-4000-8000-000000000002";
const ADDRESS="91000000-0000-4000-8000-000000000003";
const QUOTE="91000000-0000-4000-8000-000000000004";
const KEY="91000000-0000-4000-8000-000000000005";
const KEY2="91000000-0000-4000-8000-000000000006";

function fakeStorage(){
  const values=new Map();
  return {
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>values.set(key,String(value)),
    removeItem:key=>values.delete(key),
    clear:()=>values.clear(),
    key:index=>[...values.keys()][index]??null,
    get length(){return values.size;},
    values,
  };
}
function install(){
  const sessionStorage=fakeStorage();
  globalThis.window={sessionStorage};
  return sessionStorage;
}

test("web cart intent survives a simulated reload with exact body and key",()=>{
  install();
  const intent={path:"cart-items",body:JSON.stringify({
    productId:PRODUCT,quantity:2,expectedVersion:3,
  }),key:KEY};
  persistWebCommerceIntent("cart",intent);
  assert.deepEqual(restoreWebCommerceIntent("cart"),intent);
  assert.equal(clearWebCommerceIntent(KEY2),false);
  assert.deepEqual(restoreWebCommerceIntent("cart"),intent);
  assert.equal(clearWebCommerceIntent(KEY),true);
  assert.equal(restoreWebCommerceIntent("cart"),null);
});

test("checkout intent cannot be replaced by a different unresolved command",()=>{
  install();
  const first={path:"quotes",body:JSON.stringify({
    sellerId:SELLER,addressId:ADDRESS,purchaseType:"PERSONAL",
    fulfillmentMode:"PICKUP",
  }),key:KEY};
  persistWebCommerceIntent("checkout",first);
  const second={path:"orders",body:JSON.stringify({
    quoteId:QUOTE,creditGrantId:null,
    unavailableDisposition:"KEEP",confirmUnavailable:true,
  }),key:KEY2};
  assert.throws(()=>persistWebCommerceIntent("checkout",second));
  assert.deepEqual(restoreWebCommerceIntent("checkout"),first);
});

test("tampered or cross-scope storage fails closed",()=>{
  const storage=install();
  persistWebCommerceIntent("orders",{
    path:`orders/${QUOTE}/cancel`,
    body:JSON.stringify({expectedVersion:4}),
    key:KEY,
  });
  assert.throws(()=>restoreWebCommerceIntent("checkout"));

  storage.setItem("hana.buyer.pending-commerce.v1",JSON.stringify({
    version:1,scope:"orders",path:`orders/${QUOTE}/cancel`,
    body:JSON.stringify({expectedVersion:4,extra:true}),key:KEY,
  }));
  assert.throws(()=>restoreWebCommerceIntent("orders"));
});

test("address recovery validates coordinates and bounded text",()=>{
  install();
  const address={path:"addresses",body:JSON.stringify({
    addressId:ADDRESS,cityId:SELLER,text:"نشانی معتبر",
    latitude:35.7,longitude:51.4,
  }),key:KEY};
  persistWebCommerceIntent("checkout",address);
  assert.deepEqual(restoreWebCommerceIntent("checkout"),address);
  clearWebCommerceIntent(KEY);
  assert.throws(()=>persistWebCommerceIntent("checkout",{
    ...address,key:KEY2,body:JSON.stringify({
      addressId:ADDRESS,cityId:SELLER,text:"نشانی معتبر",
      latitude:120,longitude:51.4,
    }),
  }));
});

test("buyer support retry survives reload but rejects changed ticket text",()=>{
  install();
  const ticket={path:"tickets",body:JSON.stringify({
    subject:"پیگیری سفارش",message:"شرح ثابت",
  }),key:KEY};
  persistWebCommerceIntent("support",ticket);
  assert.deepEqual(restoreWebCommerceIntent("support"),ticket);
  assert.throws(()=>persistWebCommerceIntent("support",{
    ...ticket,key:KEY2,body:JSON.stringify({
      subject:"پیگیری سفارش",message:"شرح تغییرکرده",
    }),
  }));
  assert.equal(clearWebCommerceIntent(KEY),true);

  const read={path:`notifications/${PRODUCT}/read`,
    body:JSON.stringify({}),key:KEY2};
  persistWebCommerceIntent("support",read);
  assert.deepEqual(restoreWebCommerceIntent("support"),read);
});
