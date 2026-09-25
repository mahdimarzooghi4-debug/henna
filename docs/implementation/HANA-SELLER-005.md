# Seller 005 — ثبت نسخهٔ پیش‌نویس برای بررسی

## مبنای محصول

این برش از صفحهٔ Figma `03 • Seller Registration` (node `277:141`) استفاده می‌کند؛ در طراحی، مرحلهٔ ۷ «بازبینی و ثبت» و مرحلهٔ ۸ «وضعیت درخواست» صریح هستند. این تغییر فقط انتقال درخواست از پیش‌نویس به وضعیت ثبت‌شده برای بررسی را پیاده می‌کند و هیچ approval، نقش Seller، پنل عملیاتی یا فعال‌سازی فروشگاه ایجاد نمی‌کند.

## قرارداد Backend

- `POST /api/v1/seller/registration/submit`
- نشست معتبر و پیش‌نویس متعلق به همان Account الزامی است.
- body فقط revision مورد انتظار را حمل می‌کند.
- `Idempotency-Key` UUID الزامی است.
- انتقال اتمیک: `DRAFT -> SUBMITTED` و `revision + 1`.
- همان key + همان revision یک retry امن است و همان نتیجه ثبت‌شده را برمی‌گرداند.
- key متفاوت پس از ثبت یا revision قدیمی با 409 رد می‌شود.
- پس از `SUBMITTED`، مسیر PUT دیگر draft را ویرایش نمی‌کند.
- زمان ثبت و metadata idempotency در schema seller ذخیره می‌شوند، اما کلید ثبت به مرورگر برگردانده نمی‌شود.

## Web / BFF

Next.js همان cookie امن HttpOnly را نگه می‌دارد و Bearer فقط server-to-server است. POST same-origin است، body allowlist دارد، idempotency key را فقط به header upstream منتقل می‌کند و پاسخ را به `status/revision/submittedAtUtc` محدود می‌کند.

در `/seller/register`:
- submit فقط وقتی فعال است که یک draft ذخیره‌شده و بدون تغییر محلی وجود داشته باشد؛
- پس از ثبت موفق، همه فیلدها قفل می‌شوند؛
- بخش «وضعیت درخواست» حالت «در انتظار بررسی» را نشان می‌دهد؛
- UI صریحاً می‌گوید ثبت درخواست به معنی تأیید یا فعال‌شدن فروشگاه نیست.

## QA

پوشش شامل PostgreSQL/API واقعی برای idempotent replay، conflict، قفل ویرایش بعد از submit و عدم نشت submission key؛ تست gateway برای same-origin/allowlist/cookie-to-bearer؛ و Chromium برای انتقال UI از draft به request status است.

## خارج از دامنه

مرحله‌های کامل ۲ تا ۶ Figma، بارگذاری مدارک، reviewer/admin role، approve/reject، Seller activation، catalog writer، سفارش، موجودی، قیمت و settlement در این برش ساخته نشده‌اند.
