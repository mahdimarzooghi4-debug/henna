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

const home=readFileSync("apps/mobile-consumer/src/buyer-browse-screen.tsx","utf8");
test("owner frame 194:4 offline browser sample has source assets and no real purchase",()=>{
 assert.match(home,/Platform\.OS === "web" && previewSession &&[\s\S]*?EXPO_PUBLIC_HANA_DEMO_LOGIN === "true" && !process\.env\.EXPO_PUBLIC_HANA_API_BASE_URL/);
 assert.match(home,/پیش‌نمایش طراحی · قیمت‌ها نمونه‌اند؛ خرید واقعی فعال نیست/);
 assert.match(home,/onPress=\{\(\) => changeQuantity\(product.key,1\)\}/);
 assert.match(home,/if \(designPreview\) setPreviewCart/);
 assert.match(home,/showPreview\("cart", \(\) => onCart\(\)\)/);
 assert.match(home,/هیچ سفارش یا پرداخت واقعی ثبت نمی‌شود/);
 assert.match(home,/rgba\(15,91,90,0\.85\)/);
 assert.match(home,/bottomNav: \{ height: 84/);
 for(let n=1;n<=5;n++){
   assert.ok(readFileSync("apps/mobile-consumer/assets/figma/home-product-"+n+".jpg").length>1000);
 }
 const samples=home.slice(home.indexOf("const homeDesignProducts"),home.indexOf("const catalog ="));
 assert.doesNotMatch(samples,/productId|sellerId|inventory|onCart|fetch\(/);
});

test("buyer journey both all actions open the same Figma products destination and retain a single cart",()=>{
 assert.match(home,/accessibilityLabel="همه پیشنهادها" onPress=\{openCatalog\}/);
 assert.match(home,/accessibilityLabel="مشاهده همه" onPress=\{openCatalog\}/);
 assert.match(home,/const openCatalog = \(\) => \{[\s\S]*?setCatalogOpen\(true\)/);
 assert.match(home,/testID="buyer-products-227-8"/);
 assert.match(home,/catalogGrid:\{[^\n]*flexDirection:"row-reverse"/);
 assert.match(home,/onPress=\{\(\)=>changeQuantity\(product.key,1\)\}/);
 assert.match(home,/setPreviewPage\("comparison"\)/);
 assert.equal((home.match(/useState<PreviewCart>/g)||[]).length,1);
});

test("buyer account preview is isolated and every account destination has an explicit page",()=>{
 const account=readFileSync("apps/mobile-consumer/src/buyer-preview-account.tsx","utf8");
 assert.match(home,/designPreview \? setPreviewPage\("account"\)/);
 for(const route of ["account","profile","company","addresses","wallet","social","support","notifications","orders"]){assert.ok(account.includes('page==="'+route+'"'),route);}
 assert.match(account,/setState\(v=>\(\{\.\.\.v,company:/);
 assert.doesNotMatch(account,/fetch\(|localStorage|sessionStorage|SecureStore/);
});
