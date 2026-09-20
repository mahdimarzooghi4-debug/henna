# نقشه اجرایی ساخت و انتشار حنای کامل

**مرجع:** [سند معماری V1.0](../architecture/HANA-FULL-PRODUCT-NATIONAL-ARCHITECTURE-v1.0.md)  
**اصل:** اول **تمام ویژگی‌های مصوب** را برای شهر نخست به شکل واقعی و سرتاسری کامل کنیم؛ سپس رشد جغرافیایی شهر به شهر. فازبندی کار داخلی، مجوز انتشار نسخه ناقص نیست.

## جریان‌های کاری موازی

| جریان | خروجی نهایی برای شهر اول | پیش‌نیاز |
|---|---|---|
| طراحی قرارداد/داده | ADR مصوب، ERD، OpenAPI، مدل حالت، قواعد اعتبار/فاکتور | D01 و اصل انتخاب سبد ناقص در D02 تصویب‌شده؛ باقی D02–D10 باز |
| Design System/UX | RTL، کامپوننت، وضعیت خطا، مرجع Figma، سازگاری سناریو | تعیین APP اصلی، rules |
| هویت/امنیت | حساب، session، هویت مجاز، نقش و کنترل شیء/tenant، audit | سیاست و provider |
| جغرافیا/کاتالوگ | شهر، zone، فروشنده، پیشنهاد، جست‌وجو، قیمت و موجودی | سیاست پوشش |
| خرید/پرداخت | سبد، مقایسه، quote، سفارش، PSP، عدم موفقیت، refund؛ ممنوعیت پرداخت در محل و تست رد COD در تمام کانال‌ها؛ لغو مشتری برای سفارش ارسالی تا پیش از تحویل واقعی به هر نوع پیک طبق ADR-011 و [ADR-018](../adr/ADR-018-SAME-CANCEL-CUTOFF-FOR-ALL-COURIERS.md)، عدم پذیرش درخواست لغو پس از handoff و گزارش مشکل مستقل طبق [ADR-019](../adr/ADR-019-NO-CANCEL-AFTER-COURIER-HANDOFF.md)، بازپرداخت کامل پس از تأیید نرسیدن کل سفارش شامل سهم حمل طبق [ADR-020](../adr/ADR-020-FULL-REFUND-ON-CONFIRMED-NONDELIVERY.md)، گزارش کسری و خرابی با عکس مشتری طبق [ADR-021](../adr/ADR-021-ITEM-SHORTAGE-DAMAGE-PHOTO-SELLER-RESOLUTION.md)، ثبت خرابی طبق [ADR-030](../adr/ADR-030-CUSTOMER-DAMAGE-REPORT-WITHIN-ONE-HOUR-OF-RECEIPT.md) و کسری اقلام طبق [ADR-031](../adr/ADR-031-MISSING-ITEM-REPORT-WITHIN-ONE-HOUR-OF-RECEIPT.md) هر دو حداکثر یک ساعت از **دریافت واقعی سفارش توسط مشتری**، با تست مرز زمانی و مستقل از ساعت بررسی پشتیبانی/جمع‌آوری فروشگاه؛ **توقف اتمیک تسویه همان فاکتور در صورت گزارش به‌موقع تا تصمیم پشتیبانی و آزادسازی با لحاظ چند پرونده و اصلاحات مالی طبق [ADR-032](../adr/ADR-032-HOLD-INVOICE-SETTLEMENT-UNTIL-SUPPORT-RESOLVES-ITEM-INCIDENT.md)، ادامه hold خرابی تأییدشده نیازمند بازپس‌گیری تا تعیین نتیجه مهلت یک‌ساعته فروشگاه و ثبت جریمه احتمالی قبل از آزادسازی طبق [ADR-033](../adr/ADR-033-HOLD-DAMAGED-INVOICE-THROUGH-SELLER-COLLECTION-SLA.md)، آزادسازی همان‌موقع hold در دریافت واقعی معتبر در مهلت و بازگشت مشروط به صف تسویه عادی طبق [ADR-034](../adr/ADR-034-RELEASE-SETTLEMENT-HOLD-ON-EARLY-DAMAGED-RETURN-COLLECTION.md)، با QA رقابت رویداد دریافت/انقضای SLA و تماس اجباری اولیه فروشگاه با مشتری طبق [ADR-035](../adr/ADR-035-CALL-CUSTOMER-FIRST-EXEMPT-VERIFIED-CUSTOMER-UNAVAILABILITY.md) و مراجعه الزامی در مهلت یک‌ساعته به درِ نشانی مشتری طبق [ADR-036](../adr/ADR-036-SELLER-MUST-VISIT-CUSTOMER-DOOR-AFTER-FIRST-CALL.md)؛ معافیت جریمه فقط در عدم دسترسی مستند و تأییدشده مشتری پس از تماس و مراجعه، با QA تماس بی‌پاسخ بدون مراجعه/حضور دیرهنگام، بدون ثبت جمع‌آوری صوری و با رفع hold همان پرونده پس از بررسی، **بدون الزام مراجعه مجدد حتی پس از در دسترس‌شدن بعدی مشتری طبق [ADR-037](../adr/ADR-037-NO-SECOND-SELLER-VISIT-AFTER-VERIFIED-CUSTOMER-UNAVAILABILITY.md)** و با QA عدم ایجاد مأموریت/SLA یا جریمه جدید برای همان پرونده، بررسی/تأیید پشتیبانی حنا و هماهنگی با فروشگاه و جمع‌آوری کالای خراب توسط خود فروشگاه بدون پیک لجستیک طبق [ADR-023](../adr/ADR-023-SUPPORT-APPROVAL-SELLER-COLLECTS-DAMAGED-GOODS.md)، بازپرداخت جبران نقدیِ کسری/خرابی ابتدا به کیف پول و عودت اختیاری به شبا طبق [ADR-022](../adr/ADR-022-ITEM-ISSUE-REFUND-TO-WALLET-OPTIONAL-WITHDRAWAL.md)، واریز همان‌موقع جبران خرابی پس از تأیید پشتیبانی بدون انتظار برای جمع‌آوری فروشگاه طبق [ADR-024](../adr/ADR-024-IMMEDIATE-WALLET-REFUND-ON-APPROVED-DAMAGE.md)، جمع‌آوری واقعی کالای خراب توسط خود فروشگاه حداکثر ظرف یک ساعت **از تأیید خرابی توسط پشتیبانی حنا**، با پایش SLA و escalation طبق [ADR-025](../adr/ADR-025-SELLER-COLLECTS-DAMAGED-RETURN-WITHIN-ONE-HOUR.md) و جریمه مالی فروشگاه بابت تأخیر طبق [ADR-026](../adr/ADR-026-SELLER-PENALTY-FOR-LATE-DAMAGED-RETURN.md) معادل قیمت کالای خراب طبق [ADR-027](../adr/ADR-027-LATE-DAMAGED-RETURN-PENALTY-EQUALS-ITEM-PRICE.md) با قیمت واقعی همان قلم در سفارش پس از تخفیف طبق [ADR-028](../adr/ADR-028-PENALTY-USES-ACTUAL-ORDER-ITEM-PRICE.md)، کسر یک‌باره و شفاف از تسویه فروشگاه طبق [ADR-029](../adr/ADR-029-DEDUCT-LATE-RETURN-PENALTY-FROM-SELLER-SETTLEMENT.md) (وجه فاکتور پیش از تسویه نزد حناست؛ تکلیف جریمه پس از تسویه واقعی همان فاکتور یا کسری به‌علت سایر کسورات هنوز باز است)، و سفارش حضوری تا پیش از دریافت واقعی توسط مشتری طبق ADR-012، با تست race و idempotency؛ بازپرداخت کامل مبلغ پرداختی مشتری شامل سهم ارسال در لغو مجاز طبق [ADR-013](../adr/ADR-013-FULL-BUYER-REFUND-ON-VALID-CANCELLATION.md)، کیف پول نقدی و درخواست عودت بانکی واقعی طبق [ADR-014](../adr/ADR-014-WALLET-REFUND-OPTIONAL-CASHOUT.md) فقط به شبای تأییدشده متعلق به مشتری طبق [ADR-015](../adr/ADR-015-WITHDRAWAL-TO-OWN-VERIFIED-IBAN.md)، بدون کارمزد مشتری و با واریز تمام مبلغ طبق [ADR-016](../adr/ADR-016-FEE-FREE-FULL-WALLET-WITHDRAWAL.md)، حداکثر ظرف ۷۲ ساعت **از ثبت درخواست مشتری** و با پایش SLA طبق [ADR-017](../adr/ADR-017-WALLET-WITHDRAWAL-WITHIN-72-HOURS.md) | قرارداد مالی و [ADR-009](../adr/ADR-009-NO-CASH-ON-DELIVERY.md) |
| فروشنده | onboarding، تأیید ادمین، پنل عملیات، تسویه | حساب، سفارش |
| سازمان/اعتبار | طرح، import/API، تطبیق، تخصیص، رزرو/مصرف، reporting | الگوی تخصیص و funding |
| عملیات مشترک | پشتیبانی، اعلان، CMS، داشبورد، اتصال API کسب‌وکار مستقل لجستیک حنا، گزارش | داده دامنه و [ADR-004](../adr/ADR-004-HANA-LOGISTICS-INDEPENDENT-INTEGRATION.md)/[ADR-005](../adr/ADR-005-PICKUP-CUSTOMER-DELIVERY-ASSIGNMENT-LOGISTICS.md) |
| زیرساخت/کیفیت | CI/CD، stage/prod، HA/backup، امنیت، load، DR و runbooks | SLO/بودجه |

