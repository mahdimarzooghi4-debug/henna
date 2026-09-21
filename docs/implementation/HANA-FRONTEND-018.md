# Frontend 018 — جزئیات عمومی کالا/خدمت در وب و Expo

## تأیید طراحی و محدوده

مالک پس از مشاهدهٔ طرح‌های Frontend 017، با عبارت صریح **«بله تایید میکنم»** هر شش فریم [desktop/mobile published 480:2/480:3، confirmed 404 480:4/480:5، unavailable 480:6/480:7](HANA-FRONTEND-017-DESIGN-PROPOSAL.md) را تأیید کرد. متن «DRAFT / NOT APPROVED» روی بوم، وضعیت تاریخی زمان طراحی است و در UI منتشرشده نشان داده نمی‌شود. این مجوز **فقط جزئیات هویت public published** است نه فریم‌های legacy قیمت/سبد.

## وب — Next.js

- روی کارت منتشرشدهٔ فهرست، لینک قابل‌دسترس به `/products/{id}` واقعی اضافه شد. مسیر جزئیات یک صفحهٔ مستقل Next است: در بازکردن مستقیم URL، برگشت به فهرست، refresh، وضعیت‌های API همگی کار می‌کنند.
- Browser از `GET /api/catalog/products/{id}` با `credentials: omit`، `cache: no-store` و بدون bearer استفاده می‌کند؛ BFF موجود فقط محصول و دستهٔ published را به خروجی allowlisted `id/categoryId/name/kind/description` می‌رساند.
- UUID invalid → محتوای پیدا نشد **بدون** درخواست؛ 404 واقعی → پیدا نشد بدون دکمهٔ retry؛ 503/network/JSON خراب/ID اشتباه در 200 → unavailable با retry. تغییر ID یا ترک route، درخواست قبلی را abort و نتیجهٔ قدیمی را نامعتبر می‌کند.
- متن `description` فقط در صورت وجود نمایش داده می‌شود؛ `categoryId` به‌عنوان شناسه نمایش داده می‌شود، نه به عنوان نام دسته. قیمت، موجودی، فروشنده، تصویر، تحویل، سبد یا checkout وارد رابط نشده‌اند.

## Expo — React Native

- کارت‌های واقعی منتشرشده اکنون `Pressable` با شناسهٔ خود محصولند؛ نمایش جزئیات در همان BrowseScreen با `BuyerProductDetailScreen` مستقل انجام می‌شود تا فیلتر، جست‌وجو و صفحهٔ فهرست هنگام برگشت حفظ شوند. کلید محصول اجازهٔ استفاده از state جزئیات محصول قبلی را نمی‌دهد.
- `MobileCatalogClient.detail(id, signal?)` همان public API مستقیم را می‌خواند؛ `BuyerDetailController` پاسخ‌های 200/404/unavailable و malformed/wrong-ID، retry، supersession و stop را مدیریت می‌کند. خروج یا فشردن Back سخت‌افزاری Android به همان فهرست برمی‌گردد.
- اطلاعات ورود، SecureStore و OTP قبلی دست‌نخورده‌اند و در public detail فراخوانی نمی‌شوند. در اپ به‌جای ساخت عکس یا قیمت نمونه، فقط عنوان/نوع/شناسهٔ دسته/توضیحات منتشرشده دیده می‌شود.

## شواهد CI و مرز ادعا

- `tests/web-buyer-product-detail-smoke.mjs`: UUID، allowlist و shape سخت‌گیرانهٔ DTO و id mismatch.
- `tests/web-buyer-product-detail-browser-smoke.mjs`: Next production + Chromium واقعی با داده‌های ephemeral test؛ لینک فهرست→جزئیات، URL مستقیم، 200/404/503، malformed/wrong ID، retry و viewport 390px.
- `tests/mobile-buyer-product-detail-smoke.mjs`: shipping MobileCatalogClient/BuyerDetailController علیه CI-only mocked HTTP برای 200/404/503، retry، no bearer/price، cancel و نتیجهٔ دیررس.
- همان سه job قبلی backend/web/mobile در CI؛ `tsc --noEmit` و `expo export --platform android` در mobile job؛ **native on-device UI E2E یا iOS release در این مرحله آزموده نشده‌اند**.

**باقی‌ماندهٔ حقیقی:** محتوای production منتشرشده از اپراتور، SMS production، پیشنهاد فروشندهٔ واجدشرایط، قیمت/موجودی، آماده‌سازی شهر و لجستیک، سبد، سفارش و پرداخت. کارت جزئیات به‌تنهایی کالای قابل‌خرید یا سرویس‌پذیری اثبات‌شده نمی‌سازد.
