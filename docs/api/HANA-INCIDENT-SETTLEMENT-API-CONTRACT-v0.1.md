# قرارداد فنی جزئی API و رویدادها — کسری/خرابی، مرجوعی و توقف تسویه (پیش‌نویس ۰.۱)

**وضعیت:** پیشنهاد contract-first در سطح فنی؛ endpointها، نام statusها و payload نمونه **هنوز OpenAPI نهایی/سرویس پیاده‌شده نیستند**. قواعد رفتاری از ADR-019 تا ADR-037 گرفته شده‌اند.  
**مرجع جریان:** [طراحی معماری](../architecture/HANA-INCIDENT-REFUND-SETTLEMENT-TECHNICAL-DESIGN-v0.1.md) · **آزمون:** [ماتریس پذیرش](../testing/HANA-INCIDENT-SETTLEMENT-ACCEPTANCE-MATRIX-v0.1.md).

## قرارداد عمومی

- prefix: `/api/v1`؛ زمان UTC/ISO-8601؛ پول integer ریال؛ ID opaque؛ `Idempotency-Key` برای هر فرمان ایجاد/تصمیم/تغییر مالی.
- توکن خریدار صرفاً سفارش متعلق به خود را می‌بیند؛ فروشگاه فقط سفارش همان seller را؛ پشتیبانی صرفاً scope و action مجاز؛ کارکنان مالی جدا از فروشنده.
- قیمت قلم، مبلغ refund و penalty، زمان «تحویل واقعی»، تاریخ تصمیم پشتیبانی و ساعت دریافت فیزیکی از ورودی کلاینت به‌عنوان مرجع حقیقت پذیرفته نشوند.
- هر mutation نتیجه `requestId`، `resourceId`، `version` و وضعیت قابل پیگیری دارد. retry همان key با payload یکسان، همان نتیجه منطقی؛ کلید یکسان با payload متفاوت = conflict.
- مسیرهای پیشنهادی زیر **command endpoint** هستند؛ idempotent بودن به معنای صدور دو refund یا دو settlement نیست.

## ۱. خریدار: دریافت سفارش و گزارش

| method و مسیر پیشنهادی | actor | ورودی/اثر |
|---|---|---|
| `GET /orders/{orderId}` | buyer صاحب سفارش | `customerReceivedAt`، `incidentReportDueAt`، وضعیت گزارش‌ها/بازپرداخت مجاز برای نمایش |
| `POST /orders/{orderId}/incidents` | buyer صاحب سفارش | نوع، orderItemId، تعداد، شرح، attachmentIds؛ ثبت سروری `incidentReportedAt` و hold همان فاکتور اگر به‌موقع |
| `GET /orders/{orderId}/incidents/{incidentId}` | buyer/role مجاز | مرحله رسیدگی، نتیجه قابل نمایش، وضعیت refund و بازپس‌گیری؛ بدون یادداشت محرمانه/موقعیت مأمور |
| `GET /me/wallet/transactions` | buyer | cash قابل برداشت از credit محدود جدا |

**شرط اعتبار ثبت اولیه** برای هر دو `DAMAGED_ITEM | MISSING_ITEM`:

```text
customerReceivedAt != null
incidentReportedAt <= customerReceivedAt + 60 minutes
```

- `customerReceivedAt` رویداد واقعی دریافت توسط مشتری است؛ نه `courierHandoffAt` یا آماده‌شدن سفارش؛ باید منبع/زمان تأیید آن در domain event قابل audit باشد.
- تاریخ سرور برای گزارش مبناست؛ نه ساعت دستگاه خریدار. گزارش ثبت‌شده در آخرین لحظه مرز مجاز است.
- گزارش معتبر صرفاً **hold پشتیبانی** می‌سازد؛ به‌تنهایی refund یا جریمه فروشگاه ایجاد نمی‌کند.
- قواعد گزارش پس از مهلت، خطای timestamp تحویل و استثناهای مستند هنوز policy بازند؛ خطای پیشنهادی `INCIDENT_REPORT_WINDOW_EXPIRED` فقط وقتی داده مبدأ معتبر و سیاست رد بدون استثنا مشخص باشد.

نمونه درخواست/پاسخ پیشنهادی (عددها و زمان‌ها صرفاً نمونه):

```json
POST /api/v1/orders/ord_42/incidents
Idempotency-Key: inc-ord42-item7-try1

{
  "incidentType": "DAMAGED_ITEM",
  "orderItemId": "oi_7",
  "affectedQuantity": 1,
  "description": "کالا خراب است",
  "attachmentIds": ["att_38"]
}
```

