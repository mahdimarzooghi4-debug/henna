/** CI-only HTTPS upstream double; tests the shipping cookie BFF, not bank/SMS readiness. */
import assert from "node:assert/strict";
import { createServer } from "node:https";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const temp = mkdtempSync(join(tmpdir(), "henna-commerce-gateway-"));
const base = "http://127.0.0.1:3021", ID = "60000000-0000-4000-8000-000000000001", token = "hn1_" + Buffer.alloc(32, 8).toString("base64url");
let server, web, logs = "", mode = "ok", calls = [];
async function main() {
 const cert = join(temp, "tls.crt"), key = join(temp, "tls.key");
 assert.equal(spawnSync("openssl", ["req","-x509","-newkey","rsa:2048","-nodes","-keyout",key,"-out",cert,"-days","1","-subj","/CN=127.0.0.1","-addext","subjectAltName=IP:127.0.0.1"], {stdio:"ignore"}).status, 0);
 server = createServer({ key:readFileSync(key), cert:readFileSync(cert) }, async (req,res) => {
  let body = ""; for await (const chunk of req) body += chunk;
  calls.push({url:req.url,method:req.method,key:req.headers["idempotency-key"],body});
  assert.equal(req.headers.cookie, undefined); res.setHeader("Content-Type","application/json");
  if (req.url.startsWith("/api/v1/offers?")) {
   assert.equal(req.headers.authorization, undefined);
   return res.end(JSON.stringify({items:[{id:ID,sellerId:ID,productId:ID,categoryId:ID,priceRial:1000,stock:2,version:1,published:true,storeName:"فروشگاه CI",privateNote:"SECRET"}],page:1,pageSize:20}));
  }
  assert.equal(req.headers.authorization, "Bearer " + token);
  if (mode === "redirect") {res.writeHead(302,{Location:"https://evil.test/"});return res.end();}
  if (mode === "conflict") {res.statusCode=409;return res.end(JSON.stringify({error:"CART_VERSION_CHANGED",privateDetail:"SECRET"}));}
  if (mode === "broken") return res.end(JSON.stringify({items:[{Id:"invalid"}],page:1,pageSize:20}));
  if (mode === "large") return res.end(JSON.stringify({value:"x".repeat(513000)}));
  const cart = {Id:ID,BuyerId:"SECRET",Items:[{ProductId:ID,Quantity:2}],Version:2};
  res.end(JSON.stringify(req.method === "GET" ? {items:[cart],page:1,pageSize:20} : cart));
 });
 await new Promise(r=>server.listen(3449,"127.0.0.1",r));
 web=spawn("npm",["run","start","--workspace","@hana/web-marketplace","--","-p","3021","-H","127.0.0.1"],{detached:true,stdio:["ignore","pipe","pipe"],env:{...process.env,NEXT_TELEMETRY_DISABLED:"1",HANA_API_BASE_URL:"https://127.0.0.1:3449",NODE_EXTRA_CA_CERTS:cert}});
 web.stdout.on("data",b=>logs+=b);web.stderr.on("data",b=>logs+=b);
 for(let i=0;i<45;i++){if(web.exitCode!==null)throw Error(logs);try{if((await fetch(base+"/auth")).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
 const cookie={Cookie:"__Host-hana_session="+token};
 const get=path=>fetch(base+"/api/buyer/commerce/"+path,{headers:cookie});
 const post=(extra={})=>fetch(base+"/api/buyer/commerce/cart-items",{method:"POST",headers:{...cookie,Origin:base,"Content-Type":"application/json","Idempotency-Key":ID,...extra},body:JSON.stringify({productId:ID,quantity:2,expectedVersion:1})});
 assert.equal((await fetch(base+"/api/buyer/commerce/cart")).status,401);assert.equal(calls.length,0);
 assert.equal((await post({Origin:"https://evil.test"})).status,403);assert.equal(calls.length,0);
 assert.equal((await post({"Idempotency-Key":"invalid"})).status,400);assert.equal(calls.length,0);
 assert.equal((await get("admin")).status,404);assert.equal((await get("cart?page=2")).status,400);assert.equal(calls.length,0);
 const publicOffers=await get("offers?productId="+ID);assert.equal(publicOffers.status,200);assert.equal(JSON.stringify(await publicOffers.json()).includes("SECRET"),false);
 assert.equal((await get("offers?productId="+ID+"&productId="+ID)).status,400);
 const own=await get("cart");assert.equal(own.status,200);assert.deepEqual(await own.json(),{id:ID,version:2,items:[{productId:ID,quantity:2}]});assert.equal(own.headers.get("cache-control"),"no-store");
 const changed=await post();assert.equal(changed.status,200);assert.equal(calls.at(-1).key,ID);assert.deepEqual(JSON.parse(calls.at(-1).body),{productId:ID,quantity:2,expectedVersion:1});
 mode="conflict";const conflict=await post();assert.equal(conflict.status,409);const conflictBody=await conflict.json();assert.equal(conflictBody.code,"CART_VERSION_CHANGED");assert.equal(JSON.stringify(conflictBody).includes("SECRET"),false);
 for(const broken of ["broken","large","redirect"]){mode=broken;assert.equal((await get("cart")).status,503);}
 console.log("Shipping buyer BFF passed: cookie isolation, CSRF, route allowlist, bounded DTOs, idempotency and upstream redirects.");
}
try {await main();} finally {if(web?.pid){try{process.kill(-web.pid,"SIGTERM");}catch{}}if(server)await new Promise(r=>server.close(r));rmSync(temp,{recursive:true,force:true});}
