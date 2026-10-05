import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const base="http://127.0.0.1:3044";
const ID="70000000-0000-4000-8000-000000000001";
const ACCOUNT="70000000-0000-4000-8000-000000000002";
const PROGRAM="70000000-0000-4000-8000-000000000003";
const HOUSEHOLD="70000000-0000-4000-8000-000000000004";
const CATEGORY="70000000-0000-4000-8000-000000000005";
let web,browser,logs="",permissionActive=true,contentVersion=0;
let programs=[],credits=[],households=[];
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
    if(path==="/api/admin/operations/integrity")
      return route.fulfill(json({
        healthy:true,checkedAtUtc:"2026-10-05T12:00:00Z",
        violationCount:0,truncated:false,violations:[],
        counts:{wallets:1,credits:0,programs:0,orders:4,incidents:1,
          settlements:0,withdrawals:0,evidence:1},
      }));
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
    if(path==="/api/admin/operations/programs") return route.fulfill(json(programs));
    if(path==="/api/admin/operations/credits") return route.fulfill(json(credits));
    if(path==="/api/admin/operations/households") return route.fulfill(json(households));
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
    if(path==="/api/admin/operations/commands/LINK_HOUSEHOLD"){
      assert.deepEqual(req.postDataJSON(),{
        accountId:ACCOUNT,householdKey:HOUSEHOLD,evidenceReference:"reviewed-ui",
      });
      households=[{id:ID,accountId:ACCOUNT,householdKey:HOUSEHOLD,
        evidenceReference:"reviewed-ui"}];
      return route.fulfill(json(households[0]));
    }
    if(path==="/api/admin/operations/commands/CREATE_PROGRAM"){
      const input=req.postDataJSON();
      assert.equal(input.name,"برنامه مرورگر");
      assert.equal(input.fundingReference,"منبع بررسی‌شده");
      assert.equal(input.fundedRial,10000);
      assert.deepEqual(input.categoryIds,[CATEGORY]);
      assert.equal(input.organizationId,null);
      assert.ok(Number.isFinite(Date.parse(input.expiresAtUtc)));
      programs=[{id:PROGRAM,name:"برنامه مرورگر",fundedRial:10000,
        unallocatedRial:10000,expiresAtUtc:input.expiresAtUtc,
        categoryIds:[CATEGORY],organizationId:null}];
      return route.fulfill(json(programs[0]));
    }
    if(path==="/api/admin/operations/commands/ALLOCATE_CREDIT"){
      assert.deepEqual(req.postDataJSON(),{
        programId:PROGRAM,poolRial:6000,beneficiaries:[{
          accountId:ACCOUNT,householdKey:HOUSEHOLD,geographicFactor:1,
          scores:{health:1,hardship:1,age:1,size:1,care:1,education:1},
        }],
      });
      credits=[{id:ID,accountId:ACCOUNT,programId:PROGRAM,
        grantedRial:6000,availableRial:6000,
        expiresAtUtc:programs[0].expiresAtUtc,categoryIds:[CATEGORY],
        householdKey:HOUSEHOLD}];
      programs=[{...programs[0],unallocatedRial:4000}];
      return route.fulfill(json({grants:credits,unallocatedRial:0,
        formulaVersion:"baseline-v1"}));
    }
    throw Error("Unexpected admin operation: "+req.method()+" "+path);
  });

  await page.goto(base+"/admin/operations");
  await page.getByRole("heading",{name:"عملیات ادمین"}).waitFor();
  await page.getByText("۱۲٬۰۰۰ ریال",{exact:true}).waitFor();
  await page.getByText("سازگاری داخلی داده‌ها تأیید شد.",{exact:true}).waitFor();

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
  await page.getByRole("main").getByText("شرایط استفاده",{exact:true}).waitFor();

  await page.getByPlaceholder("UUID حساب مشمول").fill(ACCOUNT);
  await page.getByPlaceholder("UUID خانوار").fill(HOUSEHOLD);
  await page.getByPlaceholder("مرجع مدرک/بررسی").fill("reviewed-ui");
  await page.getByRole("button",{name:"ثبت پیوند خانوار"}).click();
  await page.getByText("پیوند خانوار ثبت شد.",{exact:true}).waitFor();

  await page.getByPlaceholder("نام برنامه").fill("برنامه مرورگر");
  await page.getByPlaceholder("مرجع منبع مالی").fill("منبع بررسی‌شده");
  await page.getByPlaceholder("مبلغ برنامه، ریال").fill("10000");
  await page.getByLabel("زمان انقضای برنامه").fill("2026-12-05T05:00");
  await page.getByPlaceholder("UUID دسته‌ها؛ با فاصله یا ویرگول جدا کنید")
    .fill(CATEGORY);
  await page.getByRole("button",{name:"ایجاد برنامه اعتبار"}).click();
  await page.getByText("برنامه اعتبار ثبت شد",{exact:false}).waitFor();
  await page.getByText("برنامه مرورگر",{exact:false}).waitFor();

  await page.getByPlaceholder("UUID برنامه برای تخصیص").fill(PROGRAM);
  await page.getByPlaceholder("استخر تخصیص، ریال").fill("6000");
  await page.getByLabel("JSON مشمولان").fill(JSON.stringify([{
    accountId:ACCOUNT,householdKey:HOUSEHOLD,geographicFactor:1,
    scores:{health:1,hardship:1,age:1,size:1,care:1,education:1},
  }]));
  await page.getByRole("button",{name:"اجرای تخصیص"}).click();
  await page.getByText("تخصیص اعتبار با فرمول سرور ثبت شد.",{exact:true}).waitFor();
  await page.getByText("۶٬۰۰۰ ریال",{exact:false}).waitFor();

  await page.getByRole("button",{name:"آماده‌سازی تسویه"}).click();
  await page.getByText("انتقال بانکی انجام نشده است",{exact:false}).waitFor();

  assert.deepEqual(pageErrors,[]);
  await context.close();
  console.log("Chromium admin operations: summary, frozen retry, CMS, credit allocation and settlement preparation OK");
}

try{await main();}finally{
  if(browser)await browser.close();
  if(web?.pid){try{process.kill(-web.pid,"SIGTERM");}catch{}}
}
