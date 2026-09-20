# Identity 006 — استعلام و ابطال نشست API

**وضعیت:** مسیرهای سمت ASP.NET Core اضافه شدند و از ذخیره نشستِ مرحله 005 استفاده می‌کنند. **پیامک واقعی و ورود عمومی هنوز فعال نشده‌اند؛ اتصال امن مرورگر و اپ به نشست در این مرحله انجام نشده است.**

## اجرا

- `GET /api/v1/auth/session` با `Authorization: Bearer <opaque-token>`: فقط در صورت وجود نشست دارای digest معتبر، هنوز منقضی‌نشده و ابطال‌نشده، شناسه حساب را در `{accountId}` برمی‌گرداند. شماره موبایل، نقش فروشنده/ادمین/سازمان، مجوز و اعتبار حمایتی از این endpoint داده نمی‌شوند.
- `DELETE /api/v1/auth/session` با همان bearer: **ابطال DB-side** نشست جاری؛ بار اول 204، توکن غیرمعتبر/باطل/منقضی 401. مصرف‌کننده مجاز نیست صرفاً با پاک‌کردن localStorage یا کوکی، ابطال سمت سرور را فرض کند.
- پاسخ‌ها `Cache-Control: no-store` دارند و برای درخواست بدون bearer یا با توکن بدشکل 401؛ نبود اتصال DB یا خطا 503 است. انقضای token و revocation از API مستقل از دردسترس‌بودن provider پیامک‌اند: قطعی پیامک نباید موجب عدم امکان خروج کاربر قبلاً احراز‌شده شود.
- HTTPS خارج از Development اجباری است؛ محیط Development اجازه HTTP دارد **ولی باید API فقط به loopback متصل شود** (مانند launch profile کنونی)، نباید در شبکه عمومی ارائه شود. تا زمان استقرار، termination TLS و پروکسی‌های مورداعتماد و قواعد real-client-IP باید بررسی شوند.
- ارسال OTP و verify مرحله قبل **با provider غیرفعال** همچنان 503 باقی مانده‌اند و هیچ bypass یا رمز ثابت فعال نشده است.

## آزمون و ادامه

تست‌های PostgreSQL قبلیِ `AuthSessionService` صحت lookup، ابطال بار اول/دوم و پایان اعتبار را بررسی می‌کنند. CI برای 401 endpointهای GET و DELETE بدون bearer و با bearer ظاهراً معتبر اما ناشناس smoke test دارد؛ build .NET و وب و Expo برقرار است.

**مرحله بعد:** پیاده‌سازی `POST /api/auth/otp/verify` در Next به‌عنوان gateway و صدور **HttpOnly + Secure + SameSite** cookie در مرورگر، routeهای same-origin برای session/logout با بررسی Origin و استقرار session در SecureStore موبایل؛ بدون قراردادن bearer در JS/browser storage. فریم OTP هنوز باید با فیگمای تأییدشده تطبیق داده شود، نه طراحی مصوب حدسی.
