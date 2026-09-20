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

طبق [ADR-007](../adr/ADR-007-SELLER-DELIVERY-SHARE-DEDUCTED-AT-SETTLEMENT.md) مبلغ `sellerDeliveryShareIrr` در حنا از تسویه همان فروشنده کسر می‌شود. پاسخ گزارش سفارش/تسویه باید ارزش اقلام، سهم حمل فروشنده، سایر کسورات مصوب و خالص تسویه را جدا نشان دهد. ledger entry مربوط به سهم حمل باید به order، seller، مأموریت حمل/صورت‌حساب لجستیک و settlement مرتبط باشد و در callback/retry تکراری دوباره ایجاد نشود. اصل بازپرداخت کامل خریدار در لغو مجاز طبق [ADR-013](../adr/ADR-013-FULL-BUYER-REFUND-ON-VALID-CANCELLATION.md) و اعتبارکردن بخش نقدی به کیف پول طبق [ADR-014](../adr/ADR-014-WALLET-REFUND-OPTIONAL-CASHOUT.md) تصویب شده‌اند؛ طبق [ADR-029](../adr/ADR-029-DEDUCT-LATE-RETURN-PENALTY-FROM-SELLER-SETTLEMENT.md)، جریمه دیرکرد بازپس‌گیری کالای خراب نیز جدا از سهم حمل از تسویه فروشگاه کسر و در گزارش فروشنده نمایش داده می‌شود؛ طبق [ADR-032](../adr/ADR-032-HOLD-INVOICE-SETTLEMENT-UNTIL-SUPPORT-RESOLVES-ITEM-INCIDENT.md)، گزارش به‌موقع کسری/خرابی تسویه همان فاکتور را تا اعلام نتیجه پشتیبانی در وضعیت `SETTLEMENT_ON_HOLD` نگه می‌دارد؛ طبق [ADR-033](../adr/ADR-033-HOLD-DAMAGED-INVOICE-THROUGH-SELLER-COLLECTION-SLA.md) اگر خرابی تأییدشده نیازمند بازپس‌گیری باشد، hold پس از تأیید تا تعیین نتیجه بازپس‌گیری یا مهلت `sellerReturnDueAt` و ثبت کسر جریمه احتمالی ادامه دارد؛ طبق [ADR-034](../adr/ADR-034-RELEASE-SETTLEMENT-HOLD-ON-EARLY-DAMAGED-RETURN-COLLECTION.md)، دریافت فیزیکی معتبر با `sellerCollectedAt <= sellerReturnDueAt` رفع همان‌موقع hold جمع‌آوری بدون جریمه را مجاز می‌کند؛ طبق [ADR-035](../adr/ADR-035-CALL-CUSTOMER-FIRST-EXEMPT-VERIFIED-CUSTOMER-UNAVAILABILITY.md)، تماس اولیه فروشگاه با مشتری و نتیجه آن (`sellerFirstContactAt`, `contactOutcome` و مستندات) باید ثبت شوند؛ طبق [ADR-036](../adr/ADR-036-SELLER-MUST-VISIT-CUSTOMER-DOOR-AFTER-FIRST-CALL.md) برای معافیت ادعای عدم دسترسی، `sellerArrivedAtCustomerDoorAt <= sellerReturnDueAt` با مستند معتبر حضور در درِ نشانی نیز الزامی است؛ تماس بی‌پاسخ به‌تنهایی کافی نیست؛ عدم دریافت ناشی از عدم دسترسی مشتری فقط پس از بررسی پشتیبانی، وضعیت `CUSTOMER_UNAVAILABLE_VERIFIED`، بدون `sellerCollectedAt` صوری و بدون کسر جریمه دارد؛ hold پرونده پس از تصمیم پشتیبانی آزاد می‌شود؛ طبق [ADR-037](../adr/ADR-037-NO-SECOND-SELLER-VISIT-AFTER-VERIFIED-CUSTOMER-UNAVAILABILITY.md) پس از `CUSTOMER_UNAVAILABLE_VERIFIED` سفارش مراجعه مجدد اجباری یا SLA جدید برای همان پرونده ساخته نشود، حتی اگر مشتری بعداً اعلام آمادگی کند؛ پرونده پس از پرداخت تسویه فاکتور و مبلغ ناکافی پس از سایر کسورات، زمان نهایی‌سازی کسر، سهم فروشنده و صورتحساب لجستیک پس از لغو، زمان/مسیر عودت بانکی و settlement دو کسب‌وکار هنوز نیازمند قرارداد مالی مصوب‌اند.

