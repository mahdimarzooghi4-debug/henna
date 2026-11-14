import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
 buyerAndroidPreview, sellerAndroidPreview,
} from "../apps/web-marketplace/lib/landing-android-preview.ts";

const page=readFileSync("apps/web-marketplace/app/download/page.tsx","utf8");
const footer=readFileSync("apps/web-marketplace/components/landing-chrome.tsx","utf8");
const downloadCss=readFileSync("apps/web-marketplace/app/download/download.module.css","utf8");
const chromeCss=readFileSync("apps/web-marketplace/components/henna-homepage.module.css","utf8");
const expectedBuyer="https://github.com/mahdimarzooghi4-debug/henna/releases/download/hana-buyer-figma-android-032eb3b/hana-buyer-figma-android-preview.apk";
const expectedSeller="https://github.com/mahdimarzooghi4-debug/henna/releases/download/hana-mobile-preview-1783-1/hana-seller-preview.apk";
test("landing footer routes phone visitors to /download, with separately pinned buyer and seller APKs",()=>{
 assert.match(footer,/<Link href="\/download">دریافت اپلیکیشن حنا<\/Link>/);
 assert.equal(buyerAndroidPreview.apk,expectedBuyer);
 assert.equal(sellerAndroidPreview.apk,expectedSeller);
 assert.equal(buyerAndroidPreview.sha,"032eb3bbfeff03503353197343500590d14bd855");
 assert.equal(buyerAndroidPreview.digest,"sha256:54842902338d015848ade7781994a1c1dcba2687b19f4b2408cbc3fa85c4129b");
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

test("download APK directly in the current mobile tab, with visible preview warnings",()=>{
 assert.match(page,/aria-label=\{"دانلود فایل APK اندروید " \+ app\.label\}/);
 assert.match(page,/href=\{app\.android\} referrerPolicy="no-referrer"/);
 assert.doesNotMatch(page,/href=\{app\.android\}[^>]*target="_blank"/);
 assert.match(page,/Problem parsing package/);
 assert.match(page,/خانه، کاتالوگ و فیلترهای نمونه/);
 assert.match(page,/خرید یا پرداخت فعال نیست/);
 assert.match(page,/GitHub Releases/);
 assert.match(page,/className=\{styles\.releaseLinks\}/);
});

test("download and shared site chrome remain usable at phone widths",()=>{
 assert.match(downloadCss,/@media\(max-width:900px\)/);
 assert.match(downloadCss,/@media\(max-width:560px\)/);
 assert.match(downloadCss,/@media\(max-width:360px\)/);
 assert.match(downloadCss,/\.actions\{grid-template-columns:minmax\(0,1fr\)/);
 assert.match(downloadCss,/\.actions a\{width:100%;min-height:50px/);
 assert.match(chromeCss,/@media\(max-width:420px\)/);
 assert.match(chromeCss,/\.chrome \.headerTop\{grid-template-columns:minmax\(0,1fr\) 88px/);
 assert.match(chromeCss,/\.page \.finalCta\{height:auto;min-height:300px;aspect-ratio:auto\}/);
});
