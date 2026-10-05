import assert from "node:assert/strict";
import test from "node:test";
import {
  adminOperationIntent,
  parseAdminCommandResponse,
  parseAdminResourcePage,
  parseAdminSummary,
} from "../apps/web-marketplace/lib/admin-operations.ts";

const ID="70000000-0000-4000-8000-000000000001";
const ID2="70000000-0000-4000-8000-000000000002";
const ID3="70000000-0000-4000-8000-000000000003";

test("admin summary and privileged resource DTOs fail closed",()=>{
  assert.deepEqual(parseAdminSummary({
    orders:12,cancelled:2,collected:7,openIncidents:1,
    preparedSettlements:4,grossRial:500000,
  }),{
    orders:12,cancelled:2,collected:7,openIncidents:1,
    preparedSettlements:4,grossRial:500000,
  });
  assert.equal(parseAdminSummary({
    orders:1,cancelled:2,collected:0,openIncidents:0,
    preparedSettlements:0,grossRial:1,
  }),null);

  const permissions=parseAdminResourcePage("permissions",{
    page:1,pageSize:20,items:[{
      Id:ID,AccountId:ID2,Permission:"SUPPORT",Active:true,
      Secret:"must not pass",
    }],
  },1);
  assert.deepEqual(permissions,[{
    id:ID,accountId:ID2,permission:"SUPPORT",active:true,
  }]);

  const audit=parseAdminResourcePage("audit",{
    page:1,items:[{
      Id:ID,ActorId:ID2,CommandId:ID3,ResourceId:ID,
      Event:"SET_STAFF_PERMISSION",CreatedAtUtc:"2026-10-05T05:00:00Z",
    }],
  },1);
  assert.equal(audit?.[0].event,"SET_STAFF_PERMISSION");
  assert.equal(parseAdminResourcePage("audit",{page:2,items:[]},1),null);
});

test("admin command responses are bounded by command contract",()=>{
  const content=parseAdminCommandResponse("SAVE_CONTENT",{
    Id:ID,Slug:"terms",Title:"شرایط",Text:"متن",Published:false,Version:1,
    Internal:"hidden",
  });
  assert.deepEqual(content,{
    id:ID,slug:"terms",title:"شرایط",text:"متن",published:false,version:1,
  });

  const settlement={
    Id:ID,OrderId:ID2,SellerId:ID3,GrossRial:1000,RefundRial:0,
    PenaltyRial:0,FixedFeeRial:10,FeeVersion:"v1",NetRial:990,
    State:"READY_FOR_BANK_TRANSFER",CreatedAtUtc:"2026-10-05T05:00:00Z",
  };
  assert.equal(parseAdminCommandResponse("BUILD_SETTLEMENTS",[settlement])?.length,1);
  assert.deepEqual(parseAdminCommandResponse("ASSESS_WITHDRAWAL_SLA",
    {escalated:3}),{escalated:3});
  assert.equal(parseAdminCommandResponse("SAVE_CONTENT",{Id:"bad"}),null);
});

test("ambiguous admin retry preserves exact key and body",()=>{
  const first=adminOperationIntent(null,"SET_STAFF_PERMISSION",{
    accountId:ID2,permission:"SUPPORT",active:true,
  });
  const retry=adminOperationIntent(first,"SET_STAFF_PERMISSION",{
    accountId:ID2,permission:"SUPPORT",active:true,
  });
  assert.deepEqual(retry,first);
  const changed=adminOperationIntent(first,"SET_STAFF_PERMISSION",{
    accountId:ID2,permission:"SUPPORT",active:false,
  });
  assert.notEqual(changed.key,first.key);
});
