# Seller 010 — مرحله ۶ ثبت‌نام: اطلاعات تکمیلی

## مبنای Figma

- Web: `SELLER REG / WEB / 06 Additional Information` — node `277:839`
- Mobile: `SELLER REG / APP / 06 Additional Information` — node `282:479`
- Review reference:
  - Web `07 Review` — node `277:1168`
  - Mobile `07 Review` — node `282:552`

### Web

طراحی وب این داده‌ها را نشان می‌دهد:

- کد ملی مسئول
- نام و نام خانوادگی مسئول
- وب‌سایت / شبکه اجتماعی اختیاری
- ایمیل کسب‌وکار اختیاری
- مدارک در صورت نیاز

کد ملی از Identity مرحله ۳ آمده و دوباره در Seller Step 6 ذخیره نمی‌شود.

### Mobile

طراحی موبایل این داده‌ها را نشان می‌دهد:

- نام رابط یا مسئول ثبت‌نام
- سمت در کسب‌وکار
- تلفن همراه دوم / پشتیبان
- لینک وب‌سایت یا شبکه اجتماعی اختیاری
- ساعات کاری پاسخگویی
- مدارک در صورت نیاز

Figma صریحاً می‌گوید:
«در این مرحله نیازی به بارگذاری مدرک خاصی نیست».

## مدل مشترک Web / Mobile

Seller 010 یک contract مشترک و بدون داده ساختگی تعریف می‌کند:

- `registration_contact_name` — اجباری
- `registration_contact_role` — اختیاری
- `backup_phone` — اختیاری
- `website_or_social` — اختیاری
- `business_email` — اختیاری
- `response_hours` — اجباری

در UI:
- contact name با مسئول حساب / نمایندهٔ حقوقی prefill می‌شود؛
- response hours با ساعات فعالیت Step 5 prefill می‌شود؛
- کاربر می‌تواند قبل از ذخیره آن‌ها را تغییر دهد.

## Identity boundary

Step 6 هیچ داده هویتی را دوباره authoritative نمی‌کند.

- کد ملی شخص حقیقی فقط masked و read-only از Step 3 نمایش داده می‌شود.
- شناسه ملی شخصیت حقوقی فقط read-only نمایش داده می‌شود.
- Step 6 اجازه تغییر یا بازتأیید identity ندارد.

## Documents boundary

در این slice:

- upload endpoint وجود ندارد؛
- document metadata ساختگی ثبت نمی‌شود؛
- هیچ فایل نمونه‌ای ایجاد نمی‌شود؛
- `documentsRequired=false` فقط read-model وضعیت فعلی این Step است و در DB به عنوان سند/مجوز ذخیره نمی‌شود.

وقتی rules واقعی مدارک بر اساس business category تصویب شوند، باید یک bounded contract مستقل برای requirement/upload/review ساخته شود.

## Persistence invariant

قبل از Step 6، همه additional fields باید null باشند.

از Step 6:

- contact name باید ۱–۱۲۰ کاراکتر معتبر باشد؛
- response hours باید ۱–۱۸۰ کاراکتر معتبر باشد؛
- role در صورت وجود ۱–۱۲۰ کاراکتر؛
- backup phone در صورت وجود موبایل ایران `09xxxxxxxxx`؛
- website/social در صورت وجود حداکثر ۳۰۰؛
- business email در صورت وجود حداکثر ۲۵۴ و معتبر.

## API

`PUT /api/v1/seller/registration/additional-information`

transition مجاز:

- session معتبر
- account owner
- status = `DRAFT`
- `completed_step=5`
- revision دقیق
- payload معتبر

موفقیت:

- additional data ذخیره می‌شود؛
- `completed_step=6`
- `revision + 1`

## BFF

`PUT /api/seller/registration/additional-information`

- same-origin
- JSON only
- strict field allowlist
- Persian/Arabic digit normalization برای backup phone
- email validation
- browser cookie فقط در Next
- Bearer فقط server-to-server
- upstream response validation
- `no-store`

## UI

Responsive Step 6 شامل:

- اطلاعات مسئول کسب‌وکار
- مسئول ثبت‌نام
- سمت اختیاری
- تلفن پشتیبان اختیاری
- وب‌سایت / شبکه اجتماعی اختیاری
- ایمیل کسب‌وکار اختیاری
- ساعات پاسخگویی
- وضعیت مدارک
- ذخیره و ادامه
- summary read-only بعد از completion

Unsaved edits در navigation guard شرکت می‌کنند.

## Step 7 boundary

با تکمیل Step 6، ثبت نهایی مستقیم فعال نمی‌شود.

UI فقط اعلام می‌کند مرحله بعد «بازبینی و ثبت» است و CTA مرحله ۷ تا Seller 011 غیرفعال می‌ماند.

این کار مانع دورزدن:
- review نهایی؛
- تأیید صریح صحت اطلاعات؛
- UX مصوب Step 7
می‌شود.

## Admin review

Admin detail این داده‌ها را برای reviewer نمایش می‌دهد:

- contact name / role
- backup phone به‌صورت masked
- website/social
- business email
- response hours
- documentsRequired=false

هیچ Seller activation یا approval در Seller 010 انجام نمی‌شود.

## QA

### PostgreSQL/API

- migration pending نباشد
- invalid backup phone رد شود
- invalid email رد شود
- exact transition `5 → 6`
- revision increment
- stale revision conflict
- GET hydration

### Next/BFF

- cross-origin رد شود
- unknown fields رد شوند
- optional phone normalize شود
- upstream shape/revision/step validate شود
- bearer به browser نرسد

### Chromium

Journey:

`OTP → Step 1 → Applicant Type → Identity → Business → Activity Area → Additional Information`

و اثبات می‌کند:

- prefill مسئول و ساعات پاسخگویی واقعی است؛
- optional fields ذخیره می‌شوند؛
- no-document state مطابق Figma دیده می‌شود؛
- reload Step 6 را hydrate می‌کند؛
- submit نهایی هنوز تا Step 7 در UI بسته است.

## خارج از دامنه

- upload مدارک
- document requirement engine
- OCR / verification
- Step 7 review + consent
- final seller approval / activation
