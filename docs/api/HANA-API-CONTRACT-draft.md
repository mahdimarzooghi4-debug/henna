# قرارداد API حنا — پیش‌نویس ۰.۱

**مرجع:** [معماری نسخه کامل](../architecture/HANA-FULL-PRODUCT-NATIONAL-ARCHITECTURE-v1.0.md)  
**وضعیت:** contract-first draft؛ این فایل OpenAPI نهایی نیست و هیچ endpoint در مخزن هنوز پیاده‌سازی نشده است.

## اصول همه endpointها

Base path: `/api/v1`. ارتباط HTTPS؛ token/session معتبر؛ مجوز سمت سرور با actor/action/resource/tenant/state. زمان UTC در ISO-8601، شناسه opaque، مبلغ ریال integer، pagination cursor-based برای لیست پرتعداد، validation و rate-limit متناسب با حساسیت عملیات.

```json
{
  "error": {
    "code": "QUOTE_EXPIRED",
    "message": "اعتبار پیشنهاد قیمت تمام شده است.",
    "requestId": "req_sample",
    "details": {}
  }
}
```

سازگاری نسخه با اپ موبایل نصب‌شده، عدم بازگشت داده حساس در خطا و منع نمایش قیمت/موجودی محاسبه‌شده از کلاینت جزء قرارداد است.

## سطح API بر حسب دامنه

| دامنه | مسیرهای پیشنهادی | مالک داده |
|---|---|---|
| حساب | `/auth/*`، `/me`، `/me/addresses` | Identity |
| شهر و پوشش | `/cities`، `/service-zones`، `/coverage/check` | Geography |
| کاتالوگ | `/catalog`، `/products/{id}`، `/services/{id}`، `/offers` | Catalog/Offer |
| سبد | `/carts/current`، `/carts/current/items` | Cart |
| مقایسه | `/carts/current/comparison` | Comparison |
| Quote | `/quotes`، `/quotes/{id}` | Checkout |
| سفارش | `/orders`، `/orders/{id}`، `/orders/{id}/timeline` | Order |
| پرداخت | `/orders/{id}/payment-attempts`، `/payments/{id}/status` | Payment |
| اعتبار | `/me/credits`، `/programs`، `/credit-usage` | Credit |
| ثبت‌نام فروشنده | `/seller-applications`، `/seller-applications/{id}` | Onboarding |
| عملیات فروشنده | `/seller/offers`، `/seller/inventory`، `/seller/orders` | Seller |
| مدیریت | `/admin/users`، `/admin/seller-applications`، `/admin/orders` و سایر منابع scoped | Admin |
| سازمان | `/organizations/{orgId}/programs`، `/people-imports`، `/allocations`، `/usage` | Organization |
| پشتیبانی | `/support/tickets`، `/notifications` | Support |

تمام مسیرها placeholders طراحی API هستند، نه API فعال.

## قرارداد پیشنهادی quote خرید

طبق [ADR-001](../adr/ADR-001-SINGLE-SELLER-ORDER.md) هر quote و سفارش دقیقاً یک فروشنده دارد و تمام اقلام سفارش از همان فروشنده‌اند. خرید از چند فروشنده نیازمند سفارش‌های مستقل است. طبق [ADR-002](../adr/ADR-002-CUSTOMER-CHOICE-PARTIAL-BASKET.md) انتخاب فروشنده‌ای که فقط بخشی از سبد را تأمین می‌کند مجاز است؛ پاسخ مقایسه و بازبینی باید اقلام قابل تأمین و ناموجود، جمع اقلام قابل تأمین و نیاز به تأیید حذف اقلام ناموجود از این سفارش را جدا نشان دهد. طبق [ADR-003](../adr/ADR-003-CUSTOMER-CONTROL-UNFULFILLED-CART-ITEMS.md)، انتخاب مشتری درباره نگه‌داشتن یا حذف اقلام تأمین‌نشده از **سبد آینده** باید مستقل از عدم ورود آن اقلام به سفارش فعلی ذخیره و به‌صورت idempotent اعمال شود؛ رفتار خودکار یا فرض از سمت API ممنوع است. درخواست ساخت `POST /quotes` باید به شناسه سبد، فروشنده/پیشنهاد منتخب، نشانی تحویل، روش ارائه و حالت خرید اشاره کند. پاسخ پیشنهادی:

