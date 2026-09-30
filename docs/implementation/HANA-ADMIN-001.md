# Admin 001 — دسترسی امن مدیریت و مشاهده درخواست‌های فروشندگی

## مبنای محصول

این برش از صفحه `04 • Hana Admin` در Figma استفاده می‌کند:

- `ADMIN / 06 Seller Applications` — node `302:755`
- `ADMIN / 07 Seller Application Detail` — node `303:8`

طراحی صریحاً «درخواست‌های ثبت‌نام فروشنده»، «بررسی درخواست»، «درخواست تکمیل اطلاعات» و «ثبت نتیجه نهایی بررسی» را نشان می‌دهد. با این حال، داده اجرایی فعلی حنا هنوز مراحل نوع متقاضی، احراز هویت، محدوده فعالیت و اطلاعات تکمیلی را کامل نکرده است. بنابراین این برش فقط دسترسی و مشاهده امن را می‌سازد؛ نتیجه نهایی review را جعل نمی‌کند.

## Identity / Authorization

- جدول `identity.role_assignments` اضافه شد.
- نقش اولیه فقط `ADMIN` است.
- داشتن Account، شماره تأییدشده یا Seller Registration هیچ‌کدام Admin ایجاد نمی‌کنند.
- privileged endpointها نقش را در هر درخواست از PostgreSQL بررسی می‌کنند؛ هیچ role/claim ارسالی از browser معتبر فرض نمی‌شود.
- هیچ public HTTP endpoint برای grant کردن Admin وجود ندارد.
- تا زمان تعریف مسیر provisioning/audit مصوب، production به‌طور پیش‌فرض هیچ Admin خودکار ندارد.

## Seller Applications API

`GET /api/v1/admin/seller-applications?page=&pageSize=`

- فقط session معتبر دارای `ADMIN`.
- حساب anonymous: 401.
- حساب authenticated بدون Admin: 403.
- فقط registrationهای واقعی با `status=SUBMITTED`.
- pagination محدود و validate شده.
- پاسخ list شامل applicationId، نام کسب‌وکار، نام مسئول، status/revision و زمان submit است.

`GET /api/v1/admin/seller-applications/{applicationId}`

- همان مرز دسترسی.
- فقط SUBMITTED.
- شماره تماس به‌صورت mask شده برمی‌گردد.
- `submission_key` و `submission_expected_revision` هرگز به client داده نمی‌شوند.

## QA

Integration test واقعی PostgreSQL/API اثبات می‌کند:

- anonymous به داده Admin دسترسی ندارد؛
- user عادی 403 می‌گیرد؛
- فقط role assignment صریح ADMIN دسترسی می‌دهد؛
- Draftهای ثبت‌نشده در لیست Admin ظاهر نمی‌شوند؛
- شماره تماس mask می‌شود؛
- metadata idempotency submit نشت نمی‌کند.

## خارج از دامنه

- Admin role provisioning production
- MFA مخصوص نقش پرخطر
- صفحه Web Admin
- درخواست تکمیل اطلاعات
- approve/reject
- seller activation
- مراحل ۲ تا ۶ ثبت‌نام فروشنده

این موارد در برش‌های بعدی و پس از قرارداد داده/دسترسی خودشان ساخته می‌شوند.
