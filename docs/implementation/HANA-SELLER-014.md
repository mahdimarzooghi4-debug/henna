# Seller 014 — Amendment / Resubmit after NEEDS_INFORMATION

## هدف

وقتی reviewer نتیجه `NEEDS_INFORMATION` ثبت می‌کند، پرونده اصلی حذف یا
به DRAFT اولیه برگردانده نمی‌شود.

به‌جای overwrite کردن submission قبلی، صاحب همان حساب یک
**amendment packet** مستقل می‌سازد و آن را برای بررسی مجدد ارسال می‌کند.

## Boundary

پرونده اصلی:

- `status = SUBMITTED`
- tracking code ثابت می‌ماند
- submission metadata حفظ می‌شود
- review event قبلی در audit history باقی می‌ماند

Amendment مستقل:

- پاسخ اصلاحی
- لینک مرجع اختیاری
- base revision
- reviewer reason snapshot
- OPEN / RESUBMITTED
- timestamps

## Persistence

جدول:

`seller.application_amendments`

فیلدها:

- id
- application_account_id
- base_revision
- status
- reviewer_reason
- response_text
- reference_url
- created_at_utc
- updated_at_utc
- resubmitted_at_utc

Invariant:

- status فقط `OPEN` یا `RESUBMITTED`
- base revision >= 1
- reviewer reason: 1..500
- response text: 1..2000
- OPEN ⇒ resubmitted timestamp = null
- RESUBMITTED ⇒ resubmitted timestamp non-null
- در هر لحظه فقط یک amendment باز برای هر application

## GET amendment

`GET /api/v1/seller/registration/amendment`

فقط صاحب حساب.

فقط وقتی:

- application = SUBMITTED
- review_status = NEEDS_INFORMATION
- review_reason موجود

برمی‌گرداند:

- trackingCode
- current revision
- reviewer reason
- open amendment در صورت وجود

## Save amendment

`PUT /api/v1/seller/registration/amendment`

ورودی:

- revision
- responseText
- referenceUrl optional

شرایط:

- owner session
- NEEDS_INFORMATION
- exact revision

اگر amendment باز وجود نداشته باشد ساخته می‌شود.
اگر وجود داشته باشد همان record با حفظ base revision به‌روزرسانی می‌شود.

## Resubmit

`POST /api/v1/seller/registration/amendment/resubmit`

ورودی:

- amendmentId
- revision

شرایط:

- amendment متعلق به همان application
- amendment = OPEN
- application = SUBMITTED
- review_status = NEEDS_INFORMATION
- exact application revision
- amendment base revision = application revision

Transition:

- amendment: OPEN → RESUBMITTED
- application review_status: NEEDS_INFORMATION → UNDER_REVIEW
- review_reason current read-model پاک می‌شود
- reviewed_by_account_id current read-model پاک می‌شود
- reviewed_at_utc current read-model پاک می‌شود
- application revision + 1

Review event قبلی حذف نمی‌شود.

## Tracking / submission integrity

Resubmit:

- tracking code جدید نمی‌سازد
- submission key را تغییر نمی‌دهد
- submitted_at_utc را تغییر نمی‌دهد
- accuracy confirmation اولیه را تغییر نمی‌دهد

بنابراین کاربر همچنان همان پرونده و همان کد پیگیری را دنبال می‌کند.

## Web BFF

`/api/seller/registration/amendment`

- GET read-only
- PUT same-origin + JSON only + strict allowlist
- POST same-origin + JSON only + strict allowlist
- browser cookie در Next
- Bearer فقط server-to-server
- no-store
- strict response validation

## UI

مسیر:

`/seller/register/amendment`

نمایش:

- tracking code
- reviewer reason
- response text اجباری
- optional reference URL
- Save
- Resubmit

در status page فقط برای `NEEDS_INFORMATION` CTA:

«تکمیل اطلاعات و ارسال مجدد»

نمایش داده می‌شود.

## QA

سناریوی integration واقعی:

1. Admin پرونده را NEEDS_INFORMATION می‌کند.
2. applicant reason را می‌خواند.
3. stale revision برای amendment رد می‌شود.
4. amendment ذخیره می‌شود.
5. GET همان amendment را restore می‌کند.
6. resubmit موفق است.
7. review state دوباره UNDER_REVIEW می‌شود.
8. revision افزایش می‌یابد.
9. tracking code ثابت می‌ماند.
10. amendment audit = RESUBMITTED.
11. review event قبلی باقی می‌ماند.
12. sellerPanelEnabled=false.

## Platform scope

- backend
- web
- mobile / Android release scope

iOS خارج از scope است.

## خارج از دامنه

- upload فایل
- ویرایش مستقیم فیلدهای submission اصلی از amendment page
- Seller activation
- Seller role grant
- Admin reviewer UI
