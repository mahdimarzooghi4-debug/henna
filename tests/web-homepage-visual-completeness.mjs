/** Figma WEB buyer homepage frame 190:4: full-page content + image/render audit. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

const base = "http://127.0.0.1:3047";
const sections = [
  ["hero", 'section[aria-labelledby="home-title"]'],
  ["promos", 'section[aria-labelledby="home-title"] + div'],
  ["categories", "#categories"],
  ["offers", "#offers"],
  ["steps", "#how-it-works"],
  ["impact", "#impact"],
  ["benefits", "#benefits"],
  ["cta", 'section[aria-labelledby="final-cta-title"]'],
  ["footer", "#footer"],
];
let server, browser, logs="";
async function serve(){
 server=spawn("npm",["run","start","--workspace","@hana/web-marketplace","--","-p","3047","-H","127.0.0.1"],{
  detached:true,stdio:["ignore","pipe","pipe"],
  env:{...process.env,NEXT_TELEMETRY_DISABLED:"1"}
 });
 server.stdout.on("data",v=>{logs+=v.toString()});
 server.stderr.on("data",v=>{logs+=v.toString()});
 for(let i=0;i<45;i++){
  if(server.exitCode!==null)throw Error("Next exited: "+logs);
  try{if((await fetch(base,{signal:AbortSignal.timeout(1000)})).ok)return}catch{}
  await new Promise(r=>setTimeout(r,1000));
 }
 throw Error("Next did not start: "+logs);
}
async function measure(page,width,label,strict){
 await page.setViewportSize({width,height:900});
 const response=await page.goto(label==="local"?base+"/":label,{waitUntil:"domcontentloaded",timeout:25000});
 await page.locator('section[aria-labelledby="home-title"]').waitFor({timeout:15000});
 const result=await page.evaluate((spec)=>{
  const found=spec.map(([name,sel])=>{
   const el=document.querySelector(sel),r=el?.getBoundingClientRect();
   if(!r)return {name,exists:false};
   const css=getComputedStyle(el);
   return {name,exists:true,x:Math.round(r.x),top:Math.round(r.top+window.scrollY),
    width:Math.round(r.width),height:Math.round(r.height),
    scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,
    overflowY:css.overflowY,visibility:css.visibility,display:css.display};
  });
  const categoryAnchors=Array.from(document.querySelectorAll('#categories a[href^="/categories/"]'));
  const categoryGrid=categoryAnchors[0]?.parentElement;
  const categoryRects=categoryAnchors.map(anchor=>{
   const r=anchor.getBoundingClientRect();
   return {x:Math.round(r.left),right:Math.round(r.right),top:Math.round(r.top+scrollY)};
  });
  return {categoryRects,categoryScrollWidth:categoryGrid?.scrollWidth,
   categoryClientWidth:categoryGrid?.clientWidth,
   viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,
   clientWidth:document.documentElement.clientWidth,documentHeight:document.documentElement.scrollHeight,
   sections:found,categoryCount:document.querySelectorAll('#categories a[href^="/categories/"]').length,
   offerCount:document.querySelectorAll("#offers article").length,
   promoCount:document.querySelectorAll('section[aria-labelledby="home-title"] + div > a').length};
 },sections);
 result.status=response?.status()??null;
 result.url=page.url();
 result.width=width;
 if(strict){
  assert.equal(result.scrollWidth<=result.clientWidth+1,true,"horizontal overflow at "+width);
  assert.equal(result.categoryCount,7,"Figma seven categories");
  if(width<=760){
   assert.equal(result.categoryScrollWidth<=result.categoryClientWidth+1,true,
    "Mobile category links should not require hidden sideways scrolling at "+width);
   for(const cat of result.categoryRects){
    assert.ok(cat.x>=0&&cat.right<=width+1,"All seven categories must be inside viewport at "+width);
   }
   const rows=new Set(result.categoryRects.map(cat=>cat.top));
   assert.ok(rows.size>=2,"All categories must wrap into visible rows at "+width);
  }
  assert.equal(result.offerCount,5,"Figma five preview deals");
  assert.equal(result.promoCount,3,"Figma three promotional cards");
  for(const section of result.sections){
   assert.equal(section.exists,true,"Missing Figma section: "+section.name);
   assert.ok(section.width>100&&section.height>40,section.name+" collapsed at "+width);
   assert.notEqual(section.display,"none",section.name+" hidden at "+width);
   assert.notEqual(section.visibility,"hidden",section.name+" invisible at "+width);
  }
  assert.ok(result.documentHeight>2900,"Homepage terminates before full Figma content at "+width);
  for(let i=1;i<result.sections.length;i++){
   const prev=result.sections[i-1],next=result.sections[i];
   assert.ok(next.top>=prev.top+prev.height-3,
    "Section "+next.name+" overlaps or precedes "+prev.name+" at "+width);
  }
 }
 // Force below-the-fold Next/Image assets to load before screenshot.
 await page.evaluate(()=>{for(const img of document.images){if((img.src.includes("/landing/")||/%2Flanding%2F/i.test(img.src)))img.loading="eager"}});
 try{
  await page.waitForFunction(()=>Array.from(document.images)
   .filter(img=>(img.src.includes("/landing/")||/%2Flanding%2F/i.test(img.src))).every(img=>img.complete&&img.naturalWidth>0),
   null,{timeout:20000});
 }catch{result.imageLoadTimeout=true;}
 result.images=await page.evaluate(()=>Array.from(document.images).filter(img=>(img.src.includes("/landing/")||/%2Flanding%2F/i.test(img.src)))
  .map(img=>({src:img.getAttribute("src")?.slice(0,150),ok:img.complete&&img.naturalWidth>0,
   naturalWidth:img.naturalWidth,width:Math.round(img.getBoundingClientRect().width)})));
 if(strict){
  assert.ok(result.images.length>=13,"Homepage images missing from DOM");
  assert.equal(result.images.every(x=>x.ok),true,"Missing homepage images: "+JSON.stringify(result.images.filter(x=>!x.ok)));
 }
 const file="henna-home-"+(label==="local"?"local":"public")+"-"+width+".jpg";
 await page.screenshot({path:file,fullPage:true,type:"jpeg",quality:65,animations:"disabled"});
 result.screenshot=file;
 console.log("HENNA_HOME_AUDIT "+JSON.stringify(result));
 return result;
}
try{
 await serve();
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900},locale:"fa-IR"});
 const audits=[];
 for(const width of [1440,390,320])audits.push(await measure(page,width,"local",true));
 // Public/Render screenshots are diagnostic only: intermittent CDN access
 // must never mask a regression in the deterministic local browser build.
 for(const host of ["https://henna-stage.onrender.com/","https://hennamarket.ir/","https://www.hennamarket.ir/"]){
  try{audits.push(await measure(page,390,host,false));}
  catch(e){audits.push({url:host,error:String(e).slice(0,260)});}
 }
 writeFileSync("henna-home-completeness.json",JSON.stringify(audits,null,2));
 console.log("Figma 190:4 homepage local structure, content, loaded imagery, and full-page screenshots OK");
}finally{
 if(browser)await browser.close();
 if(server?.pid){try{process.kill(-server.pid,"SIGTERM")}catch{}}
}
