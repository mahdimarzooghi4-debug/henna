# Seller 013 — Admin Reviewer Workflow

## هدف

پس از ثبت نهایی Seller Application، وضعیت ثبت درخواست همچنان
`SUBMITTED` می‌ماند و تصمیم reviewer در یک state مستقل ثبت می‌شود.

این جداسازی مانع یکی‌شدن مفاهیم زیر می‌شود:

- submission
- review decision
- seller activation
- seller operational access

## Review states

برای پرونده SUBMITTED:

- `UNDER_REVIEW`
- `NEEDS_INFORMATION`
- `APPROVED`
- `REJECTED`

برای DRAFT هیچ review state وجود ندارد.

## مهم: approval برابر activation نیست

`APPROVED` فقط نتیجه بررسی پرونده است.

Seller 013 هیچ‌کدام از این موارد را انجام نمی‌دهد:

- grant نقش Seller
- ساخت seller operational profile
- فعال‌کردن فروشگاه
- فعال‌کردن seller panel
- ایجاد catalog write permission

در status API حتی برای `APPROVED` مقدار
`sellerPanelEnabled=false` باقی می‌ماند.

## Admin authorization

Endpoint reviewer فقط برای account دارای نقش صریح `ADMIN` قابل استفاده است.

`POST /api/v1/admin/seller-applications/{applicationId}/review`

ورودی:

- `revision`
- `decision`
- `reason`

Header:

- `Idempotency-Key`

## Validation

### NEEDS_INFORMATION

reason اجباری است.

### REJECTED

reason اجباری است.

### APPROVED

reason اختیاری است.

reason در صورت وجود:

- trim می‌شود
- حداکثر ۵۰۰ کاراکتر
- control character پذیرفته نمی‌شود

## Concurrency

تصمیم فقط وقتی ثبت می‌شود که:

- application وجود داشته باشد
- status = `SUBMITTED`
- review_status = `UNDER_REVIEW`
- revision دقیقاً برابر expected revision باشد

پس از تصمیم:

- review status تغییر می‌کند
- reviewer account ثبت می‌شود
- reviewed timestamp ثبت می‌شود
- revision یک واحد افزایش می‌یابد

تصمیم دوم روی همان پرونده در این slice conflict است.

## Idempotency

هر تصمیم Admin یک `Idempotency-Key` مستقل دارد.

Retry همان request با همان:

- application
- reviewer
- revision
- decision
- reason
- key

همان نتیجه را برمی‌گرداند.

استفاده مجدد همان key برای payload یا پرونده متفاوت conflict است.

## Audit history

جدول immutable:

`seller.application_reviews`

فیلدها:

- id
- application_account_id
- reviewer_account_id
- decision_key
- expected_revision
- decision
- reason
- created_at_utc

هر تصمیم successful یک event audit مستقل ایجاد می‌کند.

## Current state

روی `seller.registration_drafts`:

- review_status
- review_reason
- reviewed_by_account_id
- reviewed_at_utc

این فیلدها read-model فعلی پرونده‌اند؛ audit event تاریخچه تصمیم را نگه می‌دارد.

## Applicant status

`GET /api/v1/seller/registration/status`

اکنون outcome واقعی reviewer را برمی‌گرداند:

- UNDER_REVIEW
- NEEDS_INFORMATION
- APPROVED
- REJECTED

همراه:

- reviewReason
- reviewedAtUtc
- sellerPanelEnabled=false

Step REVIEW در timeline نیز همین state را منعکس می‌کند.

## Web status

صفحه:

`/seller/register/status`

برای هر outcome متن واقعی همان وضعیت را نشان می‌دهد.

اگر reviewer reason ثبت کرده باشد، آن را همراه زمان review نمایش می‌دهد.

## Figma boundary

Figma فعلی برای Seller journey وضعیت‌های عمومی review را نشان می‌دهد،
اما صفحه اختصاصی Admin Reviewer در فایل مرجع پیدا نشد.

بنابراین Seller 013:

- Admin API و domain workflow را پیاده می‌کند
- Admin UI جدید اختراع نمی‌کند

UI مدیریتی باید در slice مستقل و بر اساس طراحی مصوب ساخته شود.

## QA

- anonymous admin API → 401
- non-admin → 403
- missing reason برای NEEDS_INFORMATION/REJECTED → 400
- revision mismatch / second decision → 409
- successful review → revision + 1
- same-key retry idempotent
- immutable audit event
- applicant status outcome + reason
- sellerPanelEnabled=false

## Platform scope

- backend
- web
- mobile / Android release scope

iOS در scope محصول فعلی نیست.

## خارج از دامنه

- Admin Reviewer UI
- reopen/edit flow بعد از NEEDS_INFORMATION
- seller activation
- Seller role grant
- seller panel access
