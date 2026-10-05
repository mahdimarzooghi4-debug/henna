# Runbook — PostgreSQL Backup / Restore Rehearsal

این runbook برای پایگاه دادهٔ مشترک پایلوت حنا است که schemaهای Identity،
Seller، Catalog، Geography، Commerce و Allocation Learning را نگه می‌دارد.
این سند جای سیاست retention، رمزنگاری backup یا سرویس managed production را
نمی‌گیرد؛ آن موارد باید در محیط انتشار و توسط زیرساخت مصوب تعیین شوند.

## اصل بازیابی

- startup عادی migration اجرا نمی‌کند.
- backup باید با نسخه PostgreSQL سازگار با server گرفته شود.
- restore ابتدا در پایگاه دادهٔ تازه و جداگانه انجام می‌شود.
- پیش از تغییر ترافیک، `/health/ready` روی نسخهٔ بازیابی‌شده باید `ready=true`
  و همهٔ moduleهای پیکربندی‌شده را گزارش کند.
- سلامت schema به‌تنهایی کافی نیست؛ logical data dump منبع و restore نیز باید
  یکسان باشد.
- SMS، PSP، بانک و لجستیک در rehearsal داخلی اجرا یا موفق فرض نمی‌شوند.

## تمرین خودکار CI

job backend در `.github/workflows/bootstrap.yml` پس از migration و تست‌های
PostgreSQL:

1. با image رسمی `postgres:17` از `hana_ci` یک custom-format dump می‌گیرد.
2. پایگاه مستقل `hana_ci_restore` می‌سازد.
3. dump را با `--no-owner --no-privileges --exit-on-error` restore می‌کند.
4. data-only logical dump هر دو DB، شامل sequence state، را byte-for-byte
   مقایسه می‌کند.
5. API را با هر سه connection string روی DB بازیابی‌شده بالا می‌آورد.
6. `/health/ready` باید Identity/Seller/Catalog/Geography، Commerce و
   Allocation Learning را آماده گزارش کند.

این آزمون، restore واقعی PostgreSQL را اثبات می‌کند اما جای restore از object
storage، encryption/KMS، retention، PITR، failover شبکه، اندازه production و
RTO/RPO مصوب را نمی‌گیرد.

## اجرای عملیاتی پیشنهادی

در محیط واقعی credentialها فقط از secret manager وارد شوند. نمونهٔ زیر صرفاً
شکل عملیات است و مقدار واقعی ندارد:

```sh
pg_dump --format=custom --no-owner --no-privileges \
  --dbname="$SOURCE_DATABASE_URL" --file=hana.backup

createdb "$RESTORE_DB_NAME"

pg_restore --no-owner --no-privileges --exit-on-error \
  --dbname="$RESTORE_DATABASE_URL" hana.backup
```

سپس API با connection stringهای restore بالا بیاید و readiness بررسی شود.
اگر هر migration عقب باشد، هر schema قابل اتصال نباشد، یا AllocationLearningDb
پیکربندی‌شده سالم نباشد، readiness باید 503 بدهد.

## گیت قبل از cutover

cutover فقط وقتی مجاز است که:

- restore بدون خطا تمام شده باشد؛
- logical data verification موفق باشد؛
- migration pending صفر باشد؛
- `/health/ready` موفق باشد؛
- گیت Commerce Integrity در پنل ادمین healthy باشد؛
- credentialهای providerهای بیرونی، reconciliation و policyهای مالی/حقوقی
  برای محیط مقصد جداگانه تأیید شده باشند؛
- Release Approval صریح وجود داشته باشد.

CI فعلی فقط rehearsal پایلوت روی PostgreSQL موقت است و اثبات ظرفیت ملی،
PITR production یا RTO/RPO نیست.
