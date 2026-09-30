# Seller 012 — مرحله ۸: ثبت‌شده و وضعیت درخواست

## مبنای Figma

- Web submitted: `SELLER REG / WEB / 08 Submitted` — node `277:1345`
- Web status: `SELLER REG / WEB / 09 Status` — node `277:1467`
- Mobile submitted: `SELLER REG / APP / 08 Submitted` — node `282:671`
- Mobile status: `SELLER REG / APP / 09 Status` — node `282:710`

نسخه فعلی فقط status واقعی runtime را پیاده می‌کند:

- `UNDER_REVIEW`
- Seller panel disabled

حالت‌های آینده Figma مثل «نیازمند تکمیل اطلاعات» یا «تأیید نهایی» تا وقتی backend workflow واقعی آن‌ها وجود ندارد نمایش داده نمی‌شوند.

## Tracking code

بعد از submit یک کد پیگیری مستقل ساخته و ذخیره می‌شود:

`HNA-XXXXXXXXXXXXXXXX`

- ۱۶ hex = ۶۴ بیت از SHA-256 روی Idempotency Key
- خود Idempotency Key هرگز به browser یا status API نمایش داده نمی‌شود
- retry با همان key همان tracking code را برمی‌گرداند
- روی DB unique index دارد

Tracking code مجوز، token ورود یا credential نیست.

## Persistence

فیلد جدید:

- `tracking_code varchar(24) nullable`

Invariant:

- DRAFT: tracking code = null
- SUBMITTED: tracking code non-null و همراه submission metadata
- unique filtered index روی tracking code

## Status API

`GET /api/v1/seller/registration/status`

فقط برای account owner.

برای draft ثبت‌نشده، status tracking در دسترس نیست.

برای SUBMITTED:

- trackingCode
- overallStatus = `UNDER_REVIEW`
- applicantType
- identityStatus
- submittedAtUtc
- accuracyConfirmedAtUtc
- sellerPanelEnabled = false
- timeline:
  - identity: completed
  - business: completed
  - activity: completed
  - additional: completed
  - review: under review

هیچ submission key یا اطلاعات حساس اضافه بر نیاز status response برگردانده نمی‌شود.

## Web BFF

`GET /api/seller/registration/status`

- session cookie فقط در Next خوانده می‌شود
- Bearer فقط server-to-server
- no-store
- tracking code format validation
- exact overall state validation
- exact timeline shape validation
- seller panel must remain false

## UI

### Submitted

پس از ثبت نهایی:

- «درخواست ثبت شد»
- tracking code واقعی
- «مشاهده وضعیت درخواست»
- «بازگشت به حنا»

### Status

مسیر:

`/seller/register/status`

نمایش:

- در حال بررسی
- tracking code
- نوع حساب
- وضعیت هویت
- زمان ثبت
- timeline مراحل
- ورود به پنل فروشنده disabled
- توضیح استقلال احراز هویت از approval فروشندگی

## عدم جعل وضعیت

Figma نمونه‌هایی از support status و review outcomes دارد.

Seller 012 فقط statusهایی را نشان می‌دهد که از backend فعلی قابل اثبات‌اند. بنابراین:

- support status ساخته نمی‌شود
- approved/rejected ساخته نمی‌شود
- needs-more-information ساخته نمی‌شود
- Seller panel فعال نمی‌شود

## QA

- tracking code هنگام submit ساخته می‌شود
- format و uniqueness contract بررسی می‌شود
- GET draft بعد از submit tracking code را restore می‌کند
- status API فقط owner را می‌پذیرد
- sellerPanelEnabled=false
- submission key leak نمی‌شود
- BFF status response strict است
- Chromium:
  - submit
  - tracking code روی submitted screen
  - navigation به status page
  - under-review state
  - seller panel disabled
  - reload persistence

## Platform scope

Release scope فعلی Web + Android است. iOS در این slice معیار QA یا release نیست.

## خارج از دامنه

- iOS
- admin approve/reject
- needs-more-information workflow
- seller activation
- seller panel access
- support-profile integration
