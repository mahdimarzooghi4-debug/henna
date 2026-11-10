import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const buyer = readFileSync("apps/mobile-consumer/App.tsx","utf8");
const seller = readFileSync("apps/mobile-seller/App.tsx","utf8");
const bcfg=JSON.parse(readFileSync("apps/mobile-consumer/app.json","utf8"));
const scfg=JSON.parse(readFileSync("apps/mobile-seller/app.json","utf8"));

test("buyer preview welcome, phone, code and browse stay isolated from real OTP",()=>{
 const preview = buyer.slice(buyer.indexOf("function ConsumerPreviewAuthScreen"), buyer.indexOf("const blankBrowseLink:"));
 assert.match(preview,/step === "welcome"/);
 assert.match(preview,/accessibilityLabel="ورود"/);
 assert.match(preview,/setStep\("phone"\)/);
 assert.match(preview,/isValidIranianMobile\(phone\)/);
 assert.match(preview,/setStep\("code"\)/);
 assert.match(preview,/validateOtpEntry\(code\)/);
 assert.match(preview,/await onContinue\(\)/);
 assert.equal((preview.match(/<Image /g)||[]).length,1);
 assert.doesNotMatch(preview,/ورود یا ثبت‌نام|تلاش مجدد|خروج|auth\.requestOtp|auth\.verifyOtp|SecureStore/);
 assert.match(buyer,/previewLoginEnabled\s*\? <ConsumerPreviewAuthScreen/);
 assert.match(buyer,/Platform\.OS !== "web"\) await SecureStore\.setItemAsync/);
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
 assert.equal(bcfg.expo.android.adaptiveIcon.backgroundColor,"#FFF2E3");
 assert.match(bcfg.expo.icon,/hana-buyer-icon-only\.png$/);
 assert.match(scfg.expo.icon,/hana-seller-icon-only\.png$/);
});
