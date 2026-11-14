import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
 buyerAndroidPreview, sellerAndroidPreview,
} from "../apps/web-marketplace/lib/landing-android-preview.ts";

const page=readFileSync("apps/web-marketplace/app/download/page.tsx","utf8");
const footer=readFileSync("apps/web-marketplace/components/landing-chrome.tsx","utf8");
const expectedBuyer="https://github.com/mahdimarzooghi4-debug/henna/releases/download/hana-buyer-figma-pr239-1c35e62/hana-buyer-preview.apk";
const expectedSeller="https://github.com/mahdimarzooghi4-debug/henna/releases/download/hana-mobile-preview-1783-1/hana-seller-preview.apk";
test("landing footer routes phone visitors to /download, with separately pinned buyer and seller APKs",()=>{
 assert.match(footer,/<Link href="\/download">دریافت اپلیکیشن حنا<\/Link>/);
 assert.equal(buyerAndroidPreview.apk,expectedBuyer);
 assert.equal(sellerAndroidPreview.apk,expectedSeller);
 assert.equal(buyerAndroidPreview.sha,"1c35e62fc3924a73e1d082e581130698fbce6cc2");
 assert.notEqual(buyerAndroidPreview.apk,sellerAndroidPreview.apk);
 for(const app of [buyerAndroidPreview,sellerAndroidPreview]){
  const parsed=new URL(app.apk);
  assert.equal(parsed.protocol,"https:");
  assert.equal(parsed.hostname,"github.com");
  assert.ok(app.details.startsWith("https://github.com/mahdimarzooghi4-debug/henna/releases/tag/"));
 }
 assert.match(page,/android: buyerAndroidPreview\.apk/);
 assert.match(page,/android: sellerAndroidPreview\.apk/);
 assert.match(page,/href=\{app\.android\}/);
 assert.match(page,/href=\{buyerAndroidPreview\.details\}/);
 assert.match(page,/href=\{sellerAndroidPreview\.details\}/);
 assert.doesNotMatch(page,/release\+"\/"\+app\.android/);
});