```json
{
  "incidentId": "inc_12",
  "orderId": "ord_42",
  "incidentType": "DAMAGED_ITEM",
  "supportState": "UNDER_REVIEW",
  "incidentReportedAt": "2026-09-20T10:44:00Z",
  "customerReceivedAt": "2026-09-20T10:00:00Z",
  "incidentReportDueAt": "2026-09-20T11:00:00Z",
  "settlementHold": {"reason": "INCIDENT_SUPPORT_REVIEW_HOLD", "active": true},
  "refundState": "NOT_APPROVED",
  "version": 1
}
```

## ۲. پشتیبانی: رسیدگی/تأیید/رد

| method و مسیر پیشنهادی | actor | الزامات |
|---|---|---|
| `GET /support/incidents?state=UNDER_REVIEW` | support | paginated، scope، safe PII |
| `POST /support/incidents/{incidentId}/decision` | support مجاز | `APPROVE | REJECT`، علت و نتیجه مصوب جبران، version مورد انتظار، idempotency key |
| `POST /support/item-returns/{returnId}/unavailability-decision` | support مجاز | `VERIFY | REJECT` پس از بررسی مدارک تماس، حضور در مهلت و علت عدم دریافت |

تأیید خرابی با بازپس‌گیری:
- زمان واقعی تصمیم سرور: `supportApprovedAt`؛ مهلت فروشگاه `sellerReturnDueAt = supportApprovedAt + 60m`.
- در یک **تراکنش اتمیک** refund مصوب در ledger/wallet ثبت شود؛ hold بررسی به hold جمع‌آوری تبدیل و بازپس‌گیری فروشگاه فعال شود؛ اعلان به فروشگاه از outbox.
- اختصاص جبران cash به کیف پول **قابل‌استرداد**، credit به منشأ محدودشده؛ مشتری لازم نیست برای cashout خودکار اقدامی کند ولی درخواست انتقال بانکی اختیاری است.
- تأیید کسری **returnJob نمی‌سازد**؛ صرفاً جبران مصوب و رفع hold بررسی پس از ثبت اصلاحات مالی.
- اگر گزارش رد شد، فقط hold همان incident رفع شود؛ سایر incidentها فعال بمانند.

نمونه پاسخ تصمیم خرابی:

```json
{
  "incidentId": "inc_12",
  "supportState": "APPROVED",
  "supportApprovedAt": "2026-09-20T11:15:00Z",
  "refund": {
    "refundId": "ref_77",
    "state": "POSTED",
    "cashWalletCreditIrr": 800000,
    "restrictedCreditRestoredIrr": 0
  },
  "itemReturn": {
    "returnId": "ret_12",
    "sellerReturnDueAt": "2026-09-20T12:15:00Z",
    "state": "PENDING_CONTACT"
  },
  "settlementHold": {"reason": "DAMAGED_RETURN_SLA_HOLD", "active": true}
}
```

مبالغ مثال به معنی تعیین قاعده جدید refund اقلام، مالیات/ارسال یا تخصیص تخفیف مشترک نیست.

## ۳. فروشگاه: تماس، حضور در درِ مشتری و دریافت فیزیکی

| method و مسیر پیشنهادی | actor | اثر |
|---|---|---|
| `GET /seller/item-returns/{returnId}` | seller صاحب پرونده | زمان باقی‌مانده، مرحله، عمل مجاز؛ شماره/نشانی فقط مطابق دسترسی عملیاتی مجاز |
| `POST /seller/item-returns/{returnId}/contact-attempts` | seller | تماس **اولیه** و outcome؛ زمان سروری و مرجع مستندات |
| `POST /seller/item-returns/{returnId}/doorstep-arrivals` | seller | حضور واقعی در نشانی پس از تماس؛ evidenceRefs و timestamp معتبر |
| `POST /seller/item-returns/{returnId}/collection` | seller | درخواست ثبت **دریافت واقعی کالا**؛ فقط پس از اعتبارسنجی واقعه/مأموریت |
| `POST /seller/item-returns/{returnId}/customer-unavailable` | seller | ادعای عدم دسترسی پس از تماس و حضور؛ ارجاع پشتیبانی، نه معافیت خودکار |

