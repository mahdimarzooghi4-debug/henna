# Frontend 020 — پیوند اختصاصی عمومیِ مرور/جزئیات در اپ Expo

## مرجع تصویری و دامنه

این مرحله **هیچ صفحهٔ بصری تازه‌ای ایجاد نمی‌کند** و صرفاً مسیریابی به صفحهٔ مرور مصوب Frontend 010/016 و سه وضعیت جزئیات مصوب Frontend 017/018 را تکمیل می‌کند. اپ Expo از قبل در `apps/mobile-consumer/app.json` مقدار `"scheme": "hana"` داشت؛ این مرحله parser و lifecycle آن را به همان config وصل می‌کند. در وب، لینک‌های قابل اشتراک URL معمولی Frontend 019 باقی هستند.

## قرارداد عمومی URI

فقط این دو شکل در اپ خوانده می‌شوند:

- `hana://browse?categoryId=<uuid>&search=<text>&page=<1..10000>`
- `hana://products/<uuid>?categoryId=<uuid>&search=<text>&page=<1..10000>`

پارامترها همان قواعد وب را دارند: `search` تا ۸۰ نویسه بدون control؛ `categoryId` UUID غیرصفر؛ `page` ۱..۱۰۰۰۰، پیش‌فرض ۱؛ مقدار نامعتبر به پیش‌فرض امن تبدیل می‌شود. لینک دارای پروتکل دیگر (به‌ویژه `https://` بدون association)، host غیرمجاز، مسیر حساب/ادمین، ID محصول malformed، fragment، اعتبارنامهٔ URI، پارامترهای تکراری، URL بیش از ۴KiB یا مسیر اضافی نادیده گرفته می‌شود. کلیدهای ناشناخته از جمله `returnTo` منتقل نمی‌شوند؛ هیچ دادهٔ شخصی یا bearer/کوکی در URL نگهداری نمی‌شود.

`formatBuyerLink` تنها همین قرارداد را صادر می‌کند؛ این مرحله دکمهٔ Share تأییدنشده یا تبدیل خودکار آدرس عمومی وب به App Link اختراع نمی‌کند. `hana://` یک **custom scheme** است، نه نشانهٔ اثبات مالکیت دامنه یا Universal Link.

## رفتار واقعی

- `App.tsx` قبل از آغاز API مرور، `Linking.getInitialURL()` را بررسی می‌کند؛ باز شدن مستقیم جزئیات با شناسهٔ معتبر، فقط همان `MobileCatalogClient.detail()` و query فهرست مرجع را می‌خواند، نه اینکه ابتدا کارت محصول دیگری را به جای جزئیات نشان دهد. در شروع عادی، صفحهٔ خانه برقرار می‌ماند؛ scheme ناشناخته صفحهٔ ورود را به اشتباه تغییر نمی‌دهد.
- `Linking.addEventListener("url", ...)` برای لینک گرم اضافه شد. لینک سالم هنگام حضور در صفحهٔ ورود فقط کاربر را به **کاتالوگ عمومی** می‌برد؛ نشست موجود را لاگ‌اوت/حذف نمی‌کند و OTP را به لینک نمی‌فرستد. لینک نامعتبر در زمان اجرا نادیده گرفته می‌شود. listener هنگام unmount پاک می‌شود و نتیجهٔ دیررس initialURL روی رویداد زندهٔ قبلی overwrite نمی‌کند.
- `BuyerBrowseController` می‌تواند initial public query را قبل از اولین `list` بگیرد یا query معتبر تازه را با `restoreLocation()` اعمال کند؛ request قبلی abort می‌شود، محصول قبلی در حال loading نشان داده نمی‌شود، نام دسته فقط با فهرست واقعی published تأیید و پس از حذف از انتشار پاک می‌شود. `BuyerBrowseScreen` متن ورودی جست‌وجو را به state مرجع همگام می‌کند و native Back جزئیات را به همان مرور برمی‌گرداند.
- UUID منتشرنشدۀ محصول هنوز از API واقعی `404` می‌گیرد؛ parser هرگز فهرست fake/دادهٔ price/stock برای آن نمی‌سازد.

## شواهد/محدودیت

`tests/mobile-buyer-deep-link-smoke.mjs` خود parser/formatter و coordinator واقعی shipping + `MobileCatalogClient` را با mock HTTP فقط در CI می‌آزماید: round-trip فارسی، بازهٔ صفحه، لینک غیرمجاز، شروع سرد با query صفحهٔ ۲، لینک گرم، لغو پاسخ دیررس، پاک‌شدن دستهٔ حذف‌شده و عدم ارسال bearer/cookie. mobile CI همچنین `npm run mobile:typecheck` و `npm run mobile:export:android` را اجرا می‌کند.

**ادعای این مرحله ساخت APK/iOS release یا انجام آزمون تحویل لینک روی دستگاه نیست.** برای App/Universal Links عادیِ `https://` باید دامنهٔ production، `assetlinks.json`/AASA و امضای نسخهٔ نصب‌شده با دسترسی اپراتوری تهیه و آزمایش شوند. در زمان Frontend 020، Expo Go/Simulator/Android physical device و دریافت واقعی پیامک خارج از شواهد بودند؛ [Frontend 021](HANA-FRONTEND-021.md) بعداً پوشش شبیه‌ساز Android + APK نصب‌شده را اضافه کرد. دستگاه فیزیکی، iOS و دریافت واقعی پیامک هنوز آزمایش نشده‌اند. هیچ تغییر قیمت/موجودی/سبد/پرداخت انجام نشده است.
