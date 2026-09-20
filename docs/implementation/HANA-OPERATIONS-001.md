# Operations 001 — اتصال تأیید محتوا به هش دقیق فایل قبل از ورود به پایگاه داده

## مسئلهٔ عملیاتی

در Catalog 004 و Geography 003، فرمان preview اطلاعات را از یک مسیر فایل می‌خواند و بعداً apply همان مسیر را دوباره باز می‌کرد. تغییر نامحسوس فایل بین این دو فرمان می‌توانست نسخهٔ **تأییدنشده** را در PostgreSQL ثبت یا منتشر کند. این گام قرارداد CLI هر دو واردکننده را عمداً سخت‌گیرانه می‌کند؛ هدفش حل جابه‌جایی فایل بررسی‌شده است، **نه جعل فرایند تصویب یا مجوز ادمین**.

## فرمان‌های جدید

بعد از `--apply-migrations` و تنظیم connection string DB در secret محیط، اپراتور مجاز برای **هر** فایل مستقل:

```sh
dotnet run --project apps/api/Hana.Api/Hana.Api.csproj -- --catalog-preview /absolute/path/catalog.json
# خروجی موفق: Reviewed input sha256=<64 lowercase hex> و شمارش changes.
# هش را فقط بعد از بررسی دقیق همان فایل و نتیجهٔ preview تأیید کنید.
dotnet run --project apps/api/Hana.Api/Hana.Api.csproj -- --catalog-apply /absolute/path/catalog.json --expected-sha256 <sha256-from-preview> --expected-db-state-sha256 <db-state-hash-from-preview>

dotnet run --project apps/api/Hana.Api/Hana.Api.csproj -- --geography-preview /absolute/path/geography.json
dotnet run --project apps/api/Hana.Api/Hana.Api.csproj -- --geography-apply /absolute/path/geography.json --expected-sha256 <sha256-from-preview> --expected-db-state-sha256 <db-state-hash-from-preview>
```

- `--expected-sha256` برای apply هر دو ماژول **اجباری** است؛ digest باید دقیقاً ۶۴ نویسهٔ hex کوچک باشد. apply بدون آن یا با digest فایل قبلی **قبل از دسترسی نوشتنی DB** رد می‌شود؛ preview با آرگومان اضافی نیز معتبر نیست.
- فایل یک بار باز می‌شود، bytes آن با سقف ۱ MiB برای Catalog یا ۲ MiB برای Geography در حافظهٔ محدود خوانده می‌شود، digest SHA-256 روی **همان bytes** محاسبه و با مقدار مصوب به شکل ثابت‌زمان مقایسه می‌شود؛ JSON نیز فقط از همان snapshot bytes با UTF-8 سخت‌گیرانه رمزگشایی می‌شود. بنابراین تغییر محتوا/space/ترتیب کلیدها بین پیش‌نمایش و apply قابل کشف است.
- پس از تطبیق hash، اعتبارسنجی‌ ردیف‌ها و قیدهای PostgreSQL موجود دوباره اجرا می‌شود؛ import عادی همچنان اتمیک، idempotent، بدون seed و بدون HTTP mutation باقی مانده است.
- هش digest **رمز، امضا، نام تأییدکننده یا مجوز دسترسی به DB نیست**؛ hash صرفاً تأیید یک نسخهٔ مشخص فایل را به اعمال آن نسخه متصل می‌کند. در فرایند تولیدی باید مسئول/زمان تأیید، مسیر امن انتقال فایل، دسترسی محدود به runner و PostgreSQL، محرمانگی log و ثبت تغییرات در audit مستقل برقرار شود. این گام هنوز audit ثبت‌شدهٔ تأییدکننده یا مرجع منبع محتوا را پیاده نمی‌کند. **تطبیق snapshot وضعیت DB بعداً در [Operations 003](HANA-OPERATIONS-003.md) اضافه شد** و اکنون برای apply لازم است.

**نکتهٔ سازگاری:** دستورهای نمونهٔ apply در بالا با هر دو هش لازم برای نسخهٔ فعلی به‌روز شده‌اند؛ هش وضعیت DB از همان preview به دست می‌آید و بعد از هر apply برای اجرای تکراری باید preview تازه گرفت.

## CI واقعی

در GitHub Actions، `--catalog-preview` و `--geography-preview` digest چاپ می‌کنند و CI آن را با `sha256sum` مستقل تطبیق می‌دهد. **برای هر دو واردکننده**، apply بدون digest و apply روی فایل اصلاح‌شده با digest قبلی باید خطا بدهند؛ سپس apply واقعی و تکراری فقط با digest معتبر موفق می‌شوند. آزمون دامنه/HTTP/PostgreSQL و web/mobile قبلی همچنان اجرا می‌شود.

**وضعیت محصول:** هیچ دادهٔ استان، شهر، دسته یا محصول واقعی در production وارد نشده و این تغییر انتشار عمومی، خرید یا پوشش تجاری شهر را فعال نمی‌کند. انتخاب یک محصول یا شهر قابل‌نمایش/انتخاب جایگزین Offer، ظرفیت، قیمت، سفارش، حمل، پرداخت یا مجوز ادمین نیست.
