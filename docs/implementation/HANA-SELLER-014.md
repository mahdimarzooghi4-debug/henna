# Seller 014 — تکمیل اطلاعات و ارسال مجدد

## هدف

وقتی reviewer نتیجه `NEEDS_INFORMATION` ثبت می‌کند، مالک همان پرونده
می‌تواند اطلاعات غیرهویتی را اصلاح و همان درخواست را دوباره برای بررسی
ارسال کند.

## State machine

```
SUBMITTED / UNDER_REVIEW
        |
        | Admin: NEEDS_INFORMATION
        v
SUBMITTED / NEEDS_INFORMATION
        |
        | Owner: reopen (exact revision)
        v
REWORK / NEEDS_INFORMATION
        |
        | Owner: edit non-identity fields
        | Owner: confirm + resubmit
        v
SUBMITTED / UNDER_REVIEW
```

Tracking code در کل این چرخه ثابت می‌ماند.

## REWORK

`REWORK` یک registration status مستقل است.

Invariantهای DB:

- completed_step = 6
- review_status = NEEDS_INFORMATION
- review reason موجود
- reviewer و review timestamp موجود
- submission metadata موجود
- tracking code موجود

REWORK برای DRAFT معمولی یا پرونده APPROVED/REJECTED قابل ایجاد نیست.

## Reopen API

`POST /api/v1/seller/registration/reopen`

ورودی:

- revision

شرایط:

- session معتبر
- مالک همان پرونده
- status = SUBMITTED
- review_status = NEEDS_INFORMATION
- completed_step = 6
- exact revision

موفقیت:

- status → REWORK
- revision + 1
- tracking code حفظ می‌شود
- reviewer reason حفظ می‌شود

Lost-response retry برای transition دقیق قبلی idempotent است.

## Identity boundary

در REWORK این بخش‌ها قفل هستند:

- اطلاعات اولیه مالک حساب
- نوع متقاضی
- احراز هویت شخص حقیقی
- اطلاعات شخصیت حقوقی / نماینده

هیچ endpoint هویتی برای REWORK باز نشده است.

## Editable sections

فقط این سه بخش قابل اصلاح‌اند:

### Business information

- category
- business name
- description
- business phone
- offering type

### Activity area

- province / city
- address
- activity hours
- delivery methods
- service area

### Additional information

- registration contact
- contact role
- backup phone
- website/social
- business email
- response hours

هر save:

- exact revision را می‌خواهد
- revision را یک واحد افزایش می‌دهد
- status را REWORK نگه می‌دارد
- completed_step را 6 نگه می‌دارد

## Resubmit

همان endpoint final submit استفاده می‌شود:

`POST /api/v1/seller/registration/submit`

برای REWORK:

- confirmed=true همچنان اجباری است
- idempotency key جدید برای چرخه ارسال مجدد استفاده می‌شود
- tracking code قبلی حفظ می‌شود
- status → SUBMITTED
- review_status → UNDER_REVIEW
- current review reason/reviewer/time پاک می‌شوند
- revision افزایش می‌یابد

Audit event قبلی NEEDS_INFORMATION حذف یا بازنویسی نمی‌شود.

Reviewer بعد از resubmit می‌تواند یک review event جدید ثبت کند.

## Applicant UX

در status page فقط وقتی outcome برابر NEEDS_INFORMATION باشد:

- reviewer reason نمایش داده می‌شود
- CTA «تکمیل اطلاعات» فعال می‌شود

پس از reopen:

- کاربر به `/seller/register` برمی‌گردد
- correction banner و کد پیگیری دیده می‌شود
- Identity read-only است
- Business / Activity / Additional editable هستند
- هر بخش save مستقل دارد
- تا وقتی تغییر ذخیره‌نشده وجود دارد، resubmit قفل است
- confirmation صریح اصلاحات برای resubmit الزامی است

## Admin behavior

پرونده در REWORK از queue درخواست‌های SUBMITTED خارج است و Admin نمی‌تواند
در میانه اصلاح کاربر review جدید ثبت کند.

پس از resubmit دوباره با `SUBMITTED / UNDER_REVIEW` وارد queue می‌شود.

## Audit

Seller 013 review events immutable باقی می‌مانند.

نمونه تاریخچه:

1. NEEDS_INFORMATION
2. applicant rework + resubmit
3. APPROVED

Seller 014 event قبلی reviewer را حذف نمی‌کند.

## QA

### PostgreSQL/API

- Admin → NEEDS_INFORMATION
- applicant status → reason + revision
- owner reopen
- applicant type/Identity change → conflict
- correction save in REWORK
- completed_step remains 6
- tracking code unchanged
- resubmit → UNDER_REVIEW
- reviewer can decide again
- review audit contains both cycles

### BFF

- reopen same-origin only
- strict revision-only body
- invalid/stale state → conflict
- strict REWORK response validation
- correction responses support DRAFT or REWORK explicitly
- status revision validated

### Chromium

Journey:

`submit → status → NEEDS_INFORMATION → reopen → correction → save → explicit confirmation → resubmit`

Asserts:

- identity fields locked
- correction fields editable
- reviewer reason visible
- tracking code stable
- resubmitted status returns to UNDER_REVIEW

## Platform scope

- backend
- web
- mobile / Android release scope

iOS خارج از scope فعلی است.

## خارج از دامنه

- changing identity during rework
- document upload workflow
- seller activation
- Seller role grant
- seller panel authorization