## چرخه تسویه پایان هر روز کاری همه فروشگاه‌ها

طبق [ADR-038](../adr/ADR-038-ALL-SELLERS-SETTLED-END-OF-EACH-WORKDAY.md)، تسویه مبالغ **واجد شرایط همه فروشگاه‌ها در پایان هر روز کاری حنا** انجام می‌شود؛ عبارت تاریخی «یک روز بعد از پرداخت/تحویل» در ADR-008 دیگر مبنای eligibility نیست. سرویس مالی باید `settlementCycleId`، `businessDate`، `cycleState`، `cycleClosedAt`، وضعیت payment attempt/تطبیق و فهرست فاکتورهای انتخاب‌شده و مستثناشده از batch را قابل پیگیری کند. طبق [ADR-039](../adr/ADR-039-THURSDAY-IS-HANA-SELLER-SETTLEMENT-BUSINESS-DAY.md) و [ADR-040](../adr/ADR-040-FRIDAY-IS-HANA-SELLER-SETTLEMENT-BUSINESS-DAY.md)، پنجشنبه و جمعه باید هر دو روز کاری عادی batch تسویه شناخته شوند؛ طبق [ADR-041](../adr/ADR-041-SETTLE-ALL-SELLERS-ON-OFFICIAL-HOLIDAYS.md) **تعطیلات رسمی نیز بدون حذف از چرخه، در پایان همان روز پردازش می‌شوند**. همه روزهای تقویمی چرخه دارند؛ طبق [ADR-042](../adr/ADR-042-AUTOMATIC-SELLER-SETTLEMENT-AT-MIDNIGHT-BANK-CYCLE-DEPENDENT.md) اجرای خودکار حنا **هر شب ۰۰:۰۰ نیمه‌شب** است و چرخه در مرز ورود به تاریخ جدید برای روز پایان‌یافته ثبت می‌شود؛ فقط منطقه زمانی مرجع و زمان وصول واقعی بر اساس چرخه بانک هنوز policy بازند و نباید در API حدس زده شوند.

در `GET /seller/settlements` و نمای مالی مدیر، فاکتور دارای `SETTLEMENT_ON_HOLD` با علت و `incidentId` جدا نمایش داده شود؛ **hold یک فاکتور مانع سایر فاکتورهای قابل‌تسویه همان فروشگاه نیست**. رفع hold در میانه روز به معنی submit فوری پرداخت نیست؛ به چرخه پایان روز کاری واجد شرایط بازمی‌گردد. `PAID` فقط پس از تأیید واقعی/تطبیق انتقال است، نه صرف enqueue یا submit batch. قرارداد endpointهای پیشنهادی، guard پرداخت و ادله QA در [قرارداد جزئی](HANA-INCIDENT-SETTLEMENT-API-CONTRACT-v0.1.md) و [ماتریس آزمون](../testing/HANA-INCIDENT-SETTLEMENT-ACCEPTANCE-MATRIX-v0.1.md) آمده‌اند.

## لغو سفارش سوپرمارکتی تا پیش از تحویل به پیک یا دریافت حضوری

