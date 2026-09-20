# Catalog 003 — مشتری موبایل برای خواندن کاتالوگ واقعی

**هدف:** آماده کردن مصرف مستقیم API عمومی Catalog 001 در React Native / Expo، بدون افزودن UI فاقد طرح مصوب Figma و بدون مدل‌سازی قیمت یا موجودی پیش از Offer/Inventory.

## کد تحویل‌شده

- `apps/mobile-consumer/src/mobile-catalog.ts`: مشتری قابل‌استفاده مجدد و مستقل از نشست/OTP/SecureStore برای `GET /api/v1/catalog/categories`، `GET /api/v1/catalog/products` و `GET /api/v1/catalog/products/{id}`. از همان `EXPO_PUBLIC_HANA_API_BASE_URL` فعلی استفاده می‌کند؛ bearer/cookie از برنامه دریافت یا به سرور ارسال نمی‌کند.
- اعتبارسنجی دامنهٔ API در `src/api-base.ts` بین Identity و Catalog مشترک است: production فقط HTTPS، بدون username/password، مسیر اضافی، query و fragment؛ HTTP تنها برای localhost و emulator با گزینهٔ صریح development. تست‌های قبلی OTP/SecureStore همچنان باید پاس شوند.
- دسته‌بندی‌ها و محصولات فقط با فیلدهای مجاز در جواب مشتری ظاهر می‌شوند. price، stock، sellerId، moderation state یا هر فیلد ناشناختهٔ پاسخ بالادست در دادهٔ مصرف‌شدهٔ اپ وجود ندارد. `PUBLISHED` بودن هویت کالا هیچ تضمینی برای قابلیت سفارش نیست.
- پارامترهای فهرست پیش از شبکه بررسی می‌شوند: صفحه ۱ تا ۱۰۰۰۰، اندازه ۱ تا ۵۰، شناسه UUID و جست‌وجو حداکثر ۸۰ نویسه؛ پارامترها URL-encode می‌شوند. timeout هشت‌ثانیه‌ای، `no-store`، `credentials: omit` و `redirect: error` روی درخواست عمومی تنظیم شده‌اند.
- پاسخ معتبر فهرست خالی `{status:"ok",data:{items:[],...}}` است؛ قطعی شبکه، 503، دادهٔ بدساخت یا خطای JSON `{status:"unavailable"}` و جزئیات منتشرنشده/ناموجود `{status:"notFound"}` است؛ هیچ mock catalog در shipping code نیست.

## آزمون‌ها

`tests/mobile-catalog-smoke.mjs` با پاسخ‌های شبکهٔ مصنوعی صرفاً در CI، درخواست‌های بدون credential، فیلتر و جست‌وجو، حذف فیلد قیمت و اطلاعات داخلی، خطاهای invalid/notFound/unavailable، حالت واقعاً خالی، timeout/شبکه ناموجود، URL HTTP غیرمجاز و regression قواعد مشترک Identity را می‌سنجد. اجرای این تست به workflow موبایل اضافه شد و bundle Android و typecheck موجود حفظ شدند.

## محدودیت صریح

**صفحه تازه‌ای در Expo اضافه نشده و کلاینت Catalog هنوز در صفحهٔ خریدار فراخوانی نمی‌شود.** فریم تأییدشدهٔ mobile buyer home/list/detail در [Figma متصل](https://www.figma.com/design/uREafnhmH5dDRwPraBOmuk/henna-platform) موجود نیست؛ این کار فقط مسیر دادهٔ لازم برای پیاده‌سازی آن صفحات را آماده می‌کند. انتشار عملیاتی فهرست نیز به پنل/جریان واقعی مدیریت محتوای کاتالوگ، محصول منتشرشدهٔ معتبر، عرضهٔ فروشنده، قیمت، موجودی و پوشش شهر نیاز دارد. سرویس SMS واقعی هنوز وصل نیست.
