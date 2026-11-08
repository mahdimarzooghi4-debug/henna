import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const buyer = readFileSync("apps/mobile-consumer/App.tsx","utf8");
const seller = readFileSync("apps/mobile-seller/App.tsx","utf8");
const bcfg=JSON.parse(readFileSync("apps/mobile-consumer/app.json","utf8"));
const scfg=JSON.parse(readFileSync("apps/mobile-seller/app.json","utf8"));

test("buyer preview puts no-SMS entry ahead of real OTP and keeps SecureStore logout",()=>{
 assert.match(buyer,/previewLoginEnabled && \(view === "phone" \|\| view === "offline"\)/);
 assert.match(buyer,/view === "phone" && !previewLoginEnabled/);
 assert.match(buyer,/accessibilityLabel="ورود آزمایشی بدون پیامک"/);
 assert.match(buyer,/SecureStore\.setItemAsync\(previewSessionKey/);
 assert.match(buyer,/SecureStore\.deleteItemAsync\(previewSessionKey/);
 assert.match(buyer,/onCart=\{\(id\) => \{[\s\S]*?if \(isPreviewSession\)/);
});
test("seller preview never presents itself as authorized shop or shows private orders",()=>{
 assert.match(seller,/sellerPreviewAllowed/);
 assert.match(seller,/if \(flag === "v1"\)/);
 assert.match(seller,/setGate\(\{ kind: "preview" \}\); \/\/ Deliberately no identity/);
 assert.match(seller,/gate\.kind === "preview"/);
 assert.match(seller,/هیچ فروشنده‌ای احراز هویت نشده است/);
 assert.match(seller,/SecureStore\.deleteItemAsync\(previewKey/);
 assert.match(seller,/!sellerPreviewAllowed && \(otpStep === "phone"/);
});
test("status bar icons use dark content against light surfaces",()=>{
 assert.match(buyer,/<StatusBar barStyle="dark-content" backgroundColor=\{colors\.cream\} translucent=\{false\}/);
 assert.match(seller,/<StatusBar barStyle="dark-content" backgroundColor="#FAF8F5" translucent=\{false\}/);
 assert.equal(bcfg.expo.androidStatusBar.barStyle,"dark-content");
 assert.equal(scfg.expo.androidStatusBar.barStyle,"dark-content");
 assert.equal(scfg.expo.android.adaptiveIcon.backgroundColor,"#055247");
});
