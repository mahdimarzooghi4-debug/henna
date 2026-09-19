# مدل دامنه و ERD حنا — پیش‌نویس ۰.۱

**مرجع:** [معماری نسخه کامل](HANA-FULL-PRODUCT-NATIONAL-ARCHITECTURE-v1.0.md)  
**وضعیت:** پیشنهادی؛ D01 تک‌فروشنده‌ای طبق [ADR-001](../adr/ADR-001-SINGLE-SELLER-ORDER.md) و اختیار مشتری در انتخاب فروشنده با سبد ناقص طبق [ADR-002](../adr/ADR-002-CUSTOMER-CHOICE-PARTIAL-BASKET.md) تصویب شده‌اند؛ مدل مالی و موجودی پس از تعیین باقی D02–D06 نهایی می‌شود. این سند نام جدول SQL یا migration نهایی نیست.

## قواعد پایه
- هویت حساب، احراز هویت، صلاحیت فروشندگی، سازمان، وضعیت حمایتی و نقش دسترسی مفاهیم مستقل‌اند.
- فروشنده و سازمان با `account_id` یا `representative_id` مرتبط‌اند اما مالکیت مستقل دارند.
- خرید حقوقی ویژگی سفارش و گیرنده فاکتور است، نه ورود خریدار به پرتال سازمان.
- موجودی و قیمت در سطح **پیشنهاد قابل عرضه یک فروشنده** ثبت می‌شود؛ کاتالوگ مرجع با پیشنهاد فروشنده متفاوت است.
- سفارش و مبلغ در زمان ثبت snapshot می‌شوند؛ تغییر قیمت بعدی سفارش قبلی را تغییر نمی‌دهد.
- پول در ریال صحیح؛ تاریخ‌ها UTC؛ نمایش زمان و تومان در کلاینت.
- `city_id` و `service_zone_id` زمینه خدمت‌رسانی بر اساس نشانی **تحویل** هستند، نه صرفاً محل سکونت حساب.
- اطلاعات هویتی حساس با شناسه داخلی ارجاع داده شود؛ شماره ملی و تلفن نباید کلید عمومی URL یا گزارش باشند.

## ERD مفهومی هسته

```mermaid
erDiagram
  ACCOUNT ||--o{ ACCOUNT_ROLE : has
  ACCOUNT ||--o{ ADDRESS : stores
  ACCOUNT ||--o{ IDENTITY_CHECK : verified_by
  ACCOUNT ||--o{ SELLER_APPLICATION : submits
  ACCOUNT ||--o{ ORDER : buys
  ACCOUNT ||--o{ CART : owns
  ACCOUNT ||--o{ ORGANIZATION_MEMBER : belongs_to
  ACCOUNT ||--o{ CREDIT_ALLOCATION : receives
  SELLER_APPLICATION o|--o| SELLER : activates
  SELLER ||--o{ SELLER_COVERAGE : covers
  SELLER ||--o{ OFFER : publishes
  SELLER ||--o{ ORDER : fulfills
  PRODUCT_SERVICE ||--o{ OFFER : listed_as
  OFFER ||--o| STOCK_AVAILABILITY : has
  CITY ||--o{ SERVICE_ZONE : contains
  CITY ||--o{ CITY_LAUNCH_CONFIG : configures
  SERVICE_ZONE ||--o{ ADDRESS : serves
  SERVICE_ZONE ||--o{ SELLER_COVERAGE : covered_by
  CART ||--o{ CART_ITEM : contains
  CART ||--o{ QUOTE : quoted_as
  QUOTE ||--o{ QUOTE_ITEM : snapshots
  QUOTE ||--o| ORDER : converted_to
  ORDER ||--|{ ORDER_ITEM : contains
  ORDER ||--o{ PAYMENT_ATTEMPT : paid_by
  ORDER ||--o{ FULFILLMENT_EVENT : tracked_by
  ORDER ||--o{ CREDIT_RESERVATION : uses
  PAYMENT_ATTEMPT ||--o{ LEDGER_ENTRY : recorded_as
  CREDIT_PROGRAM ||--o{ CREDIT_ALLOCATION : allocates
  CREDIT_ALLOCATION ||--o{ CREDIT_RESERVATION : reserved_from
  CREDIT_RESERVATION ||--o{ LEDGER_ENTRY : recorded_as
  ORGANIZATION ||--o{ ORGANIZATION_MEMBER : authorizes
  ORGANIZATION ||--o{ PEOPLE_IMPORT : imports
  ORGANIZATION ||--o{ CREDIT_PROGRAM : sponsors
  PEOPLE_IMPORT ||--o{ IMPORT_RECORD : holds
  ACCOUNT ||--o{ SUPPORT_TICKET : opens
  ACCOUNT ||--o{ AUDIT_EVENT : acts_in
```

