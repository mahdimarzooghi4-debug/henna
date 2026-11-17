/** Regression: shipped Android catalog stays API-backed; only explicit
 * offline Figma preview APK can show sample products, never real commerce. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { offlineAndroidFigmaPreview } from "../apps/mobile-consumer/src/buyer-figma-preview-mode.ts";

test("only explicitly opted-in offline Android can show Figma sample catalog", () => {
  assert.equal(offlineAndroidFigmaPreview("android", "true", undefined), true);
  assert.equal(offlineAndroidFigmaPreview("android", "true", ""), true);
  for (const platform of ["web","ios","windows"]) {
    assert.equal(offlineAndroidFigmaPreview(platform,"true",undefined),false);
  }
  for(const flag of [undefined,"false","TRUE","1",""]) {
    assert.equal(offlineAndroidFigmaPreview("android",flag,undefined),false);
  }
  for(const api of ["https://api.henna.example","http://localhost:5000","invalid"]) {
    assert.equal(offlineAndroidFigmaPreview("android","true",api),false,
      "Preview cannot coexist with a configured API endpoint");
  }
});

test("preview startup skips auth, real catalog fetch and financial flows", () => {
  const app = readFileSync("apps/mobile-consumer/App.tsx","utf8");
  const browse = readFileSync("apps/mobile-consumer/src/buyer-browse-screen.tsx","utf8");
  assert.match(app, /if \(androidFigmaPreview\) \{[\s\S]*?setIsPreviewSession\(true\);[\s\S]*?setIsSignedIn\(false\);[\s\S]*?setScreen\("browse"\);[\s\S]*?return \(\) =>/);
  assert.match(browse,/if \(!active \|\| designPreview\) \{ controller.stop\(\); return; \}/);
  assert.match(browse,/offlineAndroidFigmaPreview\(Platform.OS/);
  assert.match(browse,/محصولات و قیمت‌ها نمونه‌اند؛ خرید واقعی فعال نیست/);
  assert.match(browse,/پیش‌نمایش طراحی · قیمت‌ها نمونه‌اند؛ خرید واقعی فعال نیست/);
  // The existing commerce route remains a separate authenticated native path.
  assert.match(app,/if \(isPreviewSession\) \{[\s\S]*?ثبت سبد و سفارش به نشست واقعی خریدار نیاز دارد/);
});

test("all Figma checkout payment choices stay visible but isolated from real payments", () => {
  const checkout = readFileSync("apps/mobile-consumer/src/buyer-preview-purchase.tsx","utf8");
  const browse = readFileSync("apps/mobile-consumer/src/buyer-browse-screen.tsx","utf8");
  for(const text of [
    "درگاه آنلاین بانکی",
    "اعتبار حمایتی موجود",
    "اعتبار شخصی تأمین‌شده توسط کاربر",
    "خرید حقوقی و دریافت فاکتور رسمی",
    "مشاهده نتیجه سفارش نمونه (بدون پرداخت)",
    "سفارش نمونه در تمرین ثبت شد.",
    "پیگیری سفارش نمونه",
    "هیچ پرداخت، افزایش اعتبار یا برداشت وجه انجام نمی‌شود.",
  ]) assert.ok(checkout.includes(text), "Missing offline Figma journey text: "+text);
  assert.match(checkout,/onSubmit:\(paymentMethod:PreviewPaymentMethod\)=>void/);
  assert.match(checkout,/disabled=\{count===0\} onPress=\{\(\)=>onSubmit\(paymentMethod\)\}/);
  assert.match(checkout,/disabled=\{legal\}/);
  assert.match(checkout,/accessibilityRole="radio"/);
  assert.match(checkout,/accessibilityRole="checkbox"/);
  assert.match(checkout,/value="پرداخت نشده؛ تمرین"/);
  assert.match(browse,/onSubmit=\{\(paymentMethod\)=>\{if\(count===0\)return;/);
  assert.match(browse,/recipient:address\?\.recipient\?\?"کاربر نمونه \(بدون آدرس\)"/);
  assert.match(browse,/paymentMethod\};setPreviewOrders\(v=>\[\.\.\.v,next\]\)/);
  assert.doesNotMatch(checkout,/MobileCommerceClient|\.placeOrder\(|\.createOrder\(|\.startPayment\(|paymentGateway|wallet\.debit|fetch\(/i,
    "Figma preview screen must not invoke real commerce or payment systems");
});
