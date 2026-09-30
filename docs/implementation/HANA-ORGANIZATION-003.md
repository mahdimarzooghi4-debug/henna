# HANA-ORGANIZATION-003 — ثبت ارجاع دستور تأمین مالی

## Business boundary

یک سازمان می‌تواند برای یک پیش‌نویس برنامه، شماره/شناسهٔ دستور تأمین مالی خودش را ارسال کند. انتخاب روش از رکورد برنامه خوانده می‌شود: `HENNA_NEEDS_BASED` یا `ORGANIZATION_DEFINED`. API مالکیت منبع و اصالت دستور را تأیید نمی‌کند؛ پاسخ فقط `PENDING_VERIFICATION` می‌ماند.

این API برای منابع صندوق نیکوکاری حنا نیست. سازمان از طریق عضویت خودش نمی‌تواند منبع حنا را ایجاد، معرفی یا روش تخصیص آن را تغییر دهد.

## Implemented slice

- `POST /api/v1/organization/programs/{programId}/funding-instruction` ثبت account/member-scoped با `Idempotency-Key` و `programRevision` دقیق.
- `GET` همان مسیر، read model دستور را فقط به اعضای فعال سازمان نشان می‌دهد.
- `allocationMode` از برنامهٔ ذخیره‌شده snapshot می‌شود؛ ورودی کلاینت، مبلغ و mode دلخواه پذیرفته نمی‌شوند.
- نقش‌های Lead/Representative مجاز به ثبت‌اند؛ Technical Operator فقط می‌خواند.
- migration قیدهای mode، وضعیت اولیه، یک دستور برای هر برنامه، و یکتایی idempotency key را اعمال می‌کند.
- وضعیت ثابت این برش `PENDING_VERIFICATION` است. endpoint تأیید یا اجرای تخصیص وجود ندارد.

## Deferred

بررسی مدرک/اختیار امضا، گردش‌کار Admin، اصلاح یا resubmit پس از رد، دریافت وجه، ورود مشمولان، محاسبه/ثبت batch، wallet، ledger و نمایش Web در برش‌های بعدی می‌آیند. Admin UI ساخته نمی‌شود تا طراحی مصوب در دسترس باشد.

## Verification

- API/DB test برای auth، محدودهٔ عضویت، منع اپراتور فنی، revision، idempotent retry، تغییر payload، snapshot mode از برنامه و نبود فیلد مالی.
- migration snapshot و PostgreSQL CI.
- CI gates: backend، web، mobile، Android؛ iOS خارج از scope.