```json
{
  "quoteId": "quo_sample",
  "sellerId": "sel_sample",
  "cityId": "city_sample",
  "serviceZoneId": "zone_sample",
  "purchaseType": "PERSONAL",
  "currency": "IRR",
  "itemsTotalIrr": 2650000,
  "deliveryTotalIrr": 0,
  "buyerDeliveryShareIrr": 0,
  "sellerDeliveryShareIrr": 0,
  "deliveryQuoteId": null,
  "deliveryTariffVersion": null,
  "discountIrr": 0,
  "creditAppliedIrr": 0,
  "payableIrr": 2650000,
  "expiresAt": "2026-09-19T16:30:00Z",
  "offerVersion": 1,
  "policyVersion": 1,
  "availableFulfillmentModes": ["DELIVERY"]
}
```

اعداد نمونه صرفاً شرح نوع داده هستند، نه قیمت واقعی حنا. سرور همواره قیمت و eligibility را بازسنجی می‌کند. استفاده از اعتبار حمایتی برای `LEGAL` ممنوع است. هر تغییر قیمت/ارسال/اقلام پیش از تأیید پرداخت به کاربر اعلام می‌شود.

## انتخاب روش دریافت و تخصیص مجری ارسال

طبق [ADR-005](../adr/ADR-005-PICKUP-CUSTOMER-DELIVERY-ASSIGNMENT-LOGISTICS.md) انتخاب حضوری در صورت امکان با مشتری است؛ در حالت ارسال، لجستیک حنا تعیین می‌کند که مجری ارسال فروشنده یا ناوگان خودش باشد. `fulfillmentMode` انتخاب معتبر مشتری است ولی `deliveryAssignment` فقط از پاسخ/رویداد معتبر لجستیک تعیین می‌شود، نه ورودی قابل اعتماد مشتری. هزینه و شرایط حمل در quote باید قابل تأیید باشد؛ تغییر مؤثر به بازبینی مجدد نیاز دارد. وضعیت تحویل حضوری جدا از مأموریت حمل ثبت شود.

## قرارداد قیمت ارسال و سهم طرفین

طبق [ADR-006](../adr/ADR-006-LOGISTICS-DELIVERY-FEE-SPLIT.md)، لجستیک حنا مبلغ کل مأموریت را تعیین می‌کند؛ در حالت معمول سهم خریدار و فروشنده ۵۰/۵۰ است. مدل API باید `deliveryTotalIrr`, `buyerDeliveryShareIrr`, `sellerDeliveryShareIrr`, `deliveryQuoteId`, `deliveryTariffVersion` و اعتبار زمانی پیشنهاد را جدا حمل کند. مبلغ قابل پرداخت خریدار فقط سهم خریدار را لحاظ می‌کند؛ سهم فروشنده طبق [ADR-007](../adr/ADR-007-SELLER-DELIVERY-SHARE-DEDUCTED-AT-SETTLEMENT.md) در حنا یک بار از تسویه فروشنده کسر و جدا در settlement و ledger ثبت می‌شود؛ بابت همان سهم نباید مجدداً از مشتری یا فروشنده مبلغ مستقلی دریافت شود. حالت مراجعه حضوری هزینه مأموریت ارسال ندارد. گردکردن اعداد فرد، تعرفه شهر و استثناهای ۵۰/۵۰ تا تصویب قرارداد مالی تعیین‌نشده‌اند.

## قرارداد تسویه سهم حمل فروشنده

