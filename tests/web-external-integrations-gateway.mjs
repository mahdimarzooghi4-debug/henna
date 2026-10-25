import assert from "node:assert/strict";
import { createServer } from "node:https";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temp=mkdtempSync(join(tmpdir(),"henna-integrations-"));
const base="http://127.0.0.1:3055";
const token="hn1_"+Buffer.alloc(32,9).toString("base64url");
let server,web,logs="",calls=0;

async function main(){
  const cert=join(temp,"tls.crt"),key=join(temp,"tls.key");
  assert.equal(spawnSync("openssl",[
    "req","-x509","-newkey","rsa:2048","-nodes","-keyout",key,"-out",cert,
    "-days","1","-subj","/CN=127.0.0.1","-addext","subjectAltName=IP:127.0.0.1",
  ],{stdio:"ignore"}).status,0);

  server=createServer({key:readFileSync(key),cert:readFileSync(cert)},(req,res)=>{
    calls++;
    assert.equal(req.method,"GET");
    assert.equal(req.headers.authorization,"Bearer "+token);
    assert.equal(req.headers.cookie,undefined);
    res.writeHead(200,{"Content-Type":"application/json"});
    if(req.url==="/api/v1/admin/integrations/status"){
      res.end(JSON.stringify({
        sms:{configured:false,requiredForPublicSignIn:true,secret:"hidden"},
        sellerIdentity:{configured:false,
          requiredForNaturalSellerVerification:true},
        payment:{configured:false,requiredForExternalPayment:true},
        ibanOwnership:{configured:false,requiredForWithdrawalOwnership:true},
        logistics:{configured:false,requiredForDelivery:true},
        allExternalReady:false,
        providerSecrets:"never-forward",
      }));
      return;
    }
    assert.equal(req.url,
      "/api/v1/admin/integrations/mono/orders/01234567-89ab-4cde-8fab-0123456789ab/status");
    res.end(JSON.stringify({
      orderId:"01234567-89ab-4cde-8fab-0123456789ab",
      correlationState:"REQUEST_RECEIVED",
      deliveryRequestId:"drq_0123456789abcdef0123456789abcdef",
      providerStatus:"RECEIVED",
      missionId:"mis_0123456789abcdef0123456789abcdef",
      missionStatus:"IN_TRANSIT",
      courierLocation:{latitude:35.7,longitude:51.4,accuracy_meters:8,
        observed_at:new Date().toISOString(),courier_id:"must-not-forward"},
      committedDeliveryAt:null,
      correlationUpdatedAtUtc:"2026-10-25T12:00:00Z",
      correlationRevision:2,
      quote:{quoteId:"qte_test",version:1,expiresAt:"2026-10-25T12:15:00Z",
        isExpired:false,distanceMeters:1500,fareToman:35000,
        buyerShareToman:17500,sellerShareToman:17500},
      promise:null,
      pickup:{address_text:"must-not-forward"},
    }));
  });
  await new Promise(resolve=>server.listen(3485,"127.0.0.1",resolve));

  web=spawn("npm",["run","start","--workspace","@hana/web-marketplace",
    "--","-p","3055","-H","127.0.0.1"],{
      detached:true,stdio:["ignore","pipe","pipe"],
      env:{...process.env,NEXT_TELEMETRY_DISABLED:"1",
        HANA_API_BASE_URL:"https://127.0.0.1:3485",NODE_EXTRA_CA_CERTS:cert},
    });
  web.stdout.on("data",v=>logs+=v);web.stderr.on("data",v=>logs+=v);
  for(let i=0;i<45;i++){
    if(web.exitCode!==null)throw Error(logs);
    try{if((await fetch(base+"/auth")).ok)break;}catch{}
    await new Promise(resolve=>setTimeout(resolve,500));
  }

  assert.equal((await fetch(base+"/api/admin/integrations/status")).status,401);
  assert.equal(calls,0);
  assert.equal((await fetch(base+"/api/admin/integrations/status?x=1",{
    headers:{Cookie:"__Host-hana_session="+token},
  })).status,400);
  assert.equal(calls,0);

  const response=await fetch(base+"/api/admin/integrations/status",{
    headers:{Cookie:"__Host-hana_session="+token},
  });
  assert.equal(response.status,200);
  const body=await response.json();
  assert.deepEqual(body,{
    sms:{configured:false,requiredForPublicSignIn:true},
    sellerIdentity:{configured:false,
      requiredForNaturalSellerVerification:true},
    payment:{configured:false,requiredForExternalPayment:true},
    ibanOwnership:{configured:false,requiredForWithdrawalOwnership:true},
    logistics:{configured:false,requiredForDelivery:true},
    allExternalReady:false,
  });
  assert.equal(JSON.stringify(body).includes("secret"),false);
  assert.equal(calls,1);

  const orderId="01234567-89ab-4cde-8fab-0123456789ab";
  const statusRoute="/api/admin/integrations/mono/order-status";
  assert.equal((await fetch(base+statusRoute+"?orderId="+orderId)).status,401);
  assert.equal(calls,1);
  assert.equal((await fetch(base+statusRoute+"?orderId=bad",{
    headers:{Cookie:"__Host-hana_session="+token},
  })).status,400);
  assert.equal(calls,1);
  const statusResponse=await fetch(base+statusRoute+"?orderId="+orderId,{
    headers:{Cookie:"__Host-hana_session="+token},
  });
  assert.equal(statusResponse.status,200);
  const statusBody=await statusResponse.json();
  assert.equal(statusBody.orderId,orderId);
  assert.equal(statusBody.quote.fareToman,35000);
  assert.deepEqual(statusBody.courierLocation,{latitude:35.7,longitude:51.4,
    accuracyMeters:8,observedAt:statusBody.courierLocation.observedAt});
  assert.equal("courierId" in statusBody.courierLocation,false);
  assert.equal("courier_id" in statusBody.courierLocation,false);
  assert.equal("pickup" in statusBody,false);
  assert.equal(calls,2);
  console.log("External integration readiness and Mono delivery status BFF: auth, no cookie leak and bounded DTO passed.");
}

try{await main();}finally{
  if(web?.pid){try{process.kill(-web.pid,"SIGTERM");}catch{}}
  if(server)await new Promise(resolve=>server.close(resolve));
  rmSync(temp,{recursive:true,force:true});
}
