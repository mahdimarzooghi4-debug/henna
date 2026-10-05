import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const base="http://127.0.0.1:3044";
const ID="70000000-0000-4000-8000-000000000001";
const ACCOUNT="70000000-0000-4000-8000-000000000002";
let web,browser,logs="",permissionActive=true,contentVersion=0;
let permissionIntent=null,permissionAttempts=0;

const json=(data,status=200)=>({status,contentType:"application/json; charset=utf-8",
  headers:{"Cache-Control":"no-store"},body:JSON.stringify(data)});

async function start(){
  web=spawn("npm",["run","start","--workspace","@hana/web-marketplace",
    "--","-p","3044","-H","127.0.0.1"],{
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
  const context=await browser.newContext();
  const page=await context.newPage();
  const pageErrors=[];page.on("pageerror",e=>pageErrors.push(String(e)));

  await page.route("**/api/admin/operations/**",async route=>{
    const req=route.request(),url=new URL(req.url()),path=url.pathname;
    if(path==="/api/admin/operations/summary")
      return route.fulfill(json({orders:4,cancelled:1,collected:2,
        openIncidents:1,preparedSettlements:0,grossRial:12000}));
    if(path==="/api/admin/operations/audit")
      return route.fulfill(json([{id:ID,actorId:ACCOUNT,commandId:ID,
        resourceId:ACCOUNT,event:"SET_STAFF_PERMISSION",
        createdAtUtc:"2026-10-05T05:00:00Z"}]));
    if(path==="/api/admin/operations/permissions")
      return route.fulfill(json([{id:ID,accountId:ACCOUNT,
        permission:"SUPPORT",active:permissionActive}]));
    if(path==="/api/admin/operations/content")
      return route.fulfill(json(contentVersion?[{id:ID,slug:"terms",
        title:"شرایط استفاده",text:"متن آزمایشی",published:false,
        version:contentVersion}]:[]));
    if(["organizations","memberships","fee-policies","withdrawals","settlements"]
      .some(k=>path===`/api/admin/operations/${k}`))
      return route.fulfill(json([]));

    if(path==="/api/admin/operations/commands/SET_STAFF_PERMISSION"){
      permissionAttempts++;
      const current={key:req.headers()["idempotency-key"],body:req.postData()};
      if(permissionAttempts===1){
        permissionIntent=current;
        return route.fulfill(json({message:"unknown"},503));
      }
      assert.deepEqual(current,permissionIntent);
      assert.deepEqual(req.postDataJSON(),{
        accountId:ACCOUNT,permission:"SUPPORT",active:false,
      });
      permissionActive=false;
      return route.fulfill(json({id:ID,accountId:ACCOUNT,
        permission:"SUPPORT",active:false}));
    }
    if(path==="/api/admin/operations/commands/SAVE_CONTENT"){
      assert.deepEqual(req.postDataJSON(),{
        slug:"terms",title:"شرایط استفاده",text:"متن آزمایشی",
        expectedVersion:0,
      });
      contentVersion=1;
      return route.fulfill(json({id:ID,slug:"terms",title:"شرایط استفاده",
        text:"متن آزمایشی",published:false,version:1}));
    }
    if(path==="/api/admin/operations/commands/BUILD_SETTLEMENTS"){
      assert.deepEqual(req.postDataJSON(),{});
      return route.fulfill(json([]));
    }
    throw Error("Unexpected admin operation: "+req.method()+" "+path);
  });

  await page.goto(base+"/admin/operations");
  await page.getByRole("heading",{name:"عملیات ادمین"}).waitFor();
  await page.getByText("۱۲٬۰۰۰ ریال",{exact:true}).waitFor();

  await page.getByPlaceholder("UUID حساب").first().fill(ACCOUNT);
  await page.getByLabel("فعال").uncheck();
  await page.getByRole("button",{name:"ثبت مجوز"}).click();
  await page.getByText("نتیجه درخواست قطعی نیست",{exact:false}).waitFor();
  await page.getByRole("button",{name:"ثبت مجوز"}).click();
  await page.getByText("مجوز تخصصی کاربر ثبت شد.",{exact:true}).waitFor();
  assert.equal(permissionAttempts,2);

  await page.getByPlaceholder("slug").fill("terms");
  await page.getByPlaceholder("عنوان").fill("شرایط استفاده");
  await page.getByPlaceholder("متن").fill("متن آزمایشی");
  await page.getByRole("button",{name:"ذخیره محتوا"}).click();
  await page.getByText("محتوا با نسخه جدید ذخیره شد.",{exact:true}).waitFor();
  await page.getByText("شرایط استفاده",{exact:false}).waitFor();

  await page.getByRole("button",{name:"آماده‌سازی تسویه"}).click();
  await page.getByText("انتقال بانکی انجام نشده است",{exact:false}).waitFor();

  assert.deepEqual(pageErrors,[]);
  await context.close();
  console.log("Chromium admin operations: summary, frozen retry, CMS and settlement preparation OK");
}

try{await main();}finally{
  if(browser)await browser.close();
  if(web?.pid){try{process.kill(-web.pid,"SIGTERM");}catch{}}
}
