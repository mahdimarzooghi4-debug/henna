import assert from "node:assert/strict";
import test from "node:test";
import {
  adminOperationIntent,
  parseAdminClientResourceList,
  parseAdminCommandResponse,
  parseAdminIntegrity,
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

  const integrity=parseAdminIntegrity({
    healthy:false,checkedAtUtc:"2026-10-05T12:00:00Z",
    violationCount:1,truncated:false,
    violations:[{code:"ORDER_TOTAL_MISMATCH",resourceKind:"ORDER",resourceId:ID}],
    counts:{wallets:1,credits:2,programs:1,orders:3,incidents:1,
      settlements:1,withdrawals:1,evidence:1},
    secret:"never-use",
  });
  assert.equal(integrity?.healthy,false);
  assert.equal(integrity?.violations[0].code,"ORDER_TOTAL_MISMATCH");
  assert.equal(JSON.stringify(integrity).includes("secret"),false);
  assert.equal(parseAdminIntegrity({
    healthy:true,checkedAtUtc:"2026-10-05T12:00:00Z",
    violationCount:1,truncated:false,violations:[],
    counts:{wallets:0,credits:0,programs:0,orders:0,incidents:0,
      settlements:0,withdrawals:0,evidence:0},
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

  const programs=parseAdminResourcePage("programs",{
    page:1,pageSize:20,items:[{
      Id:ID,Name:"برنامه CI",FundingReference:"private-source",
      FundedRial:10000,UnallocatedRial:4000,
      ExpiresAtUtc:"2026-12-05T05:00:00Z",CategoryIds:[ID2],
      OrganizationId:null,
    }],
  },1);
  assert.deepEqual(programs,[{
    id:ID,name:"برنامه CI",fundedRial:10000,unallocatedRial:4000,
    expiresAtUtc:"2026-12-05T05:00:00Z",categoryIds:[ID2],
    organizationId:null,
  }]);
  assert.equal(JSON.stringify(programs).includes("private-source"),false);

  const households=parseAdminResourcePage("households",{
    page:1,pageSize:20,items:[{
      Id:ID,AccountId:ID2,HouseholdKey:ID3,EvidenceReference:"review-42",
    }],
  },1);
  assert.equal(households?.[0].householdKey,ID3);
});

test("camel-case BFF resource DTOs remain bounded in browser",()=>{
  const programs=parseAdminClientResourceList("programs",[{
    id:ID,name:"برنامه CI",fundedRial:10000,unallocatedRial:4000,
    expiresAtUtc:"2026-12-05T05:00:00Z",categoryIds:[ID2],
    organizationId:null,secret:"never-use",
  }]);
  assert.deepEqual(programs,[{
    id:ID,name:"برنامه CI",fundedRial:10000,unallocatedRial:4000,
    expiresAtUtc:"2026-12-05T05:00:00Z",categoryIds:[ID2],
    organizationId:null,
  }]);
  assert.equal(JSON.stringify(programs).includes("secret"),false);

  const content=parseAdminClientResourceList("content",[{
    id:ID,slug:"terms",title:"شرایط",text:"متن",published:false,version:1,
  }]);
  assert.equal(content?.[0].title,"شرایط");
  assert.equal(parseAdminClientResourceList("programs",[{id:"bad"}]),null);
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
    PenaltyRial:1000,FixedFeeRial:10,FeeVersion:"v1",NetRial:-10,
    State:"READY_FOR_BANK_TRANSFER",CreatedAtUtc:"2026-10-05T05:00:00Z",
  };
  const built=parseAdminCommandResponse("BUILD_SETTLEMENTS",[settlement]);
  assert.equal(built?.length,1);
  assert.equal(built?.[0].netRial,-10);
  assert.deepEqual(parseAdminCommandResponse("ASSESS_WITHDRAWAL_SLA",
    {escalated:3}),{escalated:3});
  const program=parseAdminCommandResponse("CREATE_PROGRAM",{
    Id:ID,Name:"برنامه CI",FundingReference:"private-source",
    FundedRial:10000,UnallocatedRial:10000,
    ExpiresAtUtc:"2026-12-05T05:00:00Z",CategoryIds:[ID2],
    OrganizationId:null,
  });
  assert.equal(program?.name,"برنامه CI");
  assert.equal(JSON.stringify(program).includes("private-source"),false);

  const allocation=parseAdminCommandResponse("ALLOCATE_CREDIT",{
    grants:[{
      Id:ID,AccountId:ID2,ProgramId:ID3,GrantedRial:6000,
      AvailableRial:6000,ExpiresAtUtc:"2026-12-05T05:00:00Z",
      CategoryIds:[ID],HouseholdKey:ID3,
    }],
    unallocatedRial:0,formulaVersion:"baseline-v1",
  });
  assert.equal(allocation?.grants[0].grantedRial,6000);
  assert.equal(allocation?.formulaVersion,"baseline-v1");
  assert.equal(parseAdminCommandResponse("ALLOCATE_CREDIT",{
    grants:[{Id:"bad"}],unallocatedRial:0,formulaVersion:"baseline-v1",
  }),null);
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
