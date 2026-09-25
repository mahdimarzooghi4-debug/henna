# Seller 009 — مرحله ۵ ثبت‌نام: محدوده فعالیت

## مبنای Figma

- Web: `SELLER REG / WEB / 05 Activity Area` — node `277:703`
- Mobile: `SELLER REG / APP / 05 Activity Area` — node `282:298`

فیلدهای قابل استناد در طراحی:

- استان / شهر
- آدرس محل فعالیت / فروشگاه
- موقعیت روی نقشه (اختیاری)
- ساعات فعالیت
- روش ارائه / تحویل
- محدوده ارائه خدمت

دو روش ارائه‌ای که خود Figma صریحاً نشان می‌دهد:

- ارسال توسط فروشنده
- تحویل حضوری

این برش گزینه دیگری را حدس نمی‌زند.

## مرز جغرافیا

استان و شهر از Geography مرجع حنا خوانده می‌شوند.

- province باید `SELECTABLE` باشد.
- city باید `SELECTABLE` باشد.
- city باید متعلق به همان province انتخاب‌شده باشد.
- انتخاب شهر فقط مکان ثبت‌نام فروشنده است و به‌تنهایی به معنی launch، فروش، پوشش ارسال یا آمادگی لجستیک نیست.
- Seller schema به Geography FK بین-schema اضافه نمی‌کند؛ canonical validity در transition سرور بررسی می‌شود تا lifecycle دو bounded context مستقل بماند.

## نقشه

Figma نقشه را اختیاری نشان می‌دهد، اما در دامنه فعلی قرارداد مصوبی برای provider نقشه، precision، consent یا ذخیره latitude/longitude وجود ندارد.

بنابراین Seller 009:

- map placeholder را در UI نشان می‌دهد؛
- مختصات ساختگی، IP-derived یا حدسی ذخیره نمی‌کند؛
- completion مرحله ۵ به نقشه وابسته نیست.

## Data model

فیلدهای جدید `seller.registration_drafts`:

- `activity_province_id uuid nullable`
- `activity_city_id uuid nullable`
- `activity_address varchar(500) nullable`
- `activity_hours varchar(180) nullable`
- `seller_delivery boolean nullable`
- `pickup boolean nullable`
- `service_area varchar(240) nullable`

DB invariant:

- قبل از step 5 همه activity fieldها null هستند.
- از step 5:
  - province/city اجباری‌اند؛
  - address و hours و service area غیرخالی‌اند؛
  - هر دو delivery capability مقدار صریح boolean دارند؛
  - حداقل یکی از `seller_delivery | pickup` باید true باشد.

## API

`PUT /api/v1/seller/registration/activity-area`

فقط وقتی transition مجاز است:

- session معتبر
- draft متعلق به همان account
- status = `DRAFT`
- `completed_step=4`
- revision دقیق
- province/city قابل انتخاب و سازگار

موفقیت:

- activity data ذخیره می‌شود؛
- `completed_step=5`
- `revision + 1`

## Web / BFF

`PUT /api/seller/registration/activity-area`

- same-origin
- strict body allowlist
- UUID validation
- text length/control validation
- browser cookie فقط در Next خوانده می‌شود
- Bearer فقط server-to-server
- upstream response دوباره validate می‌شود
- `no-store`

Province/city selection از gatewayهای موجود جغرافیا استفاده می‌کند:

- `/api/geography/provinces`
- `/api/geography/cities?provinceId=...`

## UI

Desktop و Mobile با layout responsive:

- انتخاب province
- انتخاب city وابسته به province
- آدرس
- placeholder نقشهٔ اختیاری
- ساعات فعالیت
- checkbox ارسال توسط فروشنده
- checkbox تحویل حضوری
- محدوده ارائه خدمت
- ذخیره و ادامه

بعد از completion، summary read-only نمایش داده می‌شود و مرحله بعد «اطلاعات تکمیلی» است.

Unsaved activity input نیز در navigation guard شرکت می‌کند.

## Admin review

Detail read-model درخواست فروشندگی business و activity data ذخیره‌شده را برای reviewer نمایش می‌دهد، بدون هیچ Seller activation یا مجوز عملیاتی.

## QA

### PostgreSQL/API

- migration pending نباشد
- province/city mismatch رد شود
- city فقط از province انتخاب‌شده پذیرفته شود
- هیچ delivery method رد شود
- save معتبر step 4 → 5 و revision + 1
- GET draft canonical province/city name را restore کند

### Next gateway

- cross-origin رد شود
- unknown field رد شود
- response step/revision/canonical IDs validate شود
- bearer به browser نرسد

### Chromium

Journey:

`OTP → Step 1 → Applicant Type → Identity → Business Information → Activity Area`

و اثبات می‌کند:

- geography واقعی UI استفاده می‌شود
- هر دو روش Figma قابل انتخاب‌اند
- map placeholder قابلیت جعلی نمی‌سازد
- step 5 ذخیره و بعد از reload hydrate می‌شود
- final submit همچنان تا Step 6 قابل دسترس نیست

## خارج از دامنه

- interactive map / geocoding / latitude-longitude
- delivery-radius engine
- logistics coverage entitlement
- Step 6 اطلاعات تکمیلی و مدارک
- approve/reject و Seller activation
