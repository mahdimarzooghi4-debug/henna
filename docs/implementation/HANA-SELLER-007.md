# Seller 007 — مرحله ۳ ثبت‌نام: احراز هویت

## مبنای Figma

- Desktop: `SELLER REG / WEB / 03 Identity` — node `277:376`
- Mobile: `SELLER REG / APP / 03 Identity` — node `282:119`

طراحی برای شخص حقیقی مسیر «استعلام و ادامه» و حالت‌های loading / verified / unavailable را نشان می‌دهد. برای شخص حقوقی، فرم جایگزین شامل نام شخصیت حقوقی، شناسه ملی ۱۱ رقمی، نام نماینده و شماره موبایل نماینده است.

## اصل امنیتی

وارد کردن داده هویتی به‌تنهایی «احراز هویت» محسوب نمی‌شود.

### شخص حقیقی

`POST /api/v1/seller/registration/identity/natural`

- فقط برای draft نوع `NATURAL` در `completed_step=2`.
- کد ملی با رقم‌های فارسی/عربی normalize و checksum کد ملی ایران validate می‌شود.
- شماره همراه از Account تأییدشده خوانده می‌شود؛ browser نمی‌تواند شماره دیگری برای استعلام تحمیل کند.
- `ISellerNaturalIdentityVerifier` تنها مرجع نتیجه است.
- implementation پیش‌فرض `UnconfiguredSellerNaturalIdentityVerifier` است و `503` می‌دهد.
- هیچ mock، bypass یا «تأیید بر اساس فرمت» در shipping API وجود ندارد.
- فقط نتیجه واقعی `Verified` باعث transition به:
  - `identity_status=VERIFIED`
  - `completed_step=3`
  - `revision + 1`
- کد ملی کامل در پاسخ API/BFF برگردانده نمی‌شود؛ فقط masked value نمایش داده می‌شود.
- اگر provider unavailable یا mismatch باشد، مرحله ۳ تکمیل نمی‌شود.

### شخص حقوقی

`PUT /api/v1/seller/registration/identity/legal`

- فقط برای draft نوع `LEGAL` در `completed_step=2`.
- نام شخصیت حقوقی، شناسه ملی ۱۱ رقمی، نام نماینده و شماره همراه نماینده ثبت می‌شود.
- شماره نماینده باید همان شماره همراه تأییدشده Account باشد.
- نتیجه `identity_status=RECORDED` است، نه `VERIFIED`.
- این برش هیچ استعلام ثبتی خارجی یا تأیید نهایی شخصیت حقوقی را جعل نمی‌کند.
- transition به `completed_step=3` فقط به معنی تکمیل داده مرحله ۳ در مسیر حقوقی است.

## سازگاری مراحل

- مرحله ۱ بعد از شروع مرحله ۲ در API و UI قفل می‌شود.
- نوع متقاضی بعد از تکمیل مرحله ۳ دیگر قابل تغییر نیست.
- تغییر نوع متقاضی تا قبل از مرحله ۳، داده identity قبلی را پاک می‌کند.
- DB shape را enforce می‌کند:
  - قبل از step 3 هیچ identity data/status نباید وجود داشته باشد.
  - NATURAL در step >= 3 فقط با `VERIFIED` و کد ملی معتبر ذخیره‌شده است.
  - LEGAL در step >= 3 فقط با `RECORDED` و داده ثبتی/نماینده کامل است.

## Web / BFF

دو gateway مستقل same-origin وجود دارد:

- `/api/seller/registration/identity/natural`
- `/api/seller/registration/identity/legal`

Cookie امن مرورگر فقط در Next خوانده می‌شود. Bearer فقط server-to-server است. هر route body allowlist، محدودیت طول، normalize ارقام و validation پاسخ upstream دارد.

UI responsive مطابق Figma:

- شخص حقیقی: نام/شماره تأییدشده + کد ملی + «استعلام و ادامه».
- شخص حقوقی: نام شخصیت حقوقی + شناسه ملی + نماینده + شماره نماینده + «ادامه».
- پس از step 3، فرم قبلی lock و وضعیت ذخیره‌شده نمایش داده می‌شود.
- ثبت نهایی همچنان تا step 6 پنهان و در backend ممنوع است.

## Admin

Seller Application read-model اکنون `identityStatus` را نیز دارد. کد ملی شخص حقیقی فقط mask شده در اختیار Admin قرار می‌گیرد. شماره نماینده حقوقی نیز mask می‌شود.

## QA

- PostgreSQL/API:
  - verifier پیش‌فرض unavailable و DB بدون تغییر؛
  - checksum نامعتبر رد می‌شود؛
  - verifier CI می‌تواند NATURAL را به `VERIFIED` ببرد؛
  - LEGAL فقط `RECORDED` می‌شود؛
  - شماره نماینده غیر از شماره Account رد می‌شود؛
  - نوع متقاضی اشتباه conflict می‌دهد؛
  - GET کد ملی کامل را نشت نمی‌دهد.
- HTTPS Next gateway:
  - CSRF و unknown-field rejection؛
  - upstream 503 به fail-closed browser response تبدیل می‌شود؛
  - token به browser JSON نمی‌رسد.
- Chromium:
  - خطای کد ملی نامعتبر؛
  - استعلام موفق CI؛
  - transition به step 3؛
  - reload با masked identity state؛
  - submit نهایی همچنان غیرفعال.

## خارج از دامنه

- قرارداد واقعی provider احراز هویت و credentials آن
- استعلام رسمی شخصیت حقوقی
- وضعیت حمایتی ویژهٔ نمونه Figma؛ تا زمانی که منبع داده، مبنای قانونی و قرارداد دامنه آن تصویب نشود ذخیره یا استنتاج نمی‌شود
- مرحله ۴ اطلاعات کسب‌وکار
- مرحله ۵ محدوده فعالیت
- مرحله ۶ اطلاعات تکمیلی/مدارک
- approve/reject و Seller activation
