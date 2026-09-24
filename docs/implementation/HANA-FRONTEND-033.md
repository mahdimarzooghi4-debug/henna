# Frontend / Integration 033 — Organization BFF & Live Profile

## هدف

اتصال امن اولین داده واقعی Organization Portal به Backend 032 بدون افشای
Bearer در JavaScript، URL یا browser storage.

## جریان

1. OTP/session موجود حنا توکن را فقط در HttpOnly + SameSite=Strict cookie نگه می‌دارد.
2. Server Component صفحه Organization cookie را روی سرور می‌خواند.
3. `server-organization.ts` با Bearer سروری به
   `GET /api/v1/organization/me` متصل می‌شود.
4. پاسخ upstream با allowlist و validation سخت‌گیرانه parse می‌شود.
5. فقط profile مجاز به React داده می‌شود.
6. `GET /api/organization/me` همان مرز را برای client refreshهای آینده ارائه می‌کند.

## رفتار UI

- Header: نام و نوع سازمان واقعی
- Sidebar: نام سازمان و role عضویت واقعی
- Profile: contact/representative/identity واقعی
- 401: نمایش نیاز به ورود، بدون profile نمونه
- 403: نمایش نبود عضویت فعال
- 503/invalid upstream: fail closed؛ profile نمونه جایگزین نمی‌شود
- Dashboard: فقط هویت سازمان از API واقعی می‌آید؛ داده‌های عملیاتی باقیمانده
  همچنان صریحاً نمونه Figma هستند تا backend مربوطه ساخته شود.

## Security

- Bearer به browser JSON یا HTML نمی‌رود.
- browser Cookie به upstream forward نمی‌شود.
- پاسخ Organization فقط فیلدهای allowlist‌شده را برمی‌گرداند.
- 401 cookie نامعتبر را پاک می‌کند؛ 403 عضویت را با logout اشتباه نمی‌گیرد.
- production upstream فقط HTTPS طبق `server-auth.ts` است.

## بعدی

Backend 034: read model واقعی Programs & Credits با scope سازمانی، pagination و
tenant isolation؛ سپس اتصال صفحه Programs.
