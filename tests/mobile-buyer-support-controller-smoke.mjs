import assert from "node:assert/strict";
import test from "node:test";
import { BuyerCommerceError } from "../packages/buyer-commerce/contracts.ts";
import {
  NativeBuyerSupportController,
} from "../apps/mobile-consumer/src/buyer-support-controller.ts";
import {
  MobilePendingCommerceStore,
} from "../apps/mobile-consumer/src/pending-commerce.ts";

const ID="82000000-0000-4000-8000-000000000001";
const KEY="82000000-0000-4000-8000-000000000002";
const KEY2="82000000-0000-4000-8000-000000000003";
const now=()=>new Promise(resolve=>setTimeout(resolve,0));

function pendingFixture(){
  let raw=null;
  return {
    store:new MobilePendingCommerceStore({
      read:async()=>raw,
      write:async value=>{raw=value;},
      remove:async()=>{raw=null;},
    },{
      readBase64:async()=>{throw Error("not used");},
      remove:async()=>{},
      cleanup:async()=>{},
    }),
    raw:()=>raw,
  };
}

test("native support keeps exact ambiguous ticket across controller restart",async()=>{
  const p=pendingFixture();
  let attempts=0;
  const calls=[];
  const api={
    notifications:async()=>[],
    tickets:async()=>[],
    post:async intent=>{
      calls.push(intent);
      attempts++;
      if(attempts===1)throw new BuyerCommerceError(503);
      return {id:ID,subject:"پیگیری",message:"شرح ثابت",state:"OPEN",
        createdAtUtc:"2026-10-05T10:00:00Z",reply:null};
    },
  };
  let state;
  const first=new NativeBuyerSupportController(
    api,()=>KEY,s=>{state=s;},p.store);
  first.start();
  await now();await now();
  first.edit({subject:"پیگیری",message:"شرح ثابت"});
  assert.equal(first.canOpenTicket(),true);
  await first.openTicket();
  assert.equal(state.intent.key,KEY);
  assert.ok(p.raw());
  first.stop();

  const second=new NativeBuyerSupportController(
    api,()=>KEY2,s=>{state=s;},p.store);
  second.start();
  await now();await now();
  assert.equal(state.intent.key,KEY);
  assert.equal(state.draft.message,"شرح ثابت");
  await second.retry();
  assert.equal(calls.length,2);
  assert.equal(calls[0].key,calls[1].key);
  assert.equal(calls[0].body,calls[1].body);
  assert.equal(state.intent,null);
  assert.equal(p.raw(),null);
  second.stop();
});

test("native support marks only a real unread notification",async()=>{
  const p=pendingFixture();
  const notification={id:ID,code:"REPLY_TICKET",resourceId:KEY,
    createdAtUtc:"2026-10-05T10:00:00Z",read:false};
  let state,posted=null;
  const api={
    notifications:async()=>[notification],
    tickets:async()=>[],
    post:async intent=>{
      posted=intent;
      return {...notification,read:true};
    },
  };
  const controller=new NativeBuyerSupportController(
    api,()=>KEY2,s=>{state=s;},p.store);
  controller.start();
  await now();await now();
  await controller.markRead(ID);
  assert.equal(posted.path,`notifications/${ID}/read`);
  assert.deepEqual(JSON.parse(posted.body),{});
  assert.equal(state.intent,null);
  controller.stop();
});
