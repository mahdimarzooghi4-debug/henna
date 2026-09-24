# Frontend 035 — Live Organization Programs

## Scope

صفحات Programs List و Program Detail از داده نمونه Figma به Backend 034 متصل شدند.

## Browser boundary

Browser فقط cookie امن HttpOnly حنا را دارد. مسیرهای وب:
- `GET /api/organization/programs`
- `GET /api/organization/programs/{id}`

BFF، Bearer را فقط server-to-server ارسال می‌کند و پاسخ backend را دوباره با
allowlist سخت‌گیرانه parse می‌کند.

## SSR

- `/organization/programs`: لیست واقعی، فیلتر وضعیت و pagination
- `/organization/programs/{id}`: جزئیات واقعی طرح
- cross-tenant/missing detail: HTTP 404
- invalid list query: state خطای صریح؛ BFF برابر 400
- 401/403/503 از یکدیگر جدا هستند

## Data honesty

صفحه Detail دیگر برای تخصیص، مصرف یا تعداد مشمولان مقدار نمونه نمایش نمی‌دهد.
این داده‌ها تا ساخت backend مربوطه صریحاً «متصل نشده» باقی می‌مانند.

## Mutation boundary

فرم `/organization/programs/new` حفظ شده اما همه ورودی‌ها غیرفعال‌اند.
تا زمان تصویب permission نوشتن برای roleهای سازمانی هیچ POST/PUT ساخته نشده است.

## Next

Backend 036:
- permission contract برای mutation طرح
- create draft با optimistic revision/idempotency policy
- audit fields بدون جعل workflow تایید
