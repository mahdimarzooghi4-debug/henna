# Seller 011 — مرحله ۷ ثبت‌نام: بازبینی و ثبت نهایی

## مبنای Figma

- Web: `SELLER REG / WEB / 07 Review` — node `277:1168`
- Mobile: `SELLER REG / APP / 07 Review` — node `282:552`

المان‌های صریح طراحی:

- خلاصه نوع متقاضی
- اطلاعات هویتی
- اطلاعات کسب‌وکار
- محدوده فعالیت
- اطلاعات تکمیلی
- checkbox: «صحت اطلاعات واردشده را تأیید می‌کنم.»
- CTA ثبت نهایی
- بازگشت و ویرایش

## Runtime review summary

UI فقط داده‌های persisted مراحل ۱ تا ۶ را نمایش می‌دهد.

- شماره‌های حساس در review masked هستند.
- هیچ وضعیت حمایتی ساختگی نمایش داده نمی‌شود؛ Figma نمونه دارد اما runtime فعلی منبع authoritative برای آن ندارد.
- وضعیت فروشندگی قبل از submit «آماده ثبت نهایی» است.

## Explicit confirmation

تأیید صحت اطلاعات فقط UI state نیست.

درخواست ثبت نهایی باید شامل:

- revision دقیق
- idempotency key معتبر
- `confirmed=true`

Backend بدون confirmation صریح، 400 برمی‌گرداند.

## Audit

فیلد جدید:

- `accuracy_confirmed_at_utc timestamp with time zone nullable`

Invariant:

- DRAFT: confirmation timestamp باید null باشد.
- SUBMITTED: submission metadata و confirmation timestamp همگی باید موجود باشند.

زمان confirmation و `submitted_at_utc` در همان transition اتمیک ثبت می‌شوند.

## Final submit

`POST /api/v1/seller/registration/submit`

شرایط:

- session معتبر
- مالک همان draft
- status = DRAFT
- completed_step = 6
- revision دقیق
- confirmed = true
- Idempotency-Key معتبر

Transition:

`DRAFT → SUBMITTED`

موفقیت:

- revision + 1
- submission key ذخیره
- expected revision ذخیره
- submitted timestamp ذخیره
- accuracy confirmation timestamp ذخیره

هیچ Seller role، activation، store permission یا approval ایجاد نمی‌شود.

## Idempotency

Retry با همان:
- submission key
- expected revision

همان submitted row را برمی‌گرداند.

کلید جدید برای draftی که قبلاً submit شده، conflict است.

## BFF

Browser POST به `/api/seller/registration`:

- same-origin
- JSON only
- strict allowlist
- confirmed باید دقیقاً true باشد
- idempotency UUID v4
- Bearer فقط server-to-server
- no-store
- submitted + confirmation timestamps validate می‌شوند

## QA

- submit بدون confirmation رد می‌شود
- submit کامل موفق است
- confirmation timestamp با submit ثبت می‌شود
- retry idempotent است
- Chromium تا Step 7 واقعی پیش می‌رود
- CTA قبل از checkbox disabled است
- پس از checkbox submit انجام می‌شود
- reload وضعیت SUBMITTED را بازیابی می‌کند

## خارج از دامنه

- Admin approve/reject
- Seller activation
- seller operational permissions
- Step 8 status workflow beyond existing submitted status