طبق [ADR-011](../adr/ADR-011-CANCEL-UNTIL-HANDOFF-TO-COURIER.md)، خریدار می‌تواند سفارش ارسالی را حتی بعد از شروع آماده‌سازی، تا قبل از **تحویل واقعی به پیک** لغو کند؛ endpoint پیشنهادی `POST /orders/{id}/cancel` با کنترل مالکیت، `Idempotency-Key` و بررسی اتمیک state/version و رویداد handoff معتبر. `SELLER_CONFIRMED`، `PREPARING`، `READY_FOR_PICKUP` و تخصیص پیک به‌تنهایی لغو را ممنوع نمی‌کنند. API باید تعارض لغو/تحویل واقعی به پیک را با وضعیت واقعی پاسخ دهد؛ درخواست لغو تکراری نباید دو استرداد یا دو رویداد لجستیک بسازد. برای `fulfillmentMode=PICKUP` طبق [ADR-012](../adr/ADR-012-PICKUP-CANCEL-UNTIL-COLLECTION.md)، همین API تا پیش از دریافت واقعی توسط مشتری مجاز است؛ `READY_FOR_PICKUP` مانع لغو نیست و رقابت لغو با ثبت دریافت واقعی باید اتمیک حل شود. طبق [ADR-013](../adr/ADR-013-FULL-BUYER-REFUND-ON-VALID-CANCELLATION.md)، لغو مجاز باید بازپرداخت کامل مبلغ واقعاً پرداخت‌شده مشتری شامل سهم او از ارسال و بدون جریمه را ایجاد/پیگیری کند؛ منبع اعتبار غیرنقدی طبق قواعد همان منبع آزاد/بازگردانده می‌شود. طبق [ADR-014](../adr/ADR-014-WALLET-REFUND-OPTIONAL-CASHOUT.md)، بخش نقدی مبلغ بازپرداخت ابتدا به موجودی قابل‌استرداد کیف پول حنا و بخش اعتباری به منبع خود برمی‌گردد. عودت وجه بانکی تنها با درخواست مشتری است، نه به‌طور خودکار. طبق [ADR-018](../adr/ADR-018-SAME-CANCEL-CUTOFF-FOR-ALL-COURIERS.md) هویت مجری حمل، مرز لغو را عوض نمی‌کند: تحویل واقعی به پیک شبکه یا فروشنده-پیک با رویداد معتبر لجستیک ثبت می‌شود. طبق [ADR-019](../adr/ADR-019-NO-CANCEL-AFTER-COURIER-HANDOFF.md)، پس از handoff معتبر، `POST /orders/{id}/cancel` یا هر «درخواست لغو» باید با خطای وضعیت قابل فهم رد شود و مسیر `POST /orders/{id}/incidents` (قرارداد پیشنهادی) برای گزارش مشکل قابل استفاده باشد؛ گزارش مشکل به‌خودی‌خود refund یا لغو ایجاد نمی‌کند. طبق [ADR-020](../adr/ADR-020-FULL-REFUND-ON-CONFIRMED-NONDELIVERY.md)، اگر گزارش نرسیدن **کل سفارش** پس از بررسی تأیید شود، workflow مستقل incident resolution باید یک refund کامل و idempotent، شامل سهم خریدار از ارسال، ایجاد کند؛ بخش نقدی به کیف پول قابل‌استرداد و سهم اعتبار محدود به منبع اصلی برگردد. پیوندهای `incidentId`, `orderId`, `deliveryJobId`, `refundId` و وضعیت تأیید باید قابل audit باشند؛ تأیید عدم‌تحویل نباید به‌صورت لغو صوری پیش از handoff ثبت شود. زمان/ضوابط اجرایی عودت بانکی و روش نهایی تأیید handoff در قرارداد لجستیک منتظر تکمیل‌اند.

## گزارش کسری و خرابی اقلام با عکس

