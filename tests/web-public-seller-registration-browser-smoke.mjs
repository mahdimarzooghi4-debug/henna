/** Real Chromium interaction with a CI-only API double; no buyer session. */
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {chromium} from "playwright";

const base="http://127.0.0.1:3021";
const receipt={status:"RECEIVED",trackingCode:"HNA-P-112233445566AABB",
  submittedAtUtc:"2026-11-11T12:00:00Z"};
let web,logs="",submitted=0,authCalls=0;
async function start(){
  web=spawn("npm",["run","start","--workspace","@hana/web-marketplace","--",
    "-p","3021","-H","127.0.0.1"],{
    detached:true,stdio:["ignore","pipe","pipe"],
    env:{...process.env,NEXT_TELEMETRY_DISABLED:"1"},
  });
  web.stdout.on("data",chunk=>logs+=chunk.toString());
  web.stderr.on("data",chunk=>logs+=chunk.toString());
  for(let i=0;i<45;i++){
    if(web.exitCode!==null)throw Error("Next exited before ready: "+logs);
    try{
      const r=await fetch(base+"/seller/register",{signal:AbortSignal.timeout(1500)});
      if(r.ok)return;
    }catch{}
    await new Promise(done=>setTimeout(done,1000));
  }
  throw Error("Next not ready: "+logs);
}

