# آغاز پیاده‌سازی حنا — Bootstrap 001

**وضعیت:** نخستین کد و تنظیمات پایه؛ هنوز سفارش، کیف پول، اعتبار حمایتی، تسویه یا اتصال واقعی لجستیک پیاده نشده است.  
**مرجع انتخاب فناوری:** [ADR-045](../adr/ADR-045-HANA-TECHNOLOGY-STACK-ASPNET-CORE-DOTNET-10-LTS.md)، [معماری V1.0](../architecture/HANA-FULL-PRODUCT-NATIONAL-ARCHITECTURE-v1.0.md) و [ADR-046](../adr/ADR-046-ADMIN-LOGISTICS-SECTION-EXTERNAL-SERVICE-FIGMA-DEFERRED.md).

## آنچه واقعاً ساخته شده

- solution اولیه .NET 10 شامل پروژه‌های API، worker، Domain، Application و Infrastructure با dependency direction یک‌طرفه و ساعت UTC قابل‌جایگزینی؛ یک نوع پایه برای مبلغ غیرمنفیِ ریالی، **بدون منطق ledger یا صورتحساب**.
- HTTP endpoints: `GET /health/live` فقط زنده‌بودن فرایند، و `GET /api/v1/system/status` برای بررسی اسکلت. **این endpointها آمادگی دیتابیس/بانک/لجستیک را تأیید نمی‌کنند.**
- OpenAPI در محیط توسعه از `/openapi/v1.json`، نه قرارداد نهایی محصول.
- worker بی‌عملیات مالی؛ صرف ایجاد worker به معنی فعال‌بودن تسویه شبانه نیست.
- وب Next.js/React با RTL فارسی و صفحه **موقت فنی، نه صفحه مصوب فیگما**.
- PostgreSQL 17 فقط در Docker Compose محلی؛ **هنوز اتصال EF Core، migration و مدل داده عملیاتی ساخته نشده‌اند**.
- CI شامل restore/build و smoke API و build/typecheck وب؛ **اولین اجرای واقعی آن برای commit `884c46d` در هر دو job بک‌اند و وب موفق شد** ([گزارش GitHub Actions](https://github.com/mahdimarzooghi4-debug/henna/actions/runs/35511098655)). این موفقیت فقط اعتبارسنجی اسکلت است، نه تست سفارش، مالی یا اتصال بیرونی.

## راه‌اندازی برای توسعه‌دهنده

نیازمندی‌ها: **.NET 10 SDK**، **Node.js 22**، npm و Docker Compose (برای دیتابیس محلی).

```sh
cp .env.example .env
# در .env رمز محلی خود را تنظیم کنید؛ این فایل commit نمی‌شود.
docker compose up -d postgres
dotnet restore Hana.slnx
dotnet run --project apps/api/Hana.Api/Hana.Api.csproj
# در ترمینال جدید:
dotnet run --project apps/workers/Hana.Worker/Hana.Worker.csproj
npm install
npm run web:dev
```

API محلی با launch profile روی `http://localhost:5184` و وب روی `http://localhost:3000` در صورت آزادبودن پورت‌ها اجرا می‌شوند.

## وضعیت آزمون و محدودیت‌ها

این بسته از طریق اتصال GitHub نوشته شده است؛ در محیط ایجاد آن **.NET SDK و دسترسی به npm registry برای نصب بسته‌ها در دسترس نبودند**، پس ادعای اجرای موفق build/test محلی نشده است. GitHub Actions معیار نخستین اعتبارسنجی واقعی خواهد بود. پیش از استقرار واقعی، تست دامنه، integration با PostgreSQL، قراردادهای مالی/اعتبار، احراز هویت، مانیتورینگ و secret management الزامی‌اند. نسخه‌های npm باید پس از اولین نصب معتبر با lockfile ثبت شوند.

## مرحله بعدی توسعه

هویت و مجوز actor/tenant، schema اولیه PostgreSQL و قراردادهای ماژول‌های فروشگاه/کاتالوگ/سفارش؛ سپس جریان‌های مالی مطابق ADRهای تصویب‌شده و اتصال سرویس لجستیک **از بیرون**. صفحه لجستیک ادمین هنگام رسیدن به آن بخش به فیگما افزوده می‌شود، نه با طراحی حدسی این اسکلت.