طبق [ADR-021](../adr/ADR-021-ITEM-SHORTAGE-DAMAGE-PHOTO-SELLER-RESOLUTION.md)، `POST /orders/{id}/incidents` باید پرونده سطح قلم را با نوع `MISSING_ITEM | DAMAGED_ITEM`، شناسه قلم سفارش، تعداد/مقدار متأثر، شرح و عکس‌های پیوست‌شده بپذیرد و **ابتدا به پشتیبانی حنا** برای بررسی و تأیید برساند؛ طبق [ADR-023](../adr/ADR-023-SUPPORT-APPROVAL-SELLER-COLLECTS-DAMAGED-GOODS.md) فقط پس از تأیید پشتیبانی، پرونده برای هماهنگی با فروشگاه مربوط ارجاع شود. در مرجوعی خرابی، فروشگاه خودش مسئول مراجعه و دریافت کالاست و API نباید ایجاد مأموریت پیک از لجستیک حنا برای این بازپس‌گیری را مجاز کند. عکس و نتیجه فروشگاه باید دسترسی محدود و audit داشته باشد. درخواست‌های تکراری نباید به استرداد دوباره منجر شوند. طبق [ADR-022](../adr/ADR-022-ITEM-ISSUE-REFUND-TO-WALLET-OPTIONAL-WITHDRAWAL.md)، در نتیجه مصوبِ بازپرداخت قلم، سهم نقدی جبران ابتدا به موجودی قابل‌استرداد کیف پول حنا می‌رود و عودت بانکی فقط به درخواست مشتری، با قواعد ADR-015 تا ADR-017 انجام می‌شود؛ سهم اعتبار محدودشده به منبع خودش برمی‌گردد. طبق [ADR-024](../adr/ADR-024-IMMEDIATE-WALLET-REFUND-ON-APPROVED-DAMAGE.md) در پرونده خرابی با نتیجه تأییدشده جبران مالی، عملیات بستانکاری کیف پول باید **همان موقع پس از ثبت تأیید پشتیبانی** به‌صورت idempotent اجرا شود و نباید منتظر `SELLER_RETURN_COLLECTED` بماند؛ نتیجه واقعی کیف پول و وضعیت بازپس‌گیری مستقل نمایش داده شوند. طبق [ADR-025](../adr/ADR-025-SELLER-COLLECTS-DAMAGED-RETURN-WITHIN-ONE-HOUR.md)، مهلت جمع‌آوری واقعی کالای خراب توسط خود فروشگاه حداکثر ۶۰ دقیقه است؛ مبدأ شمارش **ثبت تأیید خرابی توسط پشتیبانی حنا** است: `sellerReturnSlaStartAt = supportApprovedAt` و `sellerReturnDueAt = supportApprovedAt + 60 minutes`؛ تأخیر ابلاغ به فروشگاه موعد را تمدید نمی‌کند. زمان‌های تأیید، ابلاغ، جمع‌آوری واقعی و وضعیت نقض SLA در API پرونده/پنل فروشگاه باید قابل ردیابی باشند. طبق [ADR-026](../adr/ADR-026-SELLER-PENALTY-FOR-LATE-DAMAGED-RETURN.md)، تأخیر جمع‌آوری باید با رویداد یکتای `SELLER_RETURN_SLA_BREACHED`/معادل، شناسه پرونده، فروشگاه و زمان واقعی قابل رسیدگی به مالی ارجاع شود؛ طبق [ADR-027](../adr/ADR-027-LATE-DAMAGED-RETURN-PENALTY-EQUALS-ITEM-PRICE.md) مبلغ جریمه معادل قیمت کالای خرابِ همان پرونده است؛ طبق [ADR-028](../adr/ADR-028-PENALTY-USES-ACTUAL-ORDER-ITEM-PRICE.md) مبنای جریمه `actualOrderItemPriceAfterDiscount` یا معادل snapshot مالی همان قلم/تعداد در سفارش است، نه قیمت اصلی یا روز کاتالوگ؛ سهم نقدی شیوه پرداخت نباید با قیمت قلم اشتباه گرفته شود. طبق [ADR-029](../adr/ADR-029-DEDUCT-LATE-RETURN-PENALTY-FROM-SELLER-SETTLEMENT.md)، وصول جریمه از تسویه همان فروشگاه در حنا با `sellerPenaltyDeductionIrr` یا معادل، به صورت ردیف جدا از `sellerDeliveryShareIrr` و دارای پیوند `settlementId`، `incidentId` و `slaBreachId` انجام شود. وجه فاکتور تا پیش از اجرای تسویه نزد حناست و جریمه در تسویه همان فاکتور به‌عنوان کسر فروشگاه اعمال می‌شود؛ طبق [ADR-030](../adr/ADR-030-CUSTOMER-DAMAGE-REPORT-WITHIN-ONE-HOUR-OF-RECEIPT.md) اعلام خرابی توسط مشتری تا یک ساعت از دریافت واقعی است، نه لزوماً زمان تأیید نهایی پشتیبانی؛ تخصیص تخفیف سبدی و همپوشانی چند گزارش نیازمند تکمیل‌اند؛ برای پرونده پس از پرداخت تسویه فاکتور یا کمبود ناشی از سایر کسورات، carry-forward، کسر منفی یا برداشت بانکی بدون مصوبه ساخته نشود. طبق [ADR-030](../adr/ADR-030-CUSTOMER-DAMAGE-REPORT-WITHIN-ONE-HOUR-OF-RECEIPT.md)، برای `DAMAGED_ITEM`، ثبت گزارش اولیه باید حداکثر تا `damageReportDueAt = customerReceivedAt + 60 minutes` مجاز باشد؛ `customerReceivedAt` زمان دریافت واقعی مشتری است، نه `courierHandoffAt` یا `readyAt`، و `incidentReportedAt` باید در سرور ثبت شود. طبق [ADR-031](../adr/ADR-031-MISSING-ITEM-REPORT-WITHIN-ONE-HOUR-OF-RECEIPT.md)، همین مهلت برای `MISSING_ITEM` نیز برقرار است: `incidentReportDueAt = customerReceivedAt + 60 minutes` و `incidentReportedAt <= incidentReportDueAt` برای هر دو نوع گزارش اعمال شود. مهلت گزارش مشتری با مهلت تأیید پشتیبانی یا بازپس‌گیری کالای خراب توسط فروشگاه یکی نیست؛ استثناهای مستند و خطای ثبت تحویل هنوز بازند. طبق [ADR-032](../adr/ADR-032-HOLD-INVOICE-SETTLEMENT-UNTIL-SUPPORT-RESOLVES-ITEM-INCIDENT.md)، ایجاد معتبر `MISSING_ITEM | DAMAGED_ITEM` در مهلت باید اتمیک با مانع اجرای پرداخت تسویه همان `orderId`/فاکتور باشد؛ وضعیت hold، `incidentId`، علت و `supportDecisionAt` در گزارش تسویه قابل مشاهده باشند. رد نهایی پشتیبانی hold بررسی همان پرونده را رفع می‌کند، نه hold پرونده‌های دیگر؛ در تأیید خرابی نیازمند بازپس‌گیری، انتقال اتمیک `INCIDENT_SUPPORT_REVIEW_HOLD` به `DAMAGED_RETURN_SLA_HOLD` طبق [ADR-033](../adr/ADR-033-HOLD-DAMAGED-INVOICE-THROUGH-SELLER-COLLECTION-SLA.md) مانع آزادسازی بین دو مرحله شود. hold بازپس‌گیری طبق [ADR-034](../adr/ADR-034-RELEASE-SETTLEMENT-HOLD-ON-EARLY-DAMAGED-RETURN-COLLECTION.md) **همان موقع پس از دریافت واقعی معتبر در مهلت**، بدون جریمه و با بررسی سایر holdها رفع شود؛ در انقضای مهلت بدون دریافت، جزئیات ادعای عدم دسترسی مشتری برای بررسی پشتیبانی و معافیت احتمالی طبق ADR-035 لحاظ شود؛ اگر معافیت احراز نشد، hold فقط پس از ثبت/اعمال idempotent جریمه مقتضی رفع شود؛ طبق [ADR-036](../adr/ADR-036-SELLER-MUST-VISIT-CUSTOMER-DOOR-AFTER-FIRST-CALL.md)، تماس بی‌پاسخ **بدون مراجعه به درِ نشانی در مهلت** به معنی `SELLER_RETURN_COLLECTED` یا معافیت قطعی نیست. پشتیبانی باید تماس، حضور به‌موقع و علت واقعی عدم دریافت را بررسی کند؛ `sellerCollectedAt` فقط در دریافت فیزیکی ثبت شود. پس از تأیید عدم دسترسی مشتری، طبق [ADR-037](../adr/ADR-037-NO-SECOND-SELLER-VISIT-AFTER-VERIFIED-CUSTOMER-UNAVAILABILITY.md)، رویداد بعدی تماس مشتری نباید به‌صورت خودکار تعهد مراجعه مجدد یا hold تازه ایجاد کند؛ جبران کیف پول مشتری محفوظ است. رقابت callback دریافت واقعی با timer انقضای SLA باید اتمیک و قابل حسابرسی باشد. جبران فوری مشتری به تسویه وابسته نیست؛ رفع hold پرداخت بانکی فوری خارج از چرخه تسویه را الزام نمی‌کند.