let browser;
try{
  await start();
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1365,height:900},
    locale:"fa-IR"});
  const page=await context.newPage();
  page.setDefaultTimeout(15000);
  const pageErrors=[];
  page.on("pageerror",e=>pageErrors.push(e.message));
  await page.route("**/api/**",route=>{
    const request=route.request(), url=new URL(request.url());
    if(url.pathname.startsWith("/api/auth/")){
      authCalls++;
      return route.fulfill({status:401,contentType:"application/json",
        body:JSON.stringify({authenticated:false})});
    }
    if(url.pathname==="/api/seller/public-registration/status"){
      return route.fulfill({status:submitted>0?200:401,contentType:"application/json",
        body:JSON.stringify(submitted>0?receipt:{message:"رسید قبلی وجود ندارد."})});
    }
    if(url.pathname==="/api/seller/public-registration"){
      assert.equal(request.method(),"POST");
      const body=request.postDataJSON();
      assert.equal(body.storeName,"فروشگاه آزاد");
      assert.equal(body.applicantType,"NATURAL");
      assert.equal(body.offeringType,"GOOD");
      assert.equal(body.confirmed,true);
      assert.equal(body.sellerDelivery,true);
      assert.equal(body.pickup,false);
      submitted++;
      return route.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify(receipt)});
    }
    return route.fulfill({status:404,contentType:"application/json",body:"{}"});
  });

  await page.goto(base+"/seller/register");
  await page.getByRole("heading",{name:"ثبت‌نام فروشنده / ارائه‌دهنده"}).waitFor();
  await page.getByRole("heading",{name:"امکانات پنل فروشنده / ارائه‌دهنده"}).waitFor();
  assert.equal(await page.getByRole("link",{name:"ورود به حساب کاربری"}).count(),1,
    "Login may be offered but cannot be a prerequisite");
  await page.getByRole("link",{name:"شروع ثبت‌نام جدید"}).click();
  await page.waitForURL(base+"/seller/register/new");
  await page.getByRole("heading",{name:"نوع متقاضی",exact:true}).waitFor();
  assert.equal(await page.getByText("برای ذخیره پیش‌نویس ابتدا").count(),0);
  await page.getByRole("button",{name:"ادامه"}).click();
  await page.getByRole("alert").getByText("نوع متقاضی را انتخاب کنید.").waitFor();
  await page.getByLabel("شخص حقیقی").check();
  await page.getByRole("button",{name:"ادامه"}).click();
  await page.getByRole("heading",{name:"احراز هویت",exact:true}).waitFor();
  await page.locator('[name="ownerName"]').fill("مسئول آزمایشی");
  await page.locator('[name="phone"]').fill("09123456789");
  await page.getByLabel("متوجه هستم ثبت اطلاعات به معنای احراز هویت نیست.").check();
  await page.getByRole("button",{name:"ادامه"}).click();

  await page.getByRole("heading",{name:"اطلاعات کسب‌وکار"}).waitFor();
  for(const [key,val] of Object.entries({
    storeName:"فروشگاه آزاد",city:"تهران",address:"نشانی آزمایشی",
    postalCode:"1234567890",businessName:"آزمایش فروشندگی",
    businessDescription:"فروش و ارائه کالاهای آزمایشی",
  }))await page.locator('[name="'+key+'"]').fill(val);
  await page.getByLabel("کالا", {exact:true}).check();
  await page.getByRole("button",{name:"ادامه"}).click();

  await page.getByRole("heading",{name:"محدوده فعالیت"}).waitFor();
  for(const [key,val] of Object.entries({
    activityAddress:"نشانی فعالیت آزمایشی",activityHours:"۹ تا ۱۷",
    serviceArea:"تهران",
  }))await page.locator('[name="'+key+'"]').fill(val);
  await page.getByLabel("ارسال توسط فروشگاه").check();
  await page.getByRole("button",{name:"ادامه"}).click();
  await page.getByRole("heading",{name:"اطلاعات تکمیلی"}).waitFor();
  await page.locator('[name="registrationContactName"]').fill("مسئول آزمایشی");
  await page.locator('[name="responseHours"]').fill("۹ تا ۱۷");
  await page.getByRole("button",{name:"ادامه"}).click();

  await page.getByRole("heading",{name:"بازبینی و ثبت"}).waitFor();
  const submit=page.getByRole("button",{name:"ثبت نهایی درخواست"});
  assert.equal(await submit.isDisabled(),true);
  await page.getByLabel("صحت اطلاعاتی را که خودم وارد کرده‌ام تأیید می‌کنم.").check();
  await submit.click();
  await page.getByRole("heading",{name:"درخواست ثبت‌نام دریافت شد"}).waitFor();
  await page.getByText(receipt.trackingCode).waitFor();
  assert.equal(submitted,1,"public application submitted once");
  assert.equal(authCalls,0,"never ask for buyer auth to submit");
  await page.getByRole("link",{name:"مشاهده رسید درخواست در همین مرورگر"}).click();
  await page.waitForURL(base+"/seller/register/public-status");
  await page.getByRole("heading",{name:"درخواست همکاری دریافت شده است"}).waitFor();

  const mobile=await context.newPage();
  await mobile.setViewportSize({width:390,height:850});
  await mobile.goto(base+"/seller/register");
  await mobile.getByRole("link",{name:"شروع ثبت‌نام جدید"}).waitFor();
  assert.equal(await mobile.locator("html").evaluate(e=>e.scrollWidth<=window.innerWidth),
    true,"mobile seller Start must not overflow horizontally");
  // Figma 282:8 -> 282:68 -> 282:119, in a real 390px mobile viewport.
  await mobile.getByRole("link",{name:"شروع ثبت‌نام جدید"}).click();
  await mobile.waitForURL(base+"/seller/register/new");
  const progress=mobile.getByRole("navigation",{
    name:"پیشرفت ثبت‌نام فروشنده در موبایل",
  });
  assert.equal(await progress.locator("div").first().locator("span").count(),8,
    "the mobile registration progress must have eight Figma stages");
  await progress.getByText("مرحله ۲ از ۸").waitFor();
  assert.equal(await mobile.locator("html").evaluate(e=>e.scrollWidth<=window.innerWidth),
    true,"mobile applicant cards must fit without horizontal scrolling");
  await mobile.getByLabel("شخص حقوقی").check();
  assert.equal(await mobile.getByLabel("شخص حقوقی").isChecked(),true);
  await mobile.getByLabel("شخص حقیقی").check();
  assert.equal(await mobile.getByLabel("شخص حقیقی").isChecked(),true);
  await mobile.getByRole("button",{name:"ادامه"}).click();
  await mobile.getByRole("heading",{name:"احراز هویت",exact:true}).waitFor();
  await progress.getByText("مرحله ۳ از ۸").waitFor();
  assert.equal(await mobile.locator("html").evaluate(e=>e.scrollWidth<=window.innerWidth),
    true,"mobile identity step must remain inside 390px viewport");
  assert.deepEqual(pageErrors,[],"browser runtime errors");
  console.log("PASS public seller Figma start, account-free intake and receipt");
} finally {
  if(browser)await browser.close().catch(()=>{});
  if(web?.pid)process.kill(-web.pid,"SIGTERM");
}
