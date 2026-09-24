# Backend 034 — Organization Programs Read Model

## Business

صفحه «طرح‌ها و اعتبارها» باید از داده واقعی سازمان خودش خوانده شود. وجود یک
شناسه طرح در URL یا query هرگز نباید scope سازمان را تغییر دهد.

در این مرحله lifecycle نوشتن/ویرایش طرح باز نشده است، چون ماتریس permission
نقش‌های پرتال هنوز قرارداد صریح ندارد. این تصمیم از اعطای ناخواسته حق mutation
به هر عضو سازمان جلوگیری می‌کند.

## Model

`organization.programs`:
- id
- organization_id
- name
- kind
- allocation_method
- beneficiary_source
- description
- status: `DRAFT | REGISTERED | ACTIVE | PAUSED | ENDED`
- created_at_utc
- updated_at_utc

این جدول تعریف طرح است؛ **allocation، entitlement، wallet balance یا ledger نیست**.

## API

### GET /api/v1/organization/programs

Query:
- `page`: 1..10000, default 1
- `pageSize`: 1..50, default 20
- `status`: optional known status

هر query ناشناخته، از جمله `organizationId`، با 400 رد می‌شود.

### GET /api/v1/organization/programs/{id}

جزئیات فقط وقتی برمی‌گردد که id متعلق به organization عضویت فعال session باشد.
شناسه متعلق به tenant دیگر عمداً 404 می‌شود تا وجود آن افشا نشود.

## Security

مسیر دسترسی:
`Bearer session -> Identity account -> active membership -> active organization -> Programs WHERE organization_id = current organization`

- هیچ organization id از client trusted نیست.
- لیست و detail فیلد organization_id را برنمی‌گردانند.
- 401: session نامعتبر/لغوشده
- 403: account معتبر بدون membership فعال
- 404: طرح غایب یا متعلق به tenant دیگر
- 503: dependency/database failure
- no-store برای همه پاسخ‌ها

## Next

Frontend 035:
- BFF امن Programs
- جایگزینی جدول Figma با داده واقعی
- detail واقعی
- empty/error/access states
- فرم ایجاد طرح تا تعریف permission mutation غیرفعال می‌ماند.
