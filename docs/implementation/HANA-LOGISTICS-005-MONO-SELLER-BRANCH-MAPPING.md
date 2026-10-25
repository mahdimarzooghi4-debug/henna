# HANA-LOGISTICS-005 — نگاشت فروشندهٔ حنا به شعبهٔ مونو

**مرحله:** لایهٔ فنی اتصال حنا و مونو  
**وضعیت:** در PR پیش‌نویس؛ تا دریافت تصمیم و شناسهٔ واقعی شعبه، هیچ نگاشتی فعال نیست.

## رفتار پیاده‌شده

- API ادمین برای فهرست شعبه‌های متعلق به credential مشتری Mono (`branches.read`).
- خواندن نگاشت جاری و ثبت/به‌روزرسانی صریح آن با `expectedRevision`.
- ثبت فقط برای فروشنده‌ای که activation دارد و suspension باز ندارد.
- پیش از ذخیره، branch id باید در فهرست Mono موجود و وضعیت آن `ACTIVE` باشد.
- هر تغییر در جدول commerce با revision افزایشی ذخیره و در `commerce.journal` ثبت می‌شود؛ تلاش تکراری همان مقدار idempotent است و تغییر رقابتی با revision قدیمی رد می‌شود.
- برای یک شعبه محدودیت یکتایی بین فروشنده‌ها وضع نشده؛ امکان اشتراک شعبه یک تصمیم کسب‌وکار است و نباید فنی حدس زده شود.

## مسیرهای ادمین

- `GET /api/v1/admin/integrations/mono/branches`
- `GET /api/v1/admin/integrations/mono/sellers/{sellerId}/branch-mapping`
- `PUT /api/v1/admin/integrations/mono/sellers/{sellerId}/branch-mapping` با `monoBranchId` و `expectedRevision`

همهٔ مسیرها احراز هویت Bearer، نقش Admin و HTTPS غیر Development را لازم دارند. API key مونو فقط سمت سرور استفاده می‌شود؛ آدرس شعبه و نام آن در mapping ذخیره نمی‌شوند.

## وابستگی‌های محیط

- Mono sandbox HTTPS و API key با scopeهای `branches.read` و `delivery-requests.write`.
- ادمین باید نگاشت واقعی هر فروشنده را تعیین کند؛ این PR هیچ نگاشت نمونه یا production seed ندارد.
- این کار branch mapping را آماده می‌کند اما dispatch را فعال نمی‌کند؛ quote معتبر، دادهٔ بسته‌بندی و مسیر دریافت وضعیت مأموریت هنوز لازم‌اند.

## آزمون

تست PostgreSQL مسیرهای فعال/تعلیق‌شده، بررسی شعبهٔ فعال، تکرار idempotent، تغییر رقابتی و journal را پوشش می‌دهد. آزمون live sandbox انجام نشده است.
