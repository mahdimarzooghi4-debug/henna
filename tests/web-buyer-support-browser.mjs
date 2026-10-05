import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const base="http://127.0.0.1:3051";
const ID="83000000-0000-4000-8000-000000000001";
let web,browser,logs="",ticketAttempts=0,firstTicket=null;
let notificationRead=false,tickets=[];

const json=(body,status=200)=>({
 status,contentType:"application/json",
 headers:{"Cache-Control":"no-store"},body:JSON.stringify(body),
});

async function start(){
 web=spawn("npm",["run","start","--workspace","@hana/web-marketplace",
  "--","-p","3051","-H","127.0.0.1"],{
   detached:true,stdio:["ignore","pipe","pipe"],
   env:{...process.env,NEXT_TELEMETRY_DISABLED:"1"},
 });
 web.stdout.on("data",v=>logs+=v);web.stderr.on("data",v=>logs+=v);
 for(let i=0;i<45;i++){
  if(web.exitCode!==null)throw Error(logs);
  try{if((await fetch(base+"/auth")).ok)return;}catch{}
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 throw Error(logs);
}

async function main(){
 await start();
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({locale:"fa-IR"});
 const page=await context.newPage();
 const pageErrors=[];page.on("pageerror",e=>pageErrors.push(String(e)));

 await page.route("**/api/buyer/commerce/**",async route=>{
  const req=route.request(),url=new URL(req.url());
  const path=url.pathname.replace("/api/buyer/commerce/","");
  if(req.method()==="GET"&&path==="notifications"){
   assert.equal(url.searchParams.get("page"),"1");
   return route.fulfill(json([{
    id:ID,code:"REPLY_TICKET",resourceId:ID,
    createdAtUtc:"2026-10-05T10:00:00Z",read:notificationRead,
   }]));
  }
  if(req.method()==="GET"&&path==="tickets"){
   assert.equal(url.searchParams.get("page"),"1");
   return route.fulfill(json(tickets));
  }
  if(req.method()==="POST"&&path==="tickets"){
   ticketAttempts++;
   const current={
    key:req.headers()["idempotency-key"],
    body:req.postData(),
   };
   assert.match(current.key,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
   if(ticketAttempts===1){
    firstTicket=current;
    return route.fulfill(json({message:"unknown"},503));
   }
   assert.deepEqual(current,firstTicket,
    "reload retry must retain exact support command");
   assert.deepEqual(req.postDataJSON(),{
    subject:"پیگیری سفارش",message:"شرح ثابت برای پشتیبانی",
   });
   const ticket={id:ID,subject:"پیگیری سفارش",
    message:"شرح ثابت برای پشتیبانی",state:"OPEN",
    createdAtUtc:"2026-10-05T10:05:00Z",reply:null};
   tickets=[ticket];
   return route.fulfill(json(ticket));
  }
  if(req.method()==="POST"&&path===`notifications/${ID}/read`){
   assert.deepEqual(req.postDataJSON(),{});
   notificationRead=true;
   return route.fulfill(json({
    id:ID,code:"REPLY_TICKET",resourceId:ID,
    createdAtUtc:"2026-10-05T10:00:00Z",read:true,
   }));
  }
  throw Error("Unexpected buyer account request: "+req.method()+" "+path);
 });

 await page.goto(base+"/account");
 await page.getByRole("heading",{name:"اعلان‌ها و پشتیبانی"}).waitFor();
 await page.getByText("پشتیبانی به تیکت شما پاسخ داد.",{exact:true}).waitFor();

 await page.getByPlaceholder("موضوع درخواست").fill("پیگیری سفارش");
 await page.getByPlaceholder("مسئله را برای پشتیبانی توضیح دهید.")
  .fill("شرح ثابت برای پشتیبانی");
 await page.getByRole("button",{name:"ثبت تیکت"}).click();
 await page.getByText("نتیجه درخواست قطعی نیست",{exact:false}).waitFor();
 assert.equal(ticketAttempts,1);

 await page.reload();
 await page.getByRole("button",{name:"تکرار امن همان درخواست"}).waitFor();
 assert.equal(await page.getByPlaceholder("موضوع درخواست").inputValue(),
  "پیگیری سفارش");
 await page.getByRole("button",{name:"تکرار امن همان درخواست"}).click();
 await page.getByText("تیکت برای پشتیبانی حنا ثبت شد.",{exact:true}).waitFor();
 await page.getByText("پیگیری سفارش",{exact:true}).first().waitFor();
 assert.equal(ticketAttempts,2);

 await page.getByRole("button",{name:"خوانده شد"}).click();
 await page.getByText("اعلان به‌عنوان خوانده‌شده ثبت شد.",{exact:true}).waitFor();
 assert.equal(notificationRead,true);
 assert.equal(await page.getByRole("button",{name:"خوانده شد"}).count(),0);
 assert.deepEqual(pageErrors,[]);

 await context.close();
 console.log("Buyer account Chromium: notification read and durable support ticket retry OK");
}

try{await main();}finally{
 if(browser)await browser.close();
 if(web?.pid){try{process.kill(-web.pid,"SIGTERM");}catch{}}
}
