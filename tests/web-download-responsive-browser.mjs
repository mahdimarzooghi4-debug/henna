/** Real Chromium regression: direct buyer/seller APK URLs and mobile layout. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const base="http://127.0.0.1:3023";
const buyer="https://github.com/mahdimarzooghi4-debug/henna/releases/download/hana-buyer-figma-pr239-1c35e62/hana-buyer-preview.apk";
const seller="https://github.com/mahdimarzooghi4-debug/henna/releases/download/hana-mobile-preview-1783-1/hana-seller-preview.apk";
let server, browser, logs="";
async function startWeb(){
 server=spawn("npm",["run","start","--workspace","@hana/web-marketplace","--","-p","3023","-H","127.0.0.1"],{
  detached:true,stdio:["ignore","pipe","pipe"],
  env:{...process.env,NEXT_TELEMETRY_DISABLED:"1"},
 });
 server.stdout.on("data",b=>{logs+=b.toString();});
 server.stderr.on("data",b=>{logs+=b.toString();});
 for(let n=0;n<45;n++){
  if(server.exitCode!==null) throw Error("Next exited: "+logs);
  try{if((await fetch(base+"/download",{signal:AbortSignal.timeout(1000)})).ok)return;}catch{}
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 throw Error("Next not ready: "+logs);
}
async function main(){
 await startWeb();
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900},locale:"fa-IR"});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 for(const width of [320,360,390,560,768,900,1440]){
  await page.setViewportSize({width,height:900});
  await page.goto(base+"/download");
  await page.getByTestId("download-app-page").waitFor();
  const buyerLink=page.getByTestId("download-android-buyer");
  const sellerLink=page.getByTestId("download-android-seller");
  assert.equal(await buyerLink.getAttribute("href"),buyer);
  assert.equal(await sellerLink.getAttribute("href"),seller);
  assert.equal(await buyerLink.getAttribute("target"),null,"Android download stays in the same tab");
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,
    "horizontal overflow on /download at "+width);
  const rect=await buyerLink.boundingBox();
  assert.ok(rect && rect.x>=0 && rect.x+rect.width<=width+1 && rect.height>=44,
    "buyer download must be touchable within viewport at "+width);
  assert.equal(await page.getByRole("heading",{name:"دریافت اپلیکیشن حنا"}).isVisible(),true);
 }
 for(const width of [320,390,760]){
  await page.setViewportSize({width,height:900});
  await page.goto(base+"/");
  const cta=page.getByRole("heading",{name:"حنا؛ بازارگاه گرم و عادلانه محله شما"});
  await cta.waitFor();
  assert.equal(await cta.isVisible(),true,"mobile home CTA visible at "+width);
  const ctaLink=page.getByRole("link",{name:"شروع پر کردن سبد خرید"});
  const rect=await ctaLink.boundingBox();
  assert.ok(rect && rect.height>=44 && rect.width>=100 && rect.x>=0 && rect.x+rect.width<=width+1,
    "mobile CTA action touchable and not clipped at "+width);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,
    "horizontal overflow on homepage at "+width);
 }
 assert.deepEqual(errors,[]);
 console.log("Buyer/seller APK links and 320/360/390/560/768/900/1440px responsive layouts passed");
}
try{await main();}
finally{
 if(browser)await browser.close();
 if(server?.pid){try{process.kill(-server.pid,"SIGTERM");}catch{}}
}