- تنها seller مربوط و مأمور احرازشده خودش مجازند؛ هیچ برگشت از طریق Hana Logistics ساخته نشود.
- `sellerFirstContactAt` و `sellerArrivedAtCustomerDoorAt <= sellerReturnDueAt` برای معافیت عدم دسترسی مشتری لازم‌اند. **یک تماس بی‌پاسخ بدون حضور درِ نشانی کافی نیست.**
- روش فنی اعتبارسنجی اثبات حضور (مکان، عکس، ترکیبی) هنوز محصول تصویب نکرده؛ فیلد generic `evidenceRefs` قرارداد را بدون تحمیل یک راهکار خاص توسعه می‌دهد.
- timestamp کاربر به‌تنهایی authoritative نیست؛ در ورودی `occurredAt` اگر وجود داشت صرفاً ادعا است و `verifiedAt` معتبر سرور/مدرک لازم است.
- در دریافت معتبر تا و شامل موعد: `COLLECTED_ON_TIME`، جریمه صفر، رفع فوری hold مربوط و بازگشت مشروط به چرخه تسویه عادی.
- در عدم دسترسی احرازشده: `CUSTOMER_UNAVAILABLE_VERIFIED`، بدون `sellerCollectedAt`، بدون جریمه/hold همان پرونده و **بدون الزام مراجعه دوم حتی اگر مشتری بعداً آماده باشد**.

نمونه نمایش وضعیت پشتیبانی پس از بررسی عدم دسترسی:

```json
{
  "returnId": "ret_12",
  "sellerFirstContactAt": "2026-09-20T11:20:00Z",
  "sellerArrivedAtCustomerDoorAt": "2026-09-20T11:46:00Z",
  "sellerCollectedAt": null,
  "sellerReturnDueAt": "2026-09-20T12:15:00Z",
  "state": "CUSTOMER_UNAVAILABLE_VERIFIED",
  "sellerPenaltyIrr": 0,
  "mandatorySellerRevisit": false,
  "settlementHold": {"active": false, "releasedReason": "CUSTOMER_UNAVAILABLE_VERIFIED"}
}
```

## ۴. مالی: holdها، جریمه و اجرای تسویه

| method و مسیر پیشنهادی | actor | اثر |
|---|---|---|
| `GET /seller/settlements/{settlementId}` | seller خود/finance مجاز | جمع اقلام، سهم حمل، کسور جریمه جدا، `activeHoldReasons`، net و payout state |
| `GET /admin/settlements/{settlementId}/holds` | support/finance دارای action | holdهای incident مستقل با دلیل و audit |
| `GET /admin/settlements/{settlementId}/deductions` | finance | پیوند orderItemId/incidentId/returnId/penaltyId |
| `POST /internal/settlement-payouts/{settlementId}/submit` | worker/finance با مجوز | اجرای guarded پرداخت در چرخه پایان روز کاری ADR-038، **فقط** اگر hold فعال صفر، eligibility مالی و ledger معتبر باشد |
| `GET /admin/settlement-cycles/{cycleId}` | finance مجاز | `businessDate`, `cycleCutoffAt`, `cycleState`, فروشگاه‌ها و فاکتورهای انتخاب‌شده/held، آمار مبلغ و وضعیت تطبیق؛ بدون مدارک محرمانه مشتری |

در چرخه پایان **هر روز کاری همه فروشگاه‌ها** طبق [ADR-038](../adr/ADR-038-ALL-SELLERS-SETTLED-END-OF-EACH-WORKDAY.md)، `businessDate`, `settlementCycleId`, `cycleCutoffAt`, `policyVersion` و وضعیت `PAYOUT_SUBMITTED | PAYOUT_UNKNOWN | PAID` باید قابل پیگیری و تطبیق باشند. hold فاکتور A نباید مانع payout فاکتور B همان فروشنده شود. طبق [ADR-039](../adr/ADR-039-THURSDAY-IS-HANA-SELLER-SETTLEMENT-BUSINESS-DAY.md)، پنجشنبه روز کاری عادی این batch است؛ جمعه/تعطیلات رسمی و زمان دقیق cut-off هنوز تعریف اجرایی مصوب ندارند و این API ساعت پیش‌فرضی تعیین نمی‌کند.

برای هر فاکتور:

```text
maySubmitPayout =
  endOfHanaWorkdaySettlementCycle
  AND ordinarySettlementEligibilityMet
  AND activeSettlementHolds == 0
  AND requiredFinancialCorrectionsPosted
  AND payoutNotAlreadySubmittedOrPaid
```

