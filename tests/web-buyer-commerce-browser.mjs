/** Actual shipping Next/Chromium interactions with explicitly isolated CI buyer API doubles. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
const base="http://127.0.0.1:3022";
const A="60000000-0000-4000-8000-000000000001",B="60000000-0000-4000-8000-000000000002",SELLER="60000000-0000-4000-8000-000000000003",ADDRESS="60000000-0000-4000-8000-000000000004",GRANT="60000000-0000-4000-8000-000000000005",QUOTE="60000000-0000-4000-8000-000000000006",ORDER="60000000-0000-4000-8000-000000000007";
const product={id:A,categoryId:A,name:"کالای آزمایشی خریدار",kind:"GOOD",description:"شرح آزمون مسیر خرید"};
const cart={id:A,version:1,items:[{productId:B,quantity:1}]};
const qi={offerId:A,productId:A,quantity:2,unitPriceRial:1000,offerVersion:1};
const quote={id:QUOTE,sellerId:SELLER,purchaseType:"PERSONAL",fulfillmentMode:"PICKUP",items:[qi],unavailable:[{productId:B,quantity:1}],itemsTotalRial:2000,expiresAtUtc:new Date(Date.now()+600000).toISOString(),used:false};
let pagedHistory=false,historyPages=[],order=null,firstAttempt=null,orderAttempts=0,web,browser,logs="";
const json=(body,status=200)=>({status,contentType:"application/json",headers:{"Cache-Control":"no-store"},body:JSON.stringify(body)});
async function main(){
 web=spawn("npm",["run","start","--workspace","@hana/web-marketplace","--","-p","3022","-H","127.0.0.1"],{detached:true,stdio:["ignore","pipe","pipe"],env:{...process.env,NEXT_TELEMETRY_DISABLED:"1"}});web.stdout.on("data",b=>logs+=b);web.stderr.on("data",b=>logs+=b);
 for(let i=0;i<45;i++){if(web.exitCode!==null)throw Error(logs);try{if((await fetch(base+"/auth")).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
 browser=await chromium.launch({headless:true});const context=await browser.newContext({locale:"fa-IR",viewport:{width:1440,height:1020}});const page=await context.newPage();page.setDefaultTimeout(10000);const errors=[],requests=[];page.on("pageerror",e=>errors.push(e.message));page.on("request",r=>requests.push(r.url()));
 await context.route("**/api/catalog/products/*",route=>{const id=new URL(route.request().url()).pathname.split("/").at(-1);return route.fulfill(json(id===A?product:{...product,id:B,name:"قلم ناموجود آزمایشی"}));});
 await context.route("**/api/geography/provinces",route=>route.fulfill(json({items:[]})));
 await context.route("**/api/buyer/commerce/**",async route=>{
  const r=route.request(),url=new URL(r.url()),path=url.pathname.replace("/api/buyer/commerce/","");
  if(r.method()==="GET"){
   if(path === "orders" && pagedHistory) { const requested=Number(url.searchParams.get("page"));historyPages.push(requested);return route.fulfill(json(requested === 1 ? Array.from({length:20},(_,i)=>({...order,id:`60000000-0000-4000-8000-${String(i+100).padStart(12,"0")}`})) : [])); }
   const data={cart,comparison:[{sellerId:SELLER,storeName:"فروشگاه آزمایشی",available:[qi],unavailable:quote.unavailable,itemsTotalRial:2000}],addresses:[{id:ADDRESS,cityId:A,text:"نشانی آزمایشی مشتری",latitude:35,longitude:51}],credits:[{id:GRANT,availableRial:10000,expiresAtUtc:new Date(Date.now()+86400000).toISOString(),categoryIds:[A]}],wallet:{balanceRial:0},orders:order?[order]:[],["orders/"+ORDER]:order,offers:[{id:A,sellerId:SELLER,productId:A,priceRial:1000,stock:10,version:1,storeName:"فروشگاه آزمایشی"}]}[path];
   assert.notEqual(data,undefined,"unexpected buyer read: "+path);return route.fulfill(json(data));
  }
  assert.equal(r.headers()["content-type"],"application/json");assert.match(r.headers()["idempotency-key"],/^[a-f0-9-]{36}$/i);const body=r.postDataJSON();
  if(path==="cart-items"){assert.equal(body.expectedVersion,cart.version);cart.version++;const existing=cart.items.find(i=>i.productId===body.productId);if(existing)existing.quantity=body.quantity;else cart.items.push({productId:body.productId,quantity:body.quantity});return route.fulfill(json(cart));}
  if(path==="quotes"){assert.deepEqual(body,{sellerId:SELLER,addressId:ADDRESS,purchaseType:"PERSONAL",fulfillmentMode:"PICKUP"});return route.fulfill(json(quote));}
  if(path==="orders"){
   orderAttempts++;const attempt={key:r.headers()["idempotency-key"],body:r.postData()};
   assert.deepEqual(body,{quoteId:QUOTE,creditGrantId:GRANT,unavailableDisposition:"KEEP",confirmUnavailable:true});
   if(!firstAttempt){firstAttempt=attempt;order={id:ORDER,sellerId:SELLER,state:"PAID",refundState:"NONE",version:1,totalRial:2000,cashPaidRial:0,creditPaidRial:2000,createdAtUtc:new Date().toISOString(),items:[{productId:A,productName:product.name,quantity:2,unitPriceRial:1000}]};cart.items=cart.items.filter(i=>i.productId!==A);cart.version++;return route.fulfill(json({message:"ambiguous response"},503));}
   assert.deepEqual(attempt,firstAttempt,"retry must retain the original command even after quote expiry");return route.fulfill(json(order));
  }
  if(path==="orders/"+ORDER+"/cancel"){assert.equal(body.expectedVersion,order.version);order={...order,state:"CANCELLED",refundState:"REFUNDED",version:order.version+1};return route.fulfill(json(order));}
  if(path==="orders/"+ORDER+"/pickup-confirmation"){assert.equal(body.expectedVersion,order.version);order={...order,state:"COLLECTED",version:order.version+1};return route.fulfill(json(order));}
  throw Error("unexpected buyer write: "+path);
 });
 await page.goto(base+"/products/"+A);await page.getByRole("heading",{name:product.name}).waitFor();await page.getByRole("button",{name:"افزودن به سبد",exact:true}).click();await page.getByText("کالا به سبد اضافه شد.").waitFor();assert.equal(cart.items.find(i=>i.productId===A).quantity,1);
 await page.getByRole("link",{name:"مشاهده سبد خرید"}).click();await page.waitForURL(base+"/cart");await page.getByRole("link",{name:product.name,exact:true}).waitFor();const article=page.locator("article").filter({has:page.getByRole("link",{name:product.name,exact:true})});await article.getByRole("button",{name:"افزایش تعداد"}).click();await page.getByText("سبد به‌روز شد.").waitFor();assert.equal(cart.items.find(i=>i.productId===A).quantity,2);
 await page.getByRole("link",{name:"مقایسه فروشگاه‌ها و ادامه خرید"}).click();await page.waitForURL(base+"/checkout");await page.getByRole("button",{name:"انتخاب این فروشگاه"}).click();await page.getByRole("button",{name:"دریافت پیش‌فاکتور"}).click();await page.getByRole("heading",{name:"بازبینی و ثبت سفارش"}).waitFor();
 await page.getByLabel("اعتبار حمایتی",{exact:true}).selectOption(GRANT);const submit=page.getByRole("button",{name:"ثبت سفارش و کسر مبلغ"});assert.equal(await submit.isDisabled(),true);await page.getByLabel("در سبد بمانند").check();await page.getByLabel("خرید فقط اقلام موجود را تأیید می‌کنم").check();assert.equal(await submit.isEnabled(),true);await submit.click();const retry=page.getByRole("button",{name:"بررسی نتیجه درخواست قبلی"});await retry.waitFor();assert.equal(orderAttempts,1);assert.equal(await page.getByLabel("اعتبار حمایتی",{exact:true}).isDisabled(),true);
 await page.clock.install();await page.clock.fastForward(610000);await page.getByText("پیش‌فاکتور منقضی شده؛ پیش‌فاکتور تازه بگیرید.").waitFor();assert.equal(await retry.isEnabled(),true);await retry.click();await page.waitForURL(base+"/orders/"+ORDER);await page.getByRole("heading",{name:"ثبت شده و پرداخت شده"}).waitFor();assert.equal(orderAttempts,2);
 await page.getByRole("button",{name:"لغو سفارش و بازگشت مبلغ"}).click();await page.getByRole("heading",{name:"لغو شده"}).waitFor();await page.getByText("مبلغ سفارش به منشأ پرداخت برگشت داده شده است.").waitFor();assert.equal(await page.getByRole("button",{name:"لغو سفارش و بازگشت مبلغ"}).count(),0);
 order={...order,state:"READY_FOR_PICKUP",refundState:"NONE",version:3};await page.reload();await page.getByRole("heading",{name:"آماده دریافت حضوری"}).waitFor();const pickup=page.getByRole("button",{name:"تأیید دریافت حضوری"});assert.equal(await pickup.isDisabled(),true);await page.getByLabel("سفارش را از فروشگاه تحویل گرفته‌ام").check();await pickup.click();await page.getByRole("heading",{name:"دریافت شده"}).waitFor();assert.equal(await page.getByRole("button",{name:"لغو سفارش و بازگشت مبلغ"}).count(),0);
 pagedHistory=true;await page.goto(base+"/orders");await page.getByRole("button",{name:"صفحه بعد",exact:true}).waitFor();assert.equal(await page.getByRole("link",{name:"جزئیات سفارش",exact:true}).count(),20);assert.equal(await page.getByRole("button",{name:"صفحه قبل",exact:true}).isDisabled(),true);
 await page.getByRole("button",{name:"صفحه بعد",exact:true}).click();await page.getByText("سفارش دیگری در این صفحه نیست.").waitFor();assert.equal(await page.getByRole("button",{name:"صفحه بعد",exact:true}).isDisabled(),true);await page.getByRole("button",{name:"صفحه قبل",exact:true}).click();await page.getByRole("button",{name:"صفحه بعد",exact:true}).waitFor();assert.equal(await page.getByRole("link",{name:"جزئیات سفارش",exact:true}).count(),20);assert.deepEqual(historyPages,[1,2,1]);
 await page.setViewportSize({width:390,height:970});await page.goto(base+"/cart");await page.getByRole("link",{name:"قلم ناموجود آزمایشی",exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await page.evaluate(()=>[...document.fonts].some(f=>f.family.replaceAll('"','')==="Vazirmatn"&&f.status==="loaded")),true);
 const logo=page.getByRole("img",{name:"حنا",exact:true});await logo.waitFor();const box=await logo.boundingBox();assert.equal(Math.round(box.width),145);assert.equal(Math.round(box.height),48);assert.equal(await logo.evaluate(i=>i.naturalWidth>0),true);assert.equal(requests.some(u=>u.includes("figma.com")),false);
 if(process.env.CI)console.log("HANA_CART_SCREENSHOT="+(await page.screenshot({fullPage:true})).toString("base64"));
 assert.deepEqual(errors,[]);console.log("Buyer browser flow passed: add/cart quantities, quote, explicit partial basket, original-key retry after expiry, order cancellation, real-receipt confirmation, mobile RTL/font/logo.");
}
try{await main();}finally{await browser?.close();if(web?.pid){try{process.kill(-web.pid,"SIGTERM");}catch{}}}
