# Identity 002 — پایگاه داده PostgreSQL و migration مستقل هویت

**حوزه این گام:** ساخت زیرساخت پایدارِ داده هویت، نه ارسال واقعی پیامک یا احراز موفق. قرارداد قبلی OTP همچنان برای شماره معتبر بدون provider پاسخ 503 می‌دهد.

## آنچه به کد اضافه شده

- `HanaIdentityDbContext` با EF Core و Npgsql برای **PostgreSQL**؛ جدول‌های اولیه `identity.accounts` و `identity.otp_challenges`، با migration نسخه‌دار و snapshot.
- حساب با شناسه GUID و شماره نرمال‌شده دارای ایندکس unique، تاریخ ایجاد و تاریخ تأیید تلفن **اختیاری**. «داشتن حساب» نه نشان‌دهنده احراز نهایی شخص است و نه به‌معنی تأیید حمایتی یا فروشندگی.
- رکورد چالش آینده: شناسه، شماره نرمال‌شده، **هش/خلاصه کد به‌جای کد آشکار** (`bytea`)، زمان صدور و انقضا، دفعات شکست، مصرف، و مرجع پیام سرویس ارسال. قیود دیتابیس برای شمارش شکست غیرمنفی و انقضای بعد از صدور؛ این طرح به معنی فعال‌سازی ساخت/ارسال/تأیید کد نیست.
- endpoint `GET /health/ready`: فقط در صورت اتصال واقعی به PostgreSQL و نداشتن migration معوقه پاسخ 200 می‌دهد؛ نبودن رمز/دیتابیس یا نصب‌نشدن schema پاسخ 503 می‌دهد. `/health/live` فقط وضعیت فرایند را گزارش می‌کند.
- اجرای migration **صریح** با `--apply-migrations`، نه migration خودکار هنگام روشن‌شدن replicaهای API. `ConnectionStrings__IdentityDb` باید از env/secrets داده شود.

## راه‌اندازی محلی

```sh
cp .env.example .env
# رمز پایگاه داده را در .env عوض کنید
docker compose up -d postgres
# از همان رمز واقعی .env برای connection string استفاده شود؛ این خط فقط الگوی اجراست
export ConnectionStrings__IdentityDb='Host=localhost;Port=5433;Database=hana_dev;Username=hana_dev;Password=<LOCAL_SECRET>'
dotnet restore Hana.slnx
dotnet run --project apps/api/Hana.Api/Hana.Api.csproj -- --apply-migrations
dotnet run --project apps/api/Hana.Api/Hana.Api.csproj
```

به‌طور مستقل:
- `GET /health/live`: زنده‌بودن API
- `GET /health/ready`: آماده‌بودن دیتابیس Identity و migration
- `POST /api/v1/auth/otp/request`: هنوز **بدون provider واقعی** برای شماره معتبر 503؛ هیچ پیامک، حساب یا اعتبار ایجاد نمی‌کند.

## آزمون‌ها و گیت انتشار

در GitHub Actions یک PostgreSQL 17 موقت در job بک‌اند بالا می‌آید، migration دو بار اعمال می‌شود (تکرار بی‌اثر)، آزمون‌های xUnit دامنه و integration جدول‌ها/ایندکس اجرا می‌شوند؛ سپس smoke readiness/OTP انجام می‌شود. وب و Expo نیز build/export می‌شوند. **در این مرحله هنوز OTP امن عملیاتی، تراکنش/ledger، اعتبار یا اتصال بانکی/لجستیک ایجاد نشده است.**

برای انتشار آینده باید رمزهای مدیریت‌شده، backup/restore، سیاست حفظ و حذف شماره/چالش، قفل و انقضای چالش، قیدهای تکمیل، anti-abuse توزیع‌شده، session قابل ابطال و audit طراحی و آزمایش شوند.
