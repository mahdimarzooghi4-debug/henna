# Frontend 015 — خانه و مرور کاتالوگ خریدار (Next.js)

## تأیید و مبنا

مالک در همین مرحله هر چهار فریم پیشنهادی Frontend 010 را **صریحاً تأیید کرد**:
- Figma [476:3](https://www.figma.com/design/uREafnhmH5dDRwPraBOmuk/henna-platform?node-id=476-3) — دسکتاپ خالی؛ [476:4](https://www.figma.com/design/uREafnhmH5dDRwPraBOmuk/henna-platform?node-id=476-4) — موبایل خالی.
- Figma [478:2](https://www.figma.com/design/uREafnhmH5dDRwPraBOmuk/henna-platform?node-id=478-2) — دسکتاپ داده‌دار؛ [478:22](https://www.figma.com/design/uREafnhmH5dDRwPraBOmuk/henna-platform?node-id=478-22) — موبایل داده‌دار.

این‌ها چهار فریم خانه و مرور خریدار هستند؛ وب در Frontend 015 و رابط اپ Expo مطابق دو فریم موبایل در [Frontend 016](HANA-FRONTEND-016.md) پیاده‌سازی شده‌اند. برچسب DRAFT روی بوم Figma در Frontend 010 ساخته شده و گزارش وضعیت تاریخی طراحی است.

## مرز واقعی پیاده‌سازی

مسیر `/` در Next به `GET /api/catalog/categories` و `GET /api/catalog/products?page=...&pageSize=20[&categoryId=...][&search=...]` عمومی متصل است. BFF پیشین پاسخ upstream را بدون کوکی و bearer، no-store، با validation و allowlist به مرورگر می‌دهد؛ خود صفحه نیز فقط فیلدهای public catalog را مصرف می‌کند. دسته‌بندی از UUID واقعاً دریافت‌شده انتخاب می‌شود؛ پاک‌کردن آن query param را حذف می‌کند. جست‌وجو (۸۰ نویسه) و تغییر دسته page را به ۱ برمی‌گرداند. دکمه‌های صفحهٔ قبل/بعد فقط مطابق `total/page/pageSize` معتبر فعال هستند. درخواست‌های قدیمی هنگام تغییر فیلتر یا unmount با AbortController منسوخ می‌شوند.

`200 items: []` حالت خالی واقعی است؛ `503`، قطعی و پاسخ نامعتبر همیشه unavailable و «تلاش دوباره» هستند. لیست قبلی در هنگام شروع query تازه دوباره نمایش داده نمی‌شود. categories و products به‌شکل مستقل خطا/تلاش مجدد دارند. در Frontend 015 کارت فقط `name/kind/description` داشت؛ لینک جزئیات در Frontend 018 بعد از تأیید جداگانهٔ شش طرح اضافه شد و URL پایدار فهرست در [Frontend 019](HANA-FRONTEND-019.md) تکمیل گردید. قیمت، موجودی، شهر سرویس‌پذیر، سبد، سفارش و پرداخت از قرارداد public قابل استنباط نیست.

## آزمون و عدم ادعای تولید

- `tests/web-buyer-browse-smoke.mjs` با Node strip-types: parsing محدود به public DTO، عدم نشت private fields، empty واقعی، schema خراب و URL query.
- `tests/web-buyer-browse-browser-smoke.mjs` مرورگر **واقعی Chromium** مقابل build production Next: خالی، محتوای API فقط در CI، صفحه‌بندی، فیلتر UUID، جست‌وجو، ۵۰۳، پاسخ malformed، بازیابی و viewport 390px. Route doubles صرفاً در مرورگر تست هستند، نه کد منتشرشده یا seed production.
- CI وب typecheck/build و BFF tests قبلی؛ backend و mobile job بدون تغییر.

**به‌روزرسانی Frontend 016:** UI مرور اپ خریدار Expo طبق دو فریم موبایل اضافه شد. **باقی‌مانده:** محتوای واقعی تأییدشده از اپراتور، SMS production، پیشنهاد فروشنده، قیمت/موجودی، سبد، سفارش و پرداخت.