خروجی responseهای فروشگاه **علت توقف** را بدون یادداشت/مدرک خصوصی مشتری نشان دهد. snapshot قیمت پس از تخفیف مبنای جریمه است، نه price روز یا صرفاً سهم نقدی پرداخت مشتری. در `CUSTOMER_UNAVAILABLE_REVIEW` کسر قطعی جریمه خودکار ممنوع است؛ پس از تأیید پشتیبانی، صفر. در تخلف منتسب به فروشگاه، penalty با کلید یکتا و deduction جدا اعمال سپس hold مربوط رفع شود؛ retry بستانکار/بدهکار مضاعف ممنوع است.

## ۵. رویدادهای داخلی و کلیدهای یکتا (پیشنهاد schema)

| رویداد | کلید منطقی یکتا | مصرف‌کننده |
|---|---|---|
| `ORDER_CUSTOMER_RECEIVED` | `orderId + receiptVersion` | Order / Incident eligibility |
| `INCIDENT_REPORTED` | `incidentId` | Settlement hold / Support inbox |
| `SUPPORT_INCIDENT_DECIDED` | `incidentId + decisionVersion` | Refund / Return / Settlement |
| `DAMAGED_RETURN_CONTACTED` | `returnId + attemptId` | Support / Audit |
| `DAMAGED_RETURN_DOORSTEP_ARRIVED` | `returnId + visitId` | Support / Audit |
| `DAMAGED_RETURN_COLLECTED` | `returnId + collectionEventId` | SLA hold / Finance |
| `CUSTOMER_UNAVAILABILITY_DECIDED` | `returnId + reviewVersion` | SLA hold / Finance |
| `SELLER_RETURN_SLA_BREACHED` | `returnId + breachType` | Penalty / Finance |
| `SELLER_PENALTY_POSTED` | `returnId + penaltyType` | Settlement deduction |
| `SETTLEMENT_HOLD_RELEASED` | `holdId` | Payout eligibility recalculation |

رویدادهای مالی با outbox در همان transaction و consumer inbox/dedup دریافت شوند؛ event delivery می‌تواند چندباره و نامرتب باشد. ساعت event تولیدشده از ساعت worker به‌عنوان زمان وقوع تاریخی دریافت/تأیید استفاده نشود. در latency و crash وسط عملیات، API با resource status و requestId امکان recovery داشته باشد.

## ۶. خطاهای پیشنهادی، بدون تغییر سیاست محصول

| code | کاربرد | پیشنهاد HTTP |
|---|---|---|
| `INCIDENT_REPORT_WINDOW_EXPIRED` | خارج از مهلت، با صحت زمان تحویل و سیاست استثنا روشن | 422 |
| `ORDER_RECEIPT_NOT_CONFIRMED` | دریافت واقعی معتبر هنوز ثبت نشده | 409 |
| `ORDER_ITEM_NOT_IN_ORDER` | قلم متعلق به سفارش نیست | 422 |
| `INCIDENT_ALREADY_DECIDED` | تصمیم نهایی با نسخه قدیم | 409 |
| `RETURN_CONTACT_REQUIRED` | اقدام بعدی مستلزم تماس اولیه است | 409 |
| `DOORSTEP_VISIT_REQUIRED_FOR_EXEMPTION` | تماس بدون حضور کافی نیست | 422 |
| `RETURN_ALREADY_TERMINAL` | دریافت/معافیت قطعی قبلی، retry ناسازگار | 409 |
| `SETTLEMENT_HAS_ACTIVE_HOLDS` | payout با hold هنوز فعال | 409 |
| `IDEMPOTENCY_PAYLOAD_CONFLICT` | همان کلید با payload دیگر | 409 |

همه errorها `requestId` و امکان retry مناسب داشته باشند؛ هیچ خطایی نباید حاوی آدرس، شماره تماس، عکس یا اطلاعات محرمانه طرف دیگر باشد.

## ۷. گیت تثبیت OpenAPI/SQL

تا زمان تصویب روش اثبات مراجعه، قاعده تخصیص تخفیف سبدی، تقویم جمعه/تعطیلات رسمی و ساعت دقیق پایان روز کاری تسویه ADR-038/039 (با پنجشنبه به‌عنوان روز کاری مصوب) و وضعیت کسورات بالاتر از موجودی، فیلدهای مرتبط را **با TODO سیاست و contract tests** علامت بزنید؛ اصل گزارش یک‌ساعته، تماس + مراجعه، بازپرداخت فوری و guard تسویه از همین حالا قابل ساخت‌اند. هیچ endpoint یا status این فایل به معنای deploy شدن سرویس نیست.