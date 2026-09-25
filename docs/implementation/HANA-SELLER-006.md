# Seller 006 — مرحله ۲ ثبت‌نام: نوع متقاضی

## مبنای Figma

- Desktop: `SELLER REG / WEB / 02 Applicant Type` — node `277:255`
- Mobile: `SELLER REG / APP / 02 Applicant Type` — node `282:68`

گزینه‌های مصوب فقط:
- `NATURAL` — شخص حقیقی
- `LEGAL` — شخص حقوقی

## Backend

ستون‌های زیر به `seller.registration_drafts` اضافه شدند:

- `applicant_type`
- `completed_step`

پیش‌نویس‌های قبلی با `completed_step=1` مهاجرت می‌کنند و نوع متقاضی ندارند.

`PUT /api/v1/seller/registration/applicant-type`

- session معتبر لازم است؛
- فقط صاحب draft می‌تواند تغییر دهد؛
- فقط `NATURAL|LEGAL` معتبر است؛
- revision دقیق لازم است؛
- تغییر اتمیک است و revision را یک واحد زیاد می‌کند؛
- مرحله تکمیل‌شده به ۲ می‌رسد.

## جلوگیری از دور زدن مراحل

از این برش، `POST /api/v1/seller/registration/submit` فقط وقتی transition به `SUBMITTED` می‌دهد که `completed_step=6` باشد.

DB نیز invariant زیر را enforce می‌کند:

`SUBMITTED => completed_step = 6`

بنابراین UI تنها مانع نیست و caller مستقیم API نمی‌تواند مراحل ۳ تا ۶ را دور بزند.

## Web

BFF مستقل same-origin برای applicant type اضافه شد. Cookie امن مرورگر فقط در Next خوانده می‌شود و Bearer فقط server-to-server است.

فرم موجود پس از ذخیره مرحله ۱، کارت‌های انتخاب «شخص حقیقی / شخص حقوقی» را مطابق Figma نمایش می‌دهد. انتخاب ذخیره‌شده قابل بازیابی است و تا تکمیل مرحله ۶، دکمه ثبت نهایی نمایش داده نمی‌شود.

## Admin

API بررسی درخواست‌ها اکنون `applicantType` واقعی را نیز حمل می‌کند تا ستون «حقیقی / حقوقی» در Figma بعداً از داده واقعی تغذیه شود.

## QA

- PostgreSQL/API: invalid type، unauthorized، stale revision، ذخیره مرحله ۲ و منع submit ناقص.
- HTTPS BFF: CSRF، allowlist و عدم عبور token.
- Chromium: مرحله ۱ → انتخاب شخص حقیقی → ذخیره progress و عدم نمایش submit نهایی.

## خارج از دامنه

احراز هویت مرحله ۳، اطلاعات کسب‌وکار مرحله ۴، محدوده فعالیت مرحله ۵، اطلاعات تکمیلی مرحله ۶ و approve/reject همچنان در برش‌های بعدی هستند.
