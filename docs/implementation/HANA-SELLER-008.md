# Seller 008 — مرحله ۴ ثبت‌نام: اطلاعات کسب‌وکار

## مبنای Figma

- Desktop: `SELLER REG / WEB / 04 Business Info` — node `277:564`
- Mobile: `SELLER REG / APP / 04 Business Info` — node `282:232`

فیلدهای طراحی:
- دسته‌بندی کسب‌وکار
- نام فروشگاه / کسب‌وکار / عنوان ارائه‌دهنده
- توضیح کوتاه فعالیت
- شماره تماس کسب‌وکار
- نوع ارائه: کالا / خدمت / کالا و خدمت
- ذخیره و ادامه

## مرز دامنه دسته‌بندی

Figma و اسناد فعلی هیچ فهرست مصوبی از دسته‌بندی‌های کسب‌وکار تعریف نکرده‌اند. این دسته‌بندی با Catalog product categories یکی نیست و از آن حدس زده نمی‌شود.

بنابراین Seller 008 یک reference مستقل ایجاد می‌کند:

`seller.business_categories`

- identity پایدار Guid
- نام یکتا و non-empty
- `is_active`
- بدون seed پیش‌فرض
- بدون HTTP writer
- فقط category فعال در فرم جدید قابل انتخاب است
- draft قبلی اگر بعداً category آن غیرفعال شود، نام ذخیره‌شدهٔ reference را برای review همچنان قابل بازیابی دارد

اگر taxonomy خالی باشد، API read پاسخ `configured=false` می‌دهد و UI هیچ گزینه نمونه‌ای تولید نمی‌کند. مرحله ۴ fail-closed می‌ماند.

## provisioning بازبینی‌شده

برای اینکه production به دستکاری مستقیم DB وابسته نباشد، مسیر operator-only اضافه شده است:

`--seller-business-category-preview <absolute-json-file>`

و پس از بازبینی:

`--seller-business-category-apply <absolute-json-file> --expected-sha256 <file-digest> --expected-db-state-sha256 <preview-db-digest>`

ویژگی‌ها:
- همان `ReviewedImportFile` و duplicate-property guard مورد استفاده Catalog/Geography
- حداکثر ۵۰۰ category و ۲۵۶ KiB
- JSON strict؛ property ناشناخته و `isActive` حذف‌شده رد می‌شود
- ID و نام در batch یکتا
- نام category در DB یکتا
- preview بدون mutation
- apply به همان bytes و همان DB state preview‌شده bind می‌شود
- importهای همزمان serialized می‌شوند
- omitted row حذف یا غیرفعال نمی‌شود
- apply موفق receipt با SHA-256 و تعداد new/changed می‌سازد

هیچ endpoint عمومی برای ساخت/ویرایش taxonomy وجود ندارد.

## Backend Step 4

`GET /api/v1/seller/registration/business-categories`

- session معتبر لازم است
- فقط categoryهای active
- `configured` صریح
- no-store

`PUT /api/v1/seller/registration/business-information`

ورودی:
- `categoryId`
- `businessName`
- `description`
- `businessPhone`
- `offeringType = GOOD | SERVICE | BOTH`
- `revision`

قواعد:
- فقط صاحب draft
- فقط `DRAFT + completed_step=3`
- category باید active باشد
- revision دقیق لازم است
- شماره تماس ۱۱ رقم و با صفر شروع می‌شود؛ ارقام فارسی/عربی normalize می‌شوند
- transition اتمیک به `completed_step=4` و `revision+1`
- stale/مرحله اشتباه 409

DB از step 4 به بعد وجود همه business fieldها، enum و FK category را enforce می‌کند.

## Web / BFF

دو BFF مستقل:
- `/api/seller/registration/business-categories`
- `/api/seller/registration/business-information`

Cookie امن مرورگر فقط در Next مصرف می‌شود؛ Bearer فقط server-to-server است. پاسخ taxonomy allowlist می‌شود و metadata داخلی importer به browser نمی‌رسد.

UI:
- taxonomy به‌صورت lazy فقط در step 3 بارگذاری می‌شود
- حالت loading / unconfigured / unavailable
- فرم responsive مطابق Figma
- انتخاب کالا، خدمت یا هر دو
- unsaved business data داخل navigation guard
- پس از موفقیت summary read-only و «مرحله بعد محدوده فعالیت»
- submit نهایی همچنان تا step 6 نمایش داده نمی‌شود

## Admin

read-model درخواست فروشنده business category، نام، توضیح، تلفن و نوع ارائه را از داده واقعی نمایش می‌دهد تا review بعدی از sample data استفاده نکند.

## QA

- PostgreSQL/API: active/inactive taxonomy، validation، ارقام فارسی تلفن، CAS revision، persistence و hydration
- Import: preview بدون mutation، apply با DB checksum، receipt، stale DB state، duplicate JSON/name rejection
- HTTPS BFF: CSRF، unknown-field rejection، category response allowlist، business response validation
- Chromium: Step 3 → taxonomy واقعی CI → تکمیل فرم Figma → `completedStep=4` → summary → submit همچنان gated

## خارج از دامنه

- taxonomy واقعی production؛ باید به‌صورت فایل reviewed توسط operator تأمین شود
- Step 5 محدوده فعالیت
- Step 6 اطلاعات تکمیلی و مدارک
- approve/reject
- Seller activation
- mapping خودکار business taxonomy به Catalog taxonomy
