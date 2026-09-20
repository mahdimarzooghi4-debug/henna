# Identity 004 — قرارداد ارائه‌دهنده SMS و صدور کنترل‌شده OTP

**وضعیت:** کد صدور چالش و اتصال زیرساخت تکمیل شده؛ **هنوز ارائه‌دهنده واقعی پیامک انتخاب/پیکربندی نشده، هیچ SMS ارسال نمی‌شود و ورود واقعی فعال نیست.** خروجی 202 فقط بعد از اتصال adapter دارای پذیرش واقعی provider ممکن است. فرستنده اصلی `UnconfiguredOtpSmsSender` است و `IsAvailable=false`.

## تغییرات اجراشده

- رابط `IOtpSmsSender` برای adapter مخصوص ارائه‌دهنده و نتیجه `Accepted + ProviderReference`. یک implementation غیرفعال پیش‌فرض تضمین می‌کند که نبود سرویس واقعی به ارسال موفق جعلی منجر نشود. تست‌های integration یک فرستنده **صرفاً داخلی تست** به کار می‌گیرند؛ در API واقعی ثبت نشده است.
- `OtpChallengeIssuer` کد شش‌رقمی امن تولید و تنها HMAC وابسته به شماره/چالش را در PostgreSQL با وضعیت `PENDING` ثبت می‌کند، سپس sender را صدا می‌زند؛ فقط بعد از نتیجه معتبر provider وضعیت `ACCEPTED` و مرجع provider ثبت می‌شوند. جواب رد provider => `FAILED`؛ timeout/نتیجه نامشخص => `PENDING` و پاسخ 503، نه ارسال/موفقیت ادعایی.
- migration جدید `20260920210000_OtpDeliveryStatus`: ستون `delivery_status` با CHECK برای `PENDING | ACCEPTED | FAILED` و منع `ACCEPTED` بی‌مرجع provider. چالش‌های قدیمی با default `PENDING` قابل تأیید نیستند. `OtpChallengeVerifier` فقط رکورد `ACCEPTED` را می‌پذیرد.
- cooldown اولیه **۹۰ ثانیه به‌ازای شماره** و lifetime اولیه **۵ دقیقه**، به‌عنوان پیش‌فرض فنیِ نیازمند بازبینی امنیتی/عملیاتی (نه سیاست نهایی مصوب محصول). قفل advisory به‌ازای شماره روی تراکنش PostgreSQL درخواست‌های هم‌زمان در چند replica را سریالی می‌کند. با درخواست تازه بعد از cooldown، challenge قبلی مصرف‌شده/باطل می‌شود.
- مسیر `POST /api/v1/auth/otp/request` اکنون هنگام ثبت provider معتبر و رمز HMAC و PostgreSQL قابل صدور است؛ در مخزن فعلی provider غیرفعال است و پاسخ برای شماره معتبر 503 می‌ماند. فرمت نامعتبر 400؛ cooldown و محدودیت IP برابر 429. هیچ session یا اعتبار حمایتی تولید نمی‌شود.

## کلید و provider

`Otp__DigestKeyBase64` فقط **کلید تصادفی ۳۲ بایتی یا بلندتر در محیط امن سرور** است، نه در `NEXT_PUBLIC_*` و نه `EXPO_PUBLIC_*` یا git. تنها قرار دادن این کلید، ارسال را فعال نمی‌کند. قبل از فعال‌سازی، adapter قرارداد واقعی SMS، credential جداگانه در secret manager، محدودسازی توزیع‌شده و monitoring و هزینه/سهمیه provider الزامی‌اند.

**نکته پایداری:** فاصله بین پذیرش پیام توسط provider و ثبت `ACCEPTED` در DB، در صورت crash می‌تواند رکورد `PENDING` و پیام رسیده اما غیرقابل‌تأیید بسازد؛ این رفتار fail-closed است اما پیش از rollout باید با provider idempotency/reference و reconciliation یا outbox حل شود. این اسکلت را نباید به‌عنوان SMS آماده production فعال کرد.

## آزمون و محدودیت

تست واقعی PostgreSQL برای رد sender، نتیجه نامعلوم، cooldown بین DbContextها، باطل‌شدن کد قبلی و دو صدور هم‌زمان؛ تست قبلی تأیید کد نیز اکنون چالش `PENDING/FAILED` را رد می‌کند. CI migration جدید را نصب و دوباره اجرا می‌کند و buildهای وب و Expo را حفظ می‌کند. بررسی تست‌های موفق از GitHub Actions لازم است.
