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
| خرید/پرداخت | سبد، مقایسه، quote، سفارش، PSP، عدم موفقیت، refund؛ ممنوعیت پرداخت در محل و تست رد COD در تمام کانال‌ها؛ لغو مشتری برای سفارش ارسالی تا پیش از تحویل واقعی به هر نوع پیک طبق ADR-011 و [ADR-018](../adr/ADR-018-SAME-CANCEL-CUTOFF-FOR-ALL-COURIERS.md)، عدم پذیرش درخواست لغو پس از handoff و گزارش مشکل مستقل طبق [ADR-019](../adr/ADR-019-NO-CANCEL-AFTER-COURIER-HANDOFF.md)، بازپرداخت کامل پس از تأیید نرسیدن کل سفارش شامل سهم حمل طبق [ADR-020](../adr/ADR-020-FULL-REFUND-ON-CONFIRMED-NONDELIVERY.md)، گزارش کسری و خرابی با عکس مشتری طبق [ADR-021](../adr/ADR-021-ITEM-SHORTAGE-DAMAGE-PHOTO-SELLER-RESOLUTION.md)، ثبت خرابی طبق [ADR-030](../adr/ADR-030-CUSTOMER-DAMAGE-REPORT-WITHIN-ONE-HOUR-OF-RECEIPT.md) و کسری اقلام طبق [ADR-031](../adr/ADR-031-MISSING-ITEM-REPORT-WITHIN-ONE-HOUR-OF-RECEIPT.md) هر دو حداکثر یک ساعت از **دریافت واقعی سفارش توسط مشتری**، با تست مرز زمانی و مستقل از ساعت بررسی پشتیبانی/جمع‌آوری فروشگاه؛ **توقف اتمیک تسویه همان فاکتور در صورت گزارش به‌موقع تا تصمیم پشتیبانی و آزادسازی با لحاظ چند پرونده و اصلاحات مالی طبق [ADR-032](../adr/ADR-032-HOLD-INVOICE-SETTLEMENT-UNTIL-SUPPORT-RESOLVES-ITEM-INCIDENT.md)، ادامه hold خرابی تأییدشده نیازمند بازپس‌گیری تا تعیین نتیجه مهلت یک‌ساعته فروشگاه و ثبت جریمه احتمالی قبل از آزادسازی طبق [ADR-033](../adr/ADR-033-HOLD-DAMAGED-INVOICE-THROUGH-SELLER-COLLECTION-SLA.md)، آزادسازی همان‌موقع hold در دریافت واقعی معتبر در مهلت و بازگشت مشروط به صف تسویه عادی طبق [ADR-034](../adr/ADR-034-RELEASE-SETTLEMENT-HOLD-ON-EARLY-DAMAGED-RETURN-COLLECTION.md)، با QA رقابت رویداد دریافت/انقضای SLA و **تماس اجباری اولیه فروشگاه با مشتری طبق [ADR-035](../adr/ADR-035-CALL-CUSTOMER-FIRST-EXEMPT-VERIFIED-CUSTOMER-UNAVAILABILITY.md) **و مراجعه الزامی در مهلت یک‌ساعته به درِ نشانی مشتری طبق [ADR-036](../adr/ADR-036-SELLER-MUST-VISIT-CUSTOMER-DOOR-AFTER-FIRST-CALL.md)**؛ معافیت جریمه فقط در عدم دسترسی مستند و تأییدشده مشتری پس از تماس و مراجعه، با QA تماس بی‌پاسخ بدون مراجعه/حضور دیرهنگام، بدون ثبت جمع‌آوری صوری و با رفع hold همان پرونده پس از بررسی، **بدون الزام مراجعه مجدد حتی پس از در دسترس‌شدن بعدی مشتری طبق [ADR-037](../adr/ADR-037-NO-SECOND-SELLER-VISIT-AFTER-VERIFIED-CUSTOMER-UNAVAILABILITY.md)** و با QA عدم ایجاد مأموریت/SLA یا جریمه جدید برای همان پرونده**، بررسی/تأیید پشتیبانی حنا و هماهنگی با فروشگاه و جمع‌آوری کالای خراب توسط خود فروشگاه بدون پیک لجستیک طبق [ADR-023](../adr/ADR-023-SUPPORT-APPROVAL-SELLER-COLLECTS-DAMAGED-GOODS.md)، بازپرداخت جبران نقدیِ کسری/خرابی ابتدا به کیف پول و عودت اختیاری به شبا طبق [ADR-022](../adr/ADR-022-ITEM-ISSUE-REFUND-TO-WALLET-OPTIONAL-WITHDRAWAL.md)، واریز همان‌موقع جبران خرابی پس از تأیید پشتیبانی بدون انتظار برای جمع‌آوری فروشگاه طبق [ADR-024](../adr/ADR-024-IMMEDIATE-WALLET-REFUND-ON-APPROVED-DAMAGE.md)، جمع‌آوری واقعی کالای خراب توسط خود فروشگاه حداکثر ظرف یک ساعت **از تأیید خرابی توسط پشتیبانی حنا**، با پایش SLA و escalation طبق [ADR-025](../adr/ADR-025-SELLER-COLLECTS-DAMAGED-RETURN-WITHIN-ONE-HOUR.md) و جریمه مالی فروشگاه بابت تأخیر طبق [ADR-026](../adr/ADR-026-SELLER-PENALTY-FOR-LATE-DAMAGED-RETURN.md) معادل قیمت کالای خراب طبق [ADR-027](../adr/ADR-027-LATE-DAMAGED-RETURN-PENALTY-EQUALS-ITEM-PRICE.md) با قیمت واقعی همان قلم در سفارش پس از تخفیف طبق [ADR-028](../adr/ADR-028-PENALTY-USES-ACTUAL-ORDER-ITEM-PRICE.md)، کسر یک‌باره و شفاف از تسویه فروشگاه طبق [ADR-029](../adr/ADR-029-DEDUCT-LATE-RETURN-PENALTY-FROM-SELLER-SETTLEMENT.md) (وجه فاکتور پیش از تسویه نزد حناست؛ تکلیف جریمه پس از تسویه واقعی همان فاکتور یا کسری به‌علت سایر کسورات هنوز باز است)، و سفارش حضوری تا پیش از دریافت واقعی توسط مشتری طبق ADR-012، با تست race و idempotency؛ بازپرداخت کامل مبلغ پرداختی مشتری شامل سهم ارسال در لغو مجاز طبق [ADR-013](../adr/ADR-013-FULL-BUYER-REFUND-ON-VALID-CANCELLATION.md)، کیف پول نقدی و درخواست عودت بانکی واقعی طبق [ADR-014](../adr/ADR-014-WALLET-REFUND-OPTIONAL-CASHOUT.md) فقط به شبای تأییدشده متعلق به مشتری طبق [ADR-015](../adr/ADR-015-WITHDRAWAL-TO-OWN-VERIFIED-IBAN.md)، بدون کارمزد مشتری و با واریز تمام مبلغ طبق [ADR-016](../adr/ADR-016-FEE-FREE-FULL-WALLET-WITHDRAWAL.md)، حداکثر ظرف ۷۲ ساعت **از ثبت درخواست مشتری** و با پایش SLA طبق [ADR-017](../adr/ADR-017-WALLET-WITHDRAWAL-WITHIN-72-HOURS.md) | قرارداد مالی و [ADR-009](../adr/ADR-009-NO-CASH-ON-DELIVERY.md) |
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

## اولین نشست تصمیم‌گیری

D01 مدل تک‌فروشنده‌ای سفارش طبق [ADR-001](../adr/ADR-001-SINGLE-SELLER-ORDER.md) و اصل اختیار مشتری در انتخاب فروشنده با سبد ناقص طبق [ADR-002](../adr/ADR-002-CUSTOMER-CHOICE-PARTIAL-BASKET.md) تصویب شده‌اند. از مالک محصول برای باقی D02 شامل رتبه‌بندی مقایسه/ارسال، D03 refund و جزئیات باقی تسویه (COD طبق [ADR-009](../adr/ADR-009-NO-CASH-ON-DELIVERY.md) رد شده)، D04 فاکتور، D05 منابع و قواعد اعتبار، D06 الگوی سازمان، D07 تأمین‌کنندگان، D08 حقوقی، D09 شهر اول/ظرفیت و D10 مرجع UI پاسخ قابل ارجاع دریافت و در `docs/adr/` ثبت کنید. تصمیم بدون مالک و تاریخ، تصمیم قطعی محسوب نمی‌شود.
