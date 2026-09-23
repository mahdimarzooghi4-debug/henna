# Operations 003 — قفل‌کردن وضعیت پایگاه داده در پیش‌نمایش واردکننده

## مسئله

Operations 001 ثابت می‌کند نسخهٔ فایل JSON بین `preview` و `apply` عوض نشده؛ Operations 002 هر `apply` موفق را با digest فایل و شمارش تغییرها در همان تراکنش ثبت می‌کند. اما ممکن بود **پایگاه دادهٔ هدف** بعد از پیش‌نمایش تغییر کند: مثلاً استان یا گروه محصول تازه‌ای درج شود یا وضعیت یک شهر/دسته عوض شود. صرف درست‌بودن هش فایل تضمین نمی‌کرد همان اثر پیش‌بینی‌شده اتفاق بیفتد.

## قرارداد جدید هر دو واردکننده

هر `--catalog-preview` و `--geography-preview` اکنون دو خروجی متمایز چاپ می‌کند:

- `Reviewed input sha256=<64-hex>`: digest دقیق bytes فایل، مطابق Operations 001.
- `Reviewed DB state sha256=<64-hex>`: digest وضعیت **رکوردهای DB مرتبط با همان batch** در زمان پیش‌نمایش؛ از شناسه‌ها، slugهای متعارض و مراجع استان/دسته استفاده می‌کند. همهٔ فیلدهای persisted آن ردیف‌ها با ترتیب ثابت در digest حضور دارند.

نمونهٔ شیوهٔ اجرا (دو مقدار هش از خروجی واقعی preview، نه رشتهٔ مثال زیر):

```sh
dotnet run --project apps/api/Hana.Api/Hana.Api.csproj -- --catalog-preview /absolute/path/catalog.json
dotnet run --project apps/api/Hana.Api/Hana.Api.csproj -- --catalog-apply /absolute/path/catalog.json --expected-sha256 <input-hash> --expected-db-state-sha256 <db-state-hash>

dotnet run --project apps/api/Hana.Api/Hana.Api.csproj -- --geography-preview /absolute/path/geo.json
dotnet run --project apps/api/Hana.Api/Hana.Api.csproj -- --geography-apply /absolute/path/geo.json --expected-sha256 <input-hash> --expected-db-state-sha256 <db-state-hash>
```

`--expected-db-state-sha256` برای هر دو فرمان apply **اجباری** است و فقط digest کوچک ۶۴ کاراکتری پذیرفته می‌شود. preview در تراکنش `REPEATABLE READ` وضعیت مربوط به batch را می‌خواند تا نتایج دو query با یک snapshot سازگار باشند. apply بعد از دریافت قفل‌های جدول و قبل از تغییر رکوردها، scope یکسان را دوباره می‌خواند و digest را با مقدار مصوب مقایسه می‌کند. عدم تطابق خطا می‌دهد؛ نه رکوردی اعمال می‌شود و نه رسید «موفق» ثبت می‌شود. با تغییر وضعیت DB باید **دوباره preview و تأیید** کرد، حتی اگر خود فایل تغییر نکرده باشد؛ اعمال تکراریِ بدون تغییر همچنان پس از preview تازه idempotent است.

دامنهٔ digest وضعیت DB عمداً *کل پایگاه داده* یا snapshot مالی/شهر نیست: فقط رکوردهای مرتبطی است که الگوریتم importer برای همان فایل برای تشخیص ID، slug و parent می‌خواند. درج یک محصول یا شهر کاملاً نامرتبط از ورود batch مستقل جلوگیری نمی‌کند. این digest جایگزین تأیید انسانی، مجوز دسترسی، ثبت اثر همهٔ تغییرات جانبی، backup یا کنترل تغییرهای مستقیم خارج از مسیر اپراتوری نیست. قفل در حین apply جلوی رقابت واردکننده‌های عادی را می‌گیرد؛ قواعد مجوز DB باید همچنان مانع نویسندگان خارج از قرارداد باشند.

## شواهد CI

برای کاتالوگ و جغرافیا: preview/sha هر دو چاپ می‌شوند؛ apply بدون هش DB رد می‌شود؛ همان فایل با هش وضعیت DB قدیمی بعد از اعمال اول رد می‌شود؛ preview تازه و اعمال مجدد idempotent موفق می‌شود. تست‌های ماژول روی PostgreSQL واقعی، صحت بازخوانی digest و رد فایل با وضعیت DB قدیمی را همراه با باقی ماندن شمارش receipt کنترل می‌کنند.

**وضعیت محصول:** این تغییر امنیت فرایند ورود مرجع کاتالوگ/مکان را بالا می‌برد، اما دادهٔ production، فعال‌سازی فروشگاه، عرضهٔ قابل خرید و آمادگی خدمت‌رسانی شهر همچنان وجود ندارند.

**پس از Operations 004:** هر دو واردکننده اکنون JSON دارای نام property تکراری را حتی در nested object یا با شکل escaped هم پیش از محاسبهٔ اثر در DB رد می‌کنند؛ توضیح و CI در [Operations 004](HANA-OPERATIONS-004.md) است.