## ترتیب وابستگی، نه ترتیب انتشار

```text
تصمیم محصول + طراحی قرارداد
       ↓
هویت/مجوز + شهر/پوشش + مدل داده + Design System + CI/CD
       ↓
Catalog/Offer/Stock + Seller approval + Org source + Program
       ↓
Cart/Comparison/Quote + Allocation/Ledger + Payments
       ↓
Order/Fulfillment/Refund + Admin/Support/Reports
       ↓
تست end-to-end همه کانال‌ها + امنیت/بار/DR + اتصال‌های واقعی
       ↓
شهر اول: انتشار کامل
       ↓
شهر دوم و بعد: CityLaunchConfig + ورود عرضه/همکاران + آزمون شهری
```

جریان‌های موازی UI می‌توانند زودتر شروع شوند، اما Mock به محیط انتشار راه ندارد. مرجع تمامی صفحه‌ها موجودی Figma است؛ صفحات فروشندگی موبایل خارج از scope و خرید حقوقی مصرف‌کننده داخل scope است.

## بسته اجرایی مهندسی: اختلاف سفارش تا تسویه (ADR-019 تا ADR-037)

[طراحی معماری جریان](../architecture/HANA-INCIDENT-REFUND-SETTLEMENT-TECHNICAL-DESIGN-v0.1.md) · [API پیشنهادی](../api/HANA-INCIDENT-SETTLEMENT-API-CONTRACT-v0.1.md) · [ERD و constraints](../architecture/HANA-DOMAIN-ERD-draft.md) · [ماتریس تست A–F](../testing/HANA-INCIDENT-SETTLEMENT-ACCEPTANCE-MATRIX-v0.1.md).