## مسیر فنی قابل‌تبدیل به OpenAPI برای گزارش و تسویه

جزئیات **پیشنهادی** request/response، actors، خطاها، زمان‌های سروری، ماشین حالت، idempotency و رویدادهای داخلی در [قرارداد جزئی کسری/خرابی و تسویه](HANA-INCIDENT-SETTLEMENT-API-CONTRACT-v0.1.md) آمده است. سناریوهای تست قراردادی و رقابت زمان‌سنج در [ماتریس آزمون](../testing/HANA-INCIDENT-SETTLEMENT-ACCEPTANCE-MATRIX-v0.1.md) و مرز تراکنش‌های مالی در [طراحی فنی جریان](../architecture/HANA-INCIDENT-REFUND-SETTLEMENT-TECHNICAL-DESIGN-v0.1.md) تعریف شده‌اند.

**قانون تکمیل:** `POST /orders/{id}/incidents` و افزودن hold همان فاکتور در برابر `settlement-payout submit` باید اتمیک باشند؛ تأیید خرابی همراه با بستانکاری فوری کیف پول، جایگزینی بدون فاصله hold بررسی با hold جمع‌آوری و زمان‌سنج یک‌ساعته است. در `CUSTOMER_UNAVAILABLE_REVIEW` بدون احراز پشتیبانی نه جریمه قطعی کسر شود و نه تسویه آزاد؛ در `CUSTOMER_UNAVAILABLE_VERIFIED` مشتری هنوز کالا را دارد، فروشگاه مراجعه مجدد اجباری ندارد و جریمه صفر است. نام مسیرها و خطاهای سند جزئی پیش‌نویس فنی‌اند و جای سیاست‌های هنوز باز را پر نمی‌کنند.

