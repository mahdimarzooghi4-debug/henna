# External Integrations 001 — fail-closed handoff boundary

این سند مرز اتصال سرویس‌های بیرونی حنا را برای مرحله‌ای ثبت می‌کند که implementation
واقعی providerها توسط مالک محصول/تأمین‌کننده تحویل می‌شود. این مرحله هیچ SMS،
پرداخت، احراز هویت یا مأموریت لجستیک واقعی ایجاد نمی‌کند.

## وضعیت فعلی

پنج dependency بیرونی به‌صورت مستقل دیده می‌شوند:

- `IOtpSmsSender` برای OTP؛ implementation پیش‌فرض
  `UnconfiguredOtpSmsSender` و `IsAvailable=false`.
- `ISellerNaturalIdentityVerifier` برای تطبیق کد ملی و شماره همراه فروشنده
  حقیقی؛ implementation پیش‌فرض fail-closed است.
- `IExternalPaymentProvider` برای PSP/پرداخت بیرونی؛ implementation پیش‌فرض
  فقط readiness=false دارد. قرارداد provider-specific تا دریافت API واقعی
  PSP freeze نمی‌شود.
- `IExternalIbanOwnershipVerifier` برای اثبات تعلق شبای مقصد برداشت به همان
  خریدار؛ implementation پیش‌فرض fail-closed و `IsAvailable=false` است.
  این dependency مستقل از PSP است و از روی فرمت شبا، نام واردشده یا موفقیت
  پرداخت قبلی استنتاج نمی‌شود.
- `IExternalLogisticsProvider` برای سرویس مستقل لجستیک؛ implementation
  پیش‌فرض readiness=false دارد. منطق ناوگان، تخصیص پیک و مسیر داخل marketplace
  ساخته نمی‌شود.

سه interface آخر عمداً فقط boundary آمادگی‌اند؛ متدهای provider-specific قبل
از دریافت قرارداد واقعی اختراع نشده‌اند. قراردادهای داخلی سفارش، کیف پول،
اعتبار، settlement و PICKUP موجود همچنان مستقل باقی می‌مانند.

## گیت ادمین

`GET /api/v1/admin/integrations/status`

فقط ADMIN دارای نشست معتبر می‌تواند وضعیت را بخواند. پاسخ شامل secret،
credential، URL provider یا داده شخصی نیست و فقط boolean readiness پنج
dependency و `allExternalReady` را برمی‌گرداند.

وب ادمین از BFF با cookie امن HttpOnly در
`/api/admin/integrations/status` استفاده می‌کند. bearer به browser داده
نمی‌شود، query اضافی رد می‌شود، پاسخ upstream سقف اندازه دارد و DTO ناشناخته
به UI راه پیدا نمی‌کند.

صفحه `/admin/integrations` هر dependency را مستقل نشان می‌دهد. UI هیچ
adapter را از روی config یا وجود دکمه «آماده» فرض نمی‌کند. فقط
`IsAvailable=true` implementation ثبت‌شده می‌تواند وضعیت همان dependency را
آماده کند.

## قانون اتصال provider واقعی

هنگام تحویل provider:

1. implementation واقعی همان boundary مربوط ثبت شود و secret فقط از secret
   manager/configuration امن خوانده شود.
2. `IsAvailable` فقط پس از وجود configuration حداقلی معتبر و قابلیت واقعی
   provider true شود؛ صرف وجود API key کافی نیست اگر dependency دیگری لازم است.
3. timeout، پاسخ نامشخص، retry و idempotency provider باید در adapter و
   contract tests همان provider مشخص شوند.
4. هیچ callback/webhook بدون احراز امضا/منبع و dedup سروری به state مالی یا
   سفارش تبدیل نشود.
5. readiness بیرونی جای Release Approval، reconciliation، device QA یا
   integrity داخلی را نمی‌گیرد.
6. برای لجستیک، ADR-004/046 پابرجاست: فقط API integration؛ عملیات ناوگان داخل
   هسته حنا ساخته نمی‌شود.
7. برای PSP، `PAID` فقط با تأیید واقعی provider/reconciliation مجاز است؛
   آماده‌سازی settlement به معنی انتقال بانکی نیست.
8. برای برداشت کیف پول، مالکیت شبا باید توسط verifier واقعی و auditable تأیید
   شود؛ وضعیت `OWNERSHIP_VERIFICATION_PENDING` فعلی مجوز انتقال بانکی نیست.
9. برای SMS، provider acceptance فقط پذیرش ارسال است، نه اثبات دریافت روی
   گوشی؛ OTP فقط بر اساس challenge معتبر خود حنا تأیید می‌شود.

## شواهد CI

- parser وب تضاد `allExternalReady` با readiness پنج dependency را رد می‌کند.
- BFF ایزوله HTTPS اثبات می‌کند cookie به upstream نشت نمی‌کند، bearer فقط
  server-to-server است و فیلدهای اضافی provider حذف می‌شوند.
- smoke backend مسیر admin را بدون bearer برابر 401 می‌خواهد.
- build/typecheck وب صفحه ادمین جدید را در shipping code می‌سازد.

این مرحله به معنی آماده بودن providerها نیست؛ دقیقاً برعکس، تا تحویل
implementation واقعی همه dependencyها fail-closed باقی می‌مانند.


## مرز تحویل فعلی

مالک محصول اعلام کرده اتصال SMS، PSP و لجستیک را تأمین می‌کند. دو dependency
بیرونی دیگر همچنان مستقل‌اند و نباید زیر همان سه adapter پنهان شوند:

- تطبیق هویت فروشنده حقیقی؛
- احراز مالکیت شبای مقصد برداشت.

تا زمانی که provider یا فرایند معتبر و auditable این دو مورد تأمین نشده باشد،
readiness کلی بیرونی عمداً false می‌ماند. این رفتار مانع استفاده از مسیرهای
داخلی/PICKUP موجود نیست، اما مانع ادعای آمادگی کامل انتشار می‌شود.
