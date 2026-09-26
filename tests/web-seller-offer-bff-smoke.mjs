// CI-only HTTPS upstream for Seller Offer BFF; no real seller data or credentials.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:https";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const productId="123e4567-e89b-42d3-a456-426614174000";
const offerId="123e4567-e89b-42d3-a456-426614174003";
const mediaId="123e4567-e89b-42d3-a456-426614174004";
const keyId="123e4567-e89b-42d3-a456-426614174001";
const token="hn1_"+"A".repeat(43);
const at="2026-09-26T10:00:00+00:00";
const dir=mkdtempSync(join(tmpdir(),"hana-offer-bff-"));
const cert=join(dir,"cert.pem"), privateKey=join(dir,"key.pem");
let server, next, output="", calls=0;

try {
  const certResult=spawnSync("openssl",["req","-x509","-newkey","rsa:2048",
    "-nodes","-keyout",privateKey,"-out",cert,"-days","1",
    "-subj","/CN=127.0.0.1","-addext","subjectAltName=IP:127.0.0.1"],
    {stdio:"ignore"});
  assert.equal(certResult.status,0);
  server=createServer({cert:readFileSync(cert),key:readFileSync(privateKey)},
    async(req,res)=>{
      calls++;
      assert.equal(req.headers.cookie,undefined,"cookie must not be forwarded");
      assert.equal(req.headers.authorization,"Bearer "+token);
      res.setHeader("Content-Type","application/json");
      res.setHeader("Cache-Control","no-store");
      if(req.method==="GET"&&req.url==="/api/v1/seller/offers"){
        res.writeHead(200);
        res.end(JSON.stringify({items:[{
          id:offerId,catalogProductId:productId,status:"DRAFT",revision:1,
          createdAtUtc:at,updatedAtUtc:at,
          catalogProduct:{id:productId,name:"کالای آزمون",
            categoryName:"دسته آزمون",description:null,
            primaryMediaRoute:"/api/v1/catalog/media/"+mediaId}
        }]}));
        return;
      }
      if(req.method==="POST"&&req.url==="/api/v1/seller/offers"){
        assert.equal(req.headers["idempotency-key"],keyId);
        let raw="";
        for await(const part of req) raw+=part.toString();
        assert.deepEqual(JSON.parse(raw),{catalogProductId:productId});
        res.writeHead(201);
        res.end(JSON.stringify({id:offerId,catalogProductId:productId,
          status:"DRAFT",revision:1,createdAtUtc:at,updatedAtUtc:at}));
        return;
      }
      res.writeHead(404);res.end("{}");
    });
  await new Promise(resolve=>server.listen(5202,"127.0.0.1",resolve));
  next=spawn("npm",["run","start","--workspace","@hana/web-marketplace",
    "--","-p","3003","-H","127.0.0.1"],{detached:true,
    stdio:["ignore","pipe","pipe"],env:{...process.env,
      NODE_EXTRA_CA_CERTS:cert,HANA_API_BASE_URL:"https://127.0.0.1:5202",
      NEXT_TELEMETRY_DISABLED:"1"}});
  next.stdout.on("data",p=>output+=p.toString());
  next.stderr.on("data",p=>output+=p.toString());
  const base="http://127.0.0.1:3003";
  let ready=false;
  for(let n=0;n<45;n++){
    if(next.exitCode!==null) break;
    try{if((await fetch(base+"/auth",{signal:AbortSignal.timeout(1000)})).ok){
      ready=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  assert.ok(ready,"Next did not start: "+output);
  const cookie="__Host-hana_session="+token;
  const listed=await fetch(base+"/api/seller/offers",{headers:{Cookie:cookie}});
  assert.equal(listed.status,200);
  assert.equal(listed.headers.get("cache-control"),"no-store");
  const list=await listed.json();
  assert.equal(list.items.length,1);
  assert.deepEqual(list.items[0].catalogProduct,{
    id:productId,name:"کالای آزمون",categoryName:"دسته آزمون",
    description:null,primaryMediaRoute:"/api/v1/catalog/media/"+mediaId});
  const created=await fetch(base+"/api/seller/offers",{method:"POST",
    headers:{Cookie:cookie,Origin:base,"Content-Type":"application/json",
      "Idempotency-Key":keyId},
    body:JSON.stringify({catalogProductId:productId})});
  assert.equal(created.status,201);
  assert.equal(created.headers.get("cache-control"),"no-store");
  const createdBody=await created.json();
  assert.equal(createdBody.catalogProductId,productId);
  assert.equal(createdBody.catalogProduct,null);
  const callsBefore=calls;
  assert.equal((await fetch(base+"/api/seller/offers?accountId=x",
    {headers:{Cookie:cookie}})).status,400);
  assert.equal((await fetch(base+"/api/seller/offers",{method:"POST",
    headers:{Cookie:cookie,Origin:"https://malicious.test",
      "Content-Type":"application/json","Idempotency-Key":keyId},
    body:JSON.stringify({catalogProductId:productId})})).status,403);
  assert.equal((await fetch(base+"/api/seller/offers",{method:"POST",
    headers:{Cookie:cookie,Origin:base,"Content-Type":"application/json",
      "Idempotency-Key":keyId},
    body:JSON.stringify({catalogProductId:productId,name:"untrusted"})})).status,400);
  assert.equal((await fetch(base+"/api/seller/offers")).status,401);
  assert.equal(calls,callsBefore,"rejected requests must not reach upstream");
  console.log("Seller Offer BFF CI: cookie isolation, bearer and idempotency forwarding, DTO allowlist, same-origin, no-store and rejection paths OK");
} finally {
  if(next?.pid){try{process.kill(-next.pid,"SIGTERM")}catch{}}
  if(server) await new Promise(resolve=>server.close(resolve));
  rmSync(dir,{recursive:true,force:true});
}