**ترتیب اجرای درون‌تیمی، نه مجوز انتشار ناقص:**

| بسته | تغییر فنی قابل تحویل | شرط پذیرش |
|---|---|---|
| T01 — receipt و مهلت | رویداد دریافت واقعی سفارش؛ UTC server timestamp؛ محاسبه `incidentReportDueAt` برای کسری/خرابی | A01–A11؛ مرز دقیق ۶۰ دقیقه، عدم اعتماد به ساعت دستگاه |
| T02 — پرونده و پشتیبانی | گزارش سطح قلم/تعداد، عکس محرمانه، support review، permission و audit | B01–B03؛ گزارش خودکار refund نسازد |
| T03 — wallet و منشأ اعتبار | Refund، ledger و cash wallet/credit origin؛ outbox/کلید یکتا | B04–B10؛ بستانکاری فوری و عدم دوپرداخت |
| T04 — بازپس‌گیری فروشگاه | تماس اولیه، حضور واقعی درِ نشانی، ساعت ۶۰ دقیقه از approval، دریافت یا عدم دسترسی با بررسی پشتیبانی | C01–C10 و D01–D11؛ بدون لجستیک حنا، بدون مراجعه دوم اجباری در حالت معافیت |
| T05 — hold و settlement | hold مستقل به ازای incident، انتقال اتمیک review→return، penalty/deduction منفک، **batch خودکار هر شب ۰۰:۰۰ به وقت ایران (`Asia/Tehran`) طبق ADR-042/043، برای همه فروشگاه‌ها با احتساب پنجشنبه، جمعه و تعطیلات رسمی طبق ADR-038 تا ADR-041 و وصول واقعی تابع چرخه بانک**، payout fence و reconcile | E01–E29؛ پرداخت هنگام hold و ledger مضاعف ممنوع |
| T06 — امنیت/بازیابی | scope seller/buyer/support/finance، replay worker، metrics/alerts، runbook hold مانده | F01–F08، restore و خروجی evidence |