طبق [ADR-007](../adr/ADR-007-SELLER-DELIVERY-SHARE-DEDUCTED-AT-SETTLEMENT.md) مبلغ `sellerDeliveryShareIrr` در حنا از تسویه همان فروشنده کسر می‌شود. پاسخ گزارش سفارش/تسویه باید ارزش اقلام، سهم حمل فروشنده، سایر کسورات مصوب و خالص تسویه را جدا نشان دهد. ledger entry مربوط به سهم حمل باید به order، seller، مأموریت حمل/صورت‌حساب لجستیک و settlement مرتبط باشد و در callback/retry تکراری دوباره ایجاد نشود. زمان نهایی‌سازی کسر، مبلغ ناکافیِ قابل تسویه، قواعد refund و settlement دو کسب‌وکار هنوز نیازمند قرارداد مالی مصوب‌اند.

## ممنوعیت پرداخت در محل

طبق [ADR-009](../adr/ADR-009-NO-CASH-ON-DELIVERY.md)، `COD`/پرداخت نقدی یا کارت‌خوان هنگام تحویل در اپ، وب و API مجاز نیست؛ درخواست با این mode باید رد شود. وضعیت پرداخت نامعلوم، ناموفق یا در انتظار نباید به‌عنوان سفارش مجاز برای تحویل به لجستیک یا فروشنده ارسال شود. انتخاب دریافت حضوری نیز مجوز پرداخت هنگام مراجعه نیست. روش‌های غیرحضوری دقیق تابع سیاست پرداخت و اعتبار مصوب هستند.

## قرارداد فرمان‌های مالی

- `POST /orders` با `Idempotency-Key` ثابت برای یک تلاش ساخت سفارش.
- `POST /orders/{id}/payment-attempts` با کلید مستقل و وضعیت `PENDING|SUCCEEDED|FAILED|UNKNOWN`.
- webhooks PSP فقط از مسیر پشت adapter با امضا/secret و **تأیید server-to-server** معتبر می‌شوند.
- ledger و credit reservation با شناسه سفارش/تلاش/تخصیص یکتا، مانده کنترل‌شده و reconciliation اجرا می‌شوند.
- پاسخ `202` برای کارهای پردازش غیرهمزمان و آدرس پیگیری؛ عدم موفقیت بیرونی نباید «موفق» جلوه کند.
- عملیات فروشنده/ادمین از ماشین حالت سفارش و پرونده تبعیت می‌کنند، نه متن دکمه UI.

## کنترل دسترسی و جداسازی اطلاعات

- خریدار: فقط حساب/سفارش/اعتبار متعلق به خودش.
- فروشنده: سفارش و موجودی فروشنده فعال خودش؛ دسترسی قبل از approval ممنوع.
- سازمان: داده طرح/مشمول/تخصیص خودش بر اساس مجوز ثبت‌شده؛ عدم دسترسی به تراکنش شخصیِ نامرتبط.
- پشتیبان: سطح مشاهده و action حداقلی؛ یادداشت داخلی هرگز در API خریدار قرار نگیرد.
- ادمین: دسترسی مبتنی بر نقش و عملیات حساس audit شده؛ فرض دسترسی بی‌حد ممنوع.

## کدهای خطای دامنه نمونه

`SERVICE_CITY_NOT_LIVE`, `ADDRESS_OUT_OF_COVERAGE`, `OFFER_NOT_AVAILABLE`, `QUOTE_EXPIRED`, `QUOTE_CHANGED`, `STOCK_RESERVATION_FAILED`, `PAYMENT_STATUS_UNKNOWN`, `CREDIT_NOT_ELIGIBLE`, `CREDIT_INSUFFICIENT`, `SELLER_NOT_APPROVED`, `ORGANIZATION_SCOPE_DENIED`, `IMPORT_RECORD_INVALID`.

## گیت نهایی شدن

D01 تک‌فروشنده‌ای و اصل انتخاب سبد ناقص در D02 تصویب شده‌اند؛ پس از تصویب باقی قواعد D02–D10 در سند V1.0: OpenAPI 3.1 برای API، JSON schemaهای درخواست/پاسخ، AsyncAPI یا schema رخداد، auth matrix و contract tests ثبت شوند. تا آن زمان این قرارداد راهنمای طراحی است.
