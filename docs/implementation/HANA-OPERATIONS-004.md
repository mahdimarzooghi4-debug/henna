# Operations 004 — رد فایل بررسی‌شدهٔ مبهم پیش از پیش‌نمایش و اعمال

## مسئله

مسیر اپراتوری کاتالوگ و جغرافیا با SHA-256 دقیق **bytes** (Operations 001)، رسید تراکنشی (002) و هش وضعیت DB مرتبط (003) محافظت شده است؛ اما `System.Text.Json` در حالت معمول اجازهٔ تکرار property در یک JSON object را می‌دهد و **آخرین مقدار** را هنگام deserialize برمی‌گزیند. بنابراین `"state":"DRAFT","state":"PUBLISHED"` می‌توانست با وجود هش کاملاً صحیح همان فایل، بین برداشت انسانی از محتوای بررسی‌شده و اثر اجرایی آن ابهام ایجاد کند. استفاده از `"st\\u0061te"` در raw JSON، همین کلید را به‌شکل escaped پنهان می‌کند.

## قرارداد اجرا

- `ReviewedImportJson.RejectDuplicateProperties` در `Hana.Infrastructure/ImportReview`، JSON را با grammar سخت و حداکثر عمق ۱۲ (مشابه serializer موجود) parse می‌کند و هر object را جداگانه با مجموعهٔ حساس به حروف بزرگ/کوچک `StringComparer.Ordinal` می‌سنجد. برابری روی **نام بازشدهٔ JSON** انجام می‌شود، نه raw spelling؛ بنابراین Unicode escape bypass نمی‌کند.
- در `CatalogImportService` و `GeographyImportService` پس از کنترل سقف ۱ یا ۲ MiB ولی **قبل از deserialize، دسترسی DB، preview digest، mutation، receipt و موفقیت CLI** اجرا می‌شود. شکست به `InvalidDataException` قبلی importer تبدیل می‌شود. هیچ تغییر فرمت فایل معتبر، schema، endpoint HTTP، مدل محصول یا UI نیست.
- تکرار یک کلید در **دو object متفاوت** مشکلی ندارد. `"state"` و `"State"` از نظر تشخیص duplicate دو نام متفاوت‌اند؛ در importer خود فیلد ناشناخته/حساسیت casing به‌صورت جدا بررسی می‌شود. objectهای nested و آرایه‌ها بازگشتی سنجیده می‌شوند؛ کامنت، trailing comma و JSON چسبیدهٔ دوم پذیرفته نمی‌شوند.
- عملیات preview و apply هر دو fail closed هستند؛ pinکردن هش فایلی که ambiguity دارد مجوز انتشار نیست. این کنترل مکمل تأیید انسانی است، نه جایگزین آن، و صحت قیمت/موجودی یا اختیار اپراتور را تأیید نمی‌کند.

## شواهد و محدوده

`ReviewedImportJsonTests` بدون نیاز به DB، root/nested/array/escaped duplicates، key مستقل در object دیگر، casing و JSON ناقص را می‌آزماید. `CatalogImportApiTests` و `GeographyImportApiTests` روی PostgreSQL موقت CI، عدم تغییر وضعیت منتشرشده و شمارش رسید در برابر preview/apply مبهم را بررسی می‌کنند. `.github/workflows/bootstrap.yml` همچنین خود فرمان CLI را با JSON ساختگیِ **فقط CI** و هش صحیح همان فایل مبهم در هر دو مسیر اجرا و شکست preview/apply را الزام می‌کند.

بدون پیامک واقعی، تأیید فروشنده، دادهٔ تولیدی/قیمت، سبد خرید، پرداخت، پنل ادمین و لجستیک؛ هیچ‌کدام در این مرحله ادعا یا ساخته نشده است.