**موانع تصمیم‌محورِ مشخص برای release (نه سؤال فوری از مالک محصول):** روش حداقلی اثبات حضور در درِ نشانی، تخصیص تخفیف سبدی/همپوشانی اقلام، اتصال/چرخه وصول بانک پس از شروع خودکار ۰۰:۰۰ به وقت ایران (`Asia/Tehran`) طبق [ADR-042](../adr/ADR-042-AUTOMATIC-SELLER-SETTLEMENT-AT-MIDNIGHT-BANK-CYCLE-DEPENDENT.md) و [ADR-043](../adr/ADR-043-MIDNIGHT-SETTLEMENT-IN-IRAN-TIMEZONE.md) برای همه فروشگاه‌ها طبق [ADR-038](../adr/ADR-038-ALL-SELLERS-SETTLED-END-OF-EACH-WORKDAY.md) (پنجشنبه طبق [ADR-039](../adr/ADR-039-THURSDAY-IS-HANA-SELLER-SETTLEMENT-BUSINESS-DAY.md)، جمعه طبق [ADR-040](../adr/ADR-040-FRIDAY-IS-HANA-SELLER-SETTLEMENT-BUSINESS-DAY.md) و تعطیلات رسمی طبق [ADR-041](../adr/ADR-041-SETTLE-ALL-SELLERS-ON-OFFICIAL-HOLIDAYS.md) روز چرخه تسویه‌اند)، تسویه واقعاً پرداخت‌شده پیش از ثبت پرونده و کسورات بیشتر از موجودی. تا تصویب، مقدار ثابت پنهان، برداشت بانکی خودکار یا تسویه منفی در کد قرار نگیرد. ساخت مسیرهای قطعیِ تصویب‌شده باید ادامه یابد.

## Definition of Done هر فیچر

- رفتار و اثر حالت‌های موفق/خطا/انتظار مشخص و قابل تست.
- دسترسی درست خریدار، فروشنده، ادمین، سازمان و شهر.
- قرارداد API، migration، seed صرفاً در dev/stage و telemetry.
- تست واحد، integration و E2E سناریوهای عادی و منفی.
- عدم تناقض موجودیت بین دو کانال/پنل.
- مستند عملیاتی و صاحب پشتیبانی.
- سیاست تجاری/حقوقی تأییدشده برای رفتار مالی/اعتبار/اطلاعات حساس.

## گیت انتشار شهر اول

گیت F01–F22 در سند معماری با شواهد واقعی QA؛ تست پرداخت واقعی کنترل‌شده، تطبیق مالی، سفارش واقعی و لغو/بازگشت وجه، تست پنل فروشنده/ادمین/سازمان، تست فشار، بازگردانی backup، failover، بررسی دسترسی داده سازمانی، متون نهایی حقوقی و اطلاعات تماس رسمی، آموزش پشتیبانی، برنامه حادثه و امضای انتشار.

## گیت شهر جدید

پیکربندی city/zone و delivery modes؛ فروشندگان فعال و کاتالوگ/موجودی؛ پوشش لجستیک/PSP/پشتیبانی؛ قرارداد و سیاست محلی مصوب؛ تست سفارش پرداخت/اعتبار واقعی؛ load متناسب؛ فعال‌سازی مرحله‌ای و امکان PAUSED بدون خاموش‌کردن تاریخچه سفارش.

## ردیابی تصمیم‌ها و جلوگیری از توقف بی‌مورد ساخت

ADR-001 تا ADR-037 مرجع تصمیم‌های ثبت‌شده‌اند؛ تیم باید رفتارهای قطعی را از بخش‌های **«مورد باز»** هر ADR جدا کند. برای مسیر اختلاف سفارش، سند فنی، API پیشنهادی، ERD و ماتریس آزمون بالا به مهندسی امکان اجرای قواعد مصوب را می‌دهند. موضوعات تجاری/حقوقی تأییدنشده در سند معماری و ADRها در لیست مانع انتشار ثبت شوند و بدون تصمیم جدید به محصول تحمیل نشوند؛ **هیچ‌یک توجیه رهاکردن توسعه یا انتشار نسخه ناقص شهر اول نیستند**.
