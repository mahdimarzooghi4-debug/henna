import assert from "node:assert/strict";
import { createServer } from "node:https";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temp=mkdtempSync(join(tmpdir(),"henna-admin-ops-"));
const base="http://127.0.0.1:3033";
const ID="70000000-0000-4000-8000-000000000001";
const ACCOUNT="70000000-0000-4000-8000-000000000002";
const PROGRAM="70000000-0000-4000-8000-000000000003";
const HOUSEHOLD="70000000-0000-4000-8000-000000000004";
const CATEGORY="70000000-0000-4000-8000-000000000005";
const token="hn1_"+Buffer.alloc(32,7).toString("base64url");
let server,web,logs="",calls=[];

async function main(){
  const cert=join(temp,"tls.crt"),key=join(temp,"tls.key");
  assert.equal(spawnSync("openssl",[
    "req","-x509","-newkey","rsa:2048","-nodes","-keyout",key,"-out",cert,
    "-days","1","-subj","/CN=127.0.0.1","-addext","subjectAltName=IP:127.0.0.1",
  ],{stdio:"ignore"}).status,0);

  server=createServer({key:readFileSync(key),cert:readFileSync(cert)},async(req,res)=>{
    let body="";for await(const chunk of req)body+=chunk;
    calls.push({url:req.url,method:req.method,key:req.headers["idempotency-key"],body});
    assert.equal(req.headers.cookie,undefined);
    assert.equal(req.headers.authorization,"Bearer "+token);
    res.setHeader("Content-Type","application/json");
    if(req.url==="/api/v1/commerce/resources/SUMMARY")
      return res.end(JSON.stringify({orders:5,cancelled:1,collected:2,
        openIncidents:1,preparedSettlements:1,grossRial:9000}));
    if(req.url==="/api/v1/commerce/resources/AUDIT?page=1")
      return res.end(JSON.stringify({page:1,items:[{
        Id:ID,ActorId:ACCOUNT,CommandId:ID,ResourceId:ACCOUNT,
        Event:"SET_STAFF_PERMISSION",CreatedAtUtc:"2026-10-05T05:00:00Z",
      }]}));
    if(req.url==="/api/v1/commerce/resources/PERMISSION?page=1")
      return res.end(JSON.stringify({page:1,pageSize:20,items:[{
        Id:ID,AccountId:ACCOUNT,Permission:"SUPPORT",Active:true,
        Secret:"never-forward",
      }]}));
    if(req.url==="/api/v1/commerce/resources/PROGRAM?page=1")
      return res.end(JSON.stringify({page:1,pageSize:20,items:[{
        Id:PROGRAM,Name:"CI program",FundingReference:"private-funding",
        FundedRial:10000,UnallocatedRial:4000,
        ExpiresAtUtc:"2026-12-05T05:00:00Z",CategoryIds:[CATEGORY],
        OrganizationId:null,
      }]}));
    if(req.url==="/api/v1/commerce/resources/CREDIT?page=1")
      return res.end(JSON.stringify({page:1,pageSize:20,items:[{
        Id:ID,AccountId:ACCOUNT,ProgramId:PROGRAM,GrantedRial:6000,
        AvailableRial:6000,ExpiresAtUtc:"2026-12-05T05:00:00Z",
        CategoryIds:[CATEGORY],HouseholdKey:HOUSEHOLD,
      }]}));
    if(req.url==="/api/v1/commerce/resources/HOUSEHOLD?page=1")
      return res.end(JSON.stringify({page:1,pageSize:20,items:[{
        Id:ID,AccountId:ACCOUNT,HouseholdKey:HOUSEHOLD,
        EvidenceReference:"reviewed-ci",
      }]}));
    if(req.url==="/api/v1/commerce/commands/SET_SELLER_ACCESS"&&req.method==="POST"){
      assert.deepEqual(JSON.parse(body),{
        accountId:ACCOUNT,active:false,reason:"reviewed suspension",
      });
      return res.end(JSON.stringify({
        accountId:ACCOUNT,active:false,reason:"reviewed suspension",
        secret:"never-forward",
      }));
    }
        if(req.url==="/api/v1/commerce/commands/SET_STAFF_PERMISSION"&&req.method==="POST"){
      assert.deepEqual(JSON.parse(body),{
        accountId:ACCOUNT,permission:"SUPPORT",active:false,
      });
      return res.end(JSON.stringify({
        Id:ID,AccountId:ACCOUNT,Permission:"SUPPORT",Active:false,
        Secret:"never-forward",
      }));
    }
    if(req.url==="/api/v1/commerce/commands/LINK_HOUSEHOLD"&&req.method==="POST"){
      assert.deepEqual(JSON.parse(body),{
        accountId:ACCOUNT,householdKey:HOUSEHOLD,evidenceReference:"reviewed-ci",
      });
      return res.end(JSON.stringify({
        Id:ID,AccountId:ACCOUNT,HouseholdKey:HOUSEHOLD,
        EvidenceReference:"reviewed-ci",
      }));
    }
    if(req.url==="/api/v1/commerce/commands/CREATE_PROGRAM"&&req.method==="POST"){
      assert.deepEqual(JSON.parse(body),{
        name:"CI program",fundingReference:"source-ci",fundedRial:10000,
        expiresAtUtc:"2026-12-05T05:00:00.000Z",
        categoryIds:[CATEGORY],organizationId:null,
      });
      return res.end(JSON.stringify({
        Id:PROGRAM,Name:"CI program",FundingReference:"private-funding",
        FundedRial:10000,UnallocatedRial:10000,
        ExpiresAtUtc:"2026-12-05T05:00:00Z",CategoryIds:[CATEGORY],
        OrganizationId:null,
      }));
    }
    if(req.url==="/api/v1/commerce/commands/ALLOCATE_CREDIT"&&req.method==="POST"){
      assert.deepEqual(JSON.parse(body),{
        programId:PROGRAM,poolRial:6000,beneficiaries:[{
          accountId:ACCOUNT,householdKey:HOUSEHOLD,geographicFactor:1.25,
          scores:{health:1,hardship:2,age:0,size:3,care:1,education:2},
        }],
      });
      return res.end(JSON.stringify({
        grants:[{
          Id:ID,AccountId:ACCOUNT,ProgramId:PROGRAM,GrantedRial:6000,
          AvailableRial:6000,ExpiresAtUtc:"2026-12-05T05:00:00Z",
          CategoryIds:[CATEGORY],HouseholdKey:HOUSEHOLD,
        }],
        unallocatedRial:0,formulaVersion:"baseline-v1",
      }));
    }
    res.statusCode=404;res.end(JSON.stringify({error:"missing"}));
  });
  await new Promise(resolve=>server.listen(3463,"127.0.0.1",resolve));

  web=spawn("npm",["run","start","--workspace","@hana/web-marketplace",
    "--","-p","3033","-H","127.0.0.1"],{
      detached:true,stdio:["ignore","pipe","pipe"],
      env:{...process.env,NEXT_TELEMETRY_DISABLED:"1",
        HANA_API_BASE_URL:"https://127.0.0.1:3463",NODE_EXTRA_CA_CERTS:cert},
    });
  web.stdout.on("data",v=>logs+=v);web.stderr.on("data",v=>logs+=v);
  for(let i=0;i<45;i++){
    if(web.exitCode!==null)throw Error(logs);
    try{if((await fetch(base+"/auth")).ok)break;}catch{}
    await new Promise(resolve=>setTimeout(resolve,500));
  }

  const cookie={Cookie:"__Host-hana_session="+token};
  assert.equal((await fetch(base+"/api/admin/operations/summary")).status,401);
  assert.equal(calls.length,0);

  const summary=await fetch(base+"/api/admin/operations/summary",{headers:cookie});
  assert.equal(summary.status,200);
  assert.deepEqual(await summary.json(),{
    orders:5,cancelled:1,collected:2,openIncidents:1,
    preparedSettlements:1,grossRial:9000,
  });

  const permissions=await fetch(base+"/api/admin/operations/permissions?page=1",{headers:cookie});
  assert.equal(permissions.status,200);
  const permissionBody=await permissions.json();
  assert.deepEqual(permissionBody,[{
    id:ID,accountId:ACCOUNT,permission:"SUPPORT",active:true,
  }]);
  assert.equal(JSON.stringify(permissionBody).includes("Secret"),false);

  const programs=await fetch(base+"/api/admin/operations/programs?page=1",{headers:cookie});
  assert.equal(programs.status,200);
  const programBody=await programs.json();
  assert.equal(programBody[0].id,PROGRAM);
  assert.equal(JSON.stringify(programBody).includes("private-funding"),false);
  const credits=await fetch(base+"/api/admin/operations/credits?page=1",{headers:cookie});
  assert.equal(credits.status,200);
  assert.equal((await credits.json())[0].householdKey,HOUSEHOLD);
  const households=await fetch(base+"/api/admin/operations/households?page=1",{headers:cookie});
  assert.equal(households.status,200);
  assert.equal((await households.json())[0].evidenceReference,"reviewed-ci");

  assert.equal((await fetch(base+"/api/admin/operations/audit?page=0",{headers:cookie})).status,400);
  assert.equal((await fetch(base+"/api/admin/operations/constructor",{headers:cookie})).status,404);

  const badOrigin=await fetch(base+"/api/admin/operations/commands/SET_STAFF_PERMISSION",{
    method:"POST",headers:{...cookie,Origin:"https://evil.test",
      "Content-Type":"application/json","Idempotency-Key":ID},
    body:JSON.stringify({accountId:ACCOUNT,permission:"SUPPORT",active:false}),
  });
  assert.equal(badOrigin.status,403);

  const before=calls.length;
  const badKey=await fetch(base+"/api/admin/operations/commands/SET_STAFF_PERMISSION",{
    method:"POST",headers:{...cookie,Origin:base,
      "Content-Type":"application/json","Idempotency-Key":"bad"},
    body:JSON.stringify({accountId:ACCOUNT,permission:"SUPPORT",active:false}),
  });
  assert.equal(badKey.status,400);assert.equal(calls.length,before);

  const changed=await fetch(base+"/api/admin/operations/commands/SET_STAFF_PERMISSION",{
    method:"POST",headers:{...cookie,Origin:base,
      "Content-Type":"application/json","Idempotency-Key":ID},
    body:JSON.stringify({accountId:ACCOUNT,permission:"SUPPORT",active:false}),
  });
  assert.equal(changed.status,200);
  assert.deepEqual(await changed.json(),{
    id:ID,accountId:ACCOUNT,permission:"SUPPORT",active:false,
  });
  assert.equal(calls.at(-1).key,ID);

  const command=(action,body)=>fetch(base+"/api/admin/operations/commands/"+action,{
    method:"POST",headers:{...cookie,Origin:base,
      "Content-Type":"application/json","Idempotency-Key":ID},
    body:JSON.stringify(body),
  });
  const sellerAccess=await command("SET_SELLER_ACCESS",{
    accountId:ACCOUNT,active:false,reason:"reviewed suspension",
    ignored:"secret",
  });
  assert.equal(sellerAccess.status,200);
  const sellerAccessBody=await sellerAccess.json();
  assert.deepEqual(sellerAccessBody,{
    accountId:ACCOUNT,active:false,reason:"reviewed suspension",
  });
  assert.equal(JSON.stringify(sellerAccessBody).includes("secret"),false);

    const linked=await command("LINK_HOUSEHOLD",{
    accountId:ACCOUNT,householdKey:HOUSEHOLD,evidenceReference:"reviewed-ci",
    ignored:"secret",
  });
  assert.equal(linked.status,200);
  assert.equal((await linked.json()).householdKey,HOUSEHOLD);

  const created=await command("CREATE_PROGRAM",{
    name:"CI program",fundingReference:"source-ci",fundedRial:10000,
    expiresAtUtc:"2026-12-05T05:00:00.000Z",
    categoryIds:[CATEGORY],organizationId:null,ignored:"secret",
  });
  assert.equal(created.status,200);
  assert.equal((await created.json()).id,PROGRAM);

  const allocated=await command("ALLOCATE_CREDIT",{
    programId:PROGRAM,poolRial:6000,beneficiaries:[{
      accountId:ACCOUNT,householdKey:HOUSEHOLD,geographicFactor:1.25,
      scores:{health:1,hardship:2,age:0,size:3,care:1,education:2,ignored:3},
      ignored:"secret",
    }],
  });
  assert.equal(allocated.status,200);
  assert.equal((await allocated.json()).grants[0].grantedRial,6000);

  console.log("Admin operations BFF: cookie isolation, CSRF, allowlist, bounded DTO and idempotency passed.");
}

try{await main();}finally{
  if(web?.pid){try{process.kill(-web.pid,"SIGTERM");}catch{}}
  if(server)await new Promise(resolve=>server.close(resolve));
  rmSync(temp,{recursive:true,force:true});
}