در نمودار، `QUOTE → ORDER` و `SELLER_APPLICATION → SELLER` رابطه منطقی‌اند. طبق ADR-001، هر `ORDER` دقیقاً یک `SELLER` دارد و تمام `ORDER_ITEM`ها به همان فروشنده تعلق دارند؛ `QUOTE` نیز یک فروشنده منتخب دارد. هر خرید از فروشنده دیگر سفارش مستقل می‌سازد. جزئیات cardinality سایر روابط تا تصویب قواعد مرتبط در migration تثبیت نمی‌شود.

## مرز تراکنش‌ها و constraints

| موضوع | قید الزامی |
|---|---|
| Account | شناسه داخلی immutable، حذف/ناشناس‌سازی فقط طبق سیاست مصوب |
| Seller activation | دسترسی پنل فقط پس از تصمیم نهایی و حساب فعال |
| Organization scope | `organization_id` بر داده و authorization در هر query و عمل حساس |
| Offer & Inventory | موجودی منفی و رزرو تکراری ممنوع؛ کالای ناموجود از خرید قطعی حذف/نیازمند تصمیم |
| Quote | `quote_id`، version، `expires_at` و snapshot هزینه ارسال/اقلام؛ سبد اولیه با اقلام قابل تأمین فروشنده منتخب یکی فرض نشود؛ اقلام ناموجود و تأیید آگاهانه مشتری پیش از ایجاد سفارش ثبت/قابل اثبات باشد؛ انتخاب مشتری برای نگه‌داشتن/حذف اقلام تأمین‌نشده از سبد آینده طبق [ADR-003](../adr/ADR-003-CUSTOMER-CONTROL-UNFULFILLED-CART-ITEMS.md) مستقل ثبت شود |
| Order | state transition مجاز و immutable monetary snapshot؛ `request_id` یکتا |
| Payment | `attempt_id` و reference PSP با unique index؛ webhook تکراری بدون تکرار ledger |
| Ledger | رکورد افزایشی immutable، اصلاح با entry جبرانی؛ کنترل جمع بدهکار/بستانکار |
| Credit | reserve/consume/release idempotent، مانده منفی ممنوع، کاربرد شخصی/حقوقی معتبر |
| Import | batch و record hash/unique scope، گزارش خطای ردیف و عدم اعتبار مضاعف |
| City | تغییر وضعیت یک شهر نباید پیگیری سفارش قدیمی یا شهرهای دیگر را قطع کند |

## مواردی که قبل از SQL قطعی نیاز به تصمیم دارند

D01 تصویب شده: یک سفارش = یک فروشنده (ADR-001)؛ اصل انتخاب فروشنده با سبد ناقص در D02 تصویب شده (ADR-002)؛ باقی D02 شامل ظرفیت خدمت، هزینه ارسال و روش تحویل؛ D03 پرداخت در محل و مرجوعی؛ D04 مالیات/فاکتور؛ D05 ledger و منبع بودجه؛ D06 سیاست تخصیص سازمانی. بدون این تصمیم‌ها migration مربوط به پول و سفارش production-ready اعلام نشود.