## کیف پول بازپرداخت و درخواست عودت بانکی

طبق [ADR-014](../adr/ADR-014-WALLET-REFUND-OPTIONAL-CASHOUT.md)، endpointهای پیشنهادیِ نیازمند OpenAPI نهایی شامل `GET /me/wallet`، `GET /me/wallet/transactions`، `POST /me/wallet/withdrawal-requests` و `GET /me/wallet/withdrawal-requests/{id}` هستند. درخواست عودت فقط از وجه نقد قابل‌استرداد مجاز است؛ مبلغ رزروشده برای انتقال هم‌زمان قابل خرج نیست؛ اعتبار حمایتی یا تخفیف نباید نقد شود. طبق [ADR-015](../adr/ADR-015-WITHDRAWAL-TO-OWN-VERIFIED-IBAN.md)، مقصد درخواست عودت فقط شبای حساب متعلق به خود مشتری است؛ بررسی مالکیت با سرویس/فرآیند معتبر و auditable لازم است. تطابق فرمت شبا یا نام واردشده به‌تنهایی کافی نیست. طبق [ADR-016](../adr/ADR-016-FEE-FREE-FULL-WALLET-WITHDRAWAL.md)، `customerWithdrawalFeeIrr=0` و `bankTransferPrincipalIrr=withdrawalRequestedIrr` است؛ هر هزینه تأمین‌کننده جداگانه در حساب‌های کسب‌وکار ثبت می‌شود و نباید از مبلغ مشتری کم شود. طبق [ADR-017](../adr/ADR-017-WALLET-WITHDRAWAL-WITHIN-72-HOURS.md)، عودت بانکی باید در مهلت حداکثر ۷۲ ساعت انجام شود؛ API باید timestampهای درخواست، پذیرش و سررسید، وضعیت انتقال و شناسه پیگیری را نمایش دهد. مبدأ مهلت طبق ADR-017 **زمان ثبت درخواست مشتری** است: `withdrawalDueAt = requestedAt + 72 hours`؛ تأیید بعدی شبا، مبدأ را جابه‌جا نمی‌کند. اعتبارسنجی/رد درخواست ناقص باید با وضعیت و علت شفاف مدیریت شود. وضعیت انتقال، خطای بانکی، dedup و احراز مالکیت مقصد باید به‌صورت واقعی در API پیاده شوند.

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
