import assert from "node:assert/strict";
import {chromium} from "playwright";
const base="http://127.0.0.1:3019";
for(let i=0;i<30;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,1000));}
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},locale:"fa-IR"});
 const writes=[];page.on("request",req=>{if(["POST","PUT","PATCH","DELETE"].includes(req.method()))writes.push(req.url());});
 const button=name=>page.getByRole("button",{name,exact:true});
 await page.goto(base);
 await button("ورود").click();await page.getByLabel("شماره موبایل",{exact:true}).fill("09123456789");await button("دریافت کد تأیید").click();await page.getByLabel("کد شش رقمی تأیید",{exact:true}).fill("123456");await button("ورود").click();
 await button("همه پیشنهادها").click();await page.getByTestId("buyer-products-227-8").waitFor();
 await button("فیلترهای جست‌وجو").click();
 await page.getByTestId("buyer-catalog-filter-sheet-842-6377").waitFor();
 await page.getByRole("checkbox",{name:"لبنیات محلی و تخم‌مرغ"}).click();
 await page.getByLabel("حداقل قیمت (تومان)",{exact:true}).fill("۱۰٬۰۰۰");
 await button("نمایش کالاها").click();
 await page.getByText("ماست کم‌چرب پاستوریزه").waitFor();
 assert.equal(await button("افزودن روغن مایع آفتابگردان").count(),0);
 await button("فیلتر پیشرفته").click();
 await button("پاک کردن همه فیلترها").click();
 await button("نمایش کالاها").click();
 await button("افزودن روغن مایع آفتابگردان").click();
 await button("بازگشت به خانه").click();await button("مشاهده همه").click();await page.getByTestId("buyer-products-227-8").waitFor();
 await button("جزئیات برنج طارم ایرانی").click();await button("افزایش تعداد محصول").click();await button("افزودن برنج طارم ایرانی").click();
 await button("سبد خرید").click();await page.getByText("قیمت حدودی سبد:",{exact:true}).waitFor();await page.getByText("۴۳۸٬۰۰۰ تومان",{exact:true}).first().waitFor();
 await button("مقایسه فروشگاه‌ها").click();await page.getByText("پیشنهاد واقعی فروشگاه در دسترس نیست",{exact:true}).waitFor();await button("بازگشت به سبد خرید").click();
 await button("حساب").click();await button("اطلاعات حساب").click();await page.getByLabel("نام و نام خانوادگی",{exact:true}).fill("کاربر نمونه CI");await button("ثبت و ذخیره اطلاعات").click();await page.getByText("کاربر نمونه CI",{exact:true}).waitFor();
 await button("ثبت اطلاعات شرکت").click();await page.getByLabel("نام / عنوان شرکت",{exact:true}).fill("شرکت نمونه CI");await page.getByLabel("شناسه ملی / اطلاعات ثبتی موردنیاز",{exact:true}).fill("10000000000");await page.getByLabel("نشانی ثبت‌شده",{exact:true}).fill("نشانی نمونه");await button("ثبت و ذخیره اطلاعات حقوقی").click();await page.getByText(/اطلاعات شرکت نمونه ذخیره شده است: شرکت نمونه CI/).waitFor();
 await button("آدرس‌های من").click();await button("افزودن آدرس جدید").click();await page.getByLabel("شهر",{exact:true}).fill("تهران");await page.getByLabel("نشانی دقیق پستی",{exact:true}).fill("نشانی نمونه");await page.getByLabel("نام تحویل‌گیرنده",{exact:true}).fill("گیرنده نمونه");await page.getByLabel("تلفن همراه تحویل‌گیرنده",{exact:true}).fill("09123456789");await button("ثبت آدرس و مشخصات").click();await page.getByText("آدرس پیش‌فرض",{exact:true}).waitFor();
 await button("خانه").click();await button("همه پیشنهادها").click();await page.getByTestId("buyer-products-227-8").waitFor();await button("سبد خرید").click();await page.getByText("۴۳۸٬۰۰۰ تومان",{exact:true}).first().waitFor();
 await button("مقایسه فروشگاه‌ها").click();await button("تمرین ادامه خرید با فروشگاه نمونه").click();await button("ادامه ثبت سفارش").click();
 await page.getByRole("checkbox",{name:"خرید حقوقی و دریافت فاکتور رسمی",exact:true}).click();await page.getByText("نام شرکت: شرکت نمونه CI",{exact:true}).waitFor();
 await button("ثبت سفارش نمونه (بدون پرداخت)").click();await page.getByText("سفارش نمونه در تمرین ثبت شد.",{exact:true}).waitFor();await button("پیگیری سفارش نمونه").click();await page.getByText("فقط تمرین ثبت شده",{exact:true}).waitFor();await button("سفارش‌های من").click();await button("مشاهده جزئیات").click();await page.getByText("فقط تمرین ثبت شده",{exact:true}).waitFor();
 assert.deepEqual(writes,[]);console.log("PASS: buyer home both destinations, shared cart, quantity, comparison honest boundary, profile, company and address preview");
}finally{await browser.close();}
