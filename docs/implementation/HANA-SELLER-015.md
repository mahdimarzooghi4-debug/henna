# Seller 015 — Approved Seller Activation

## هدف

`APPROVED` نتیجه review است، نه مجوز عملیاتی.

Seller 015 یک transition مستقل برای activation اضافه می‌کند تا فقط بعد از
review موفق، نقش واقعی `SELLER` به account داده شود.

## Identity RBAC

سیستم role موجود Identity گسترش پیدا می‌کند:

- `ADMIN`
- `SELLER`

همان جدول موجود استفاده می‌شود:

`identity.role_assignments`

سیستم role موازی یا claim سمت client ساخته نمی‌شود.

## شرط activation

Admin فقط وقتی می‌تواند پرونده را فعال کند که:

- registration status = `SUBMITTED`
- review status = `APPROVED`
- activated_at_utc = null
- activated_by_account_id = null
- revision دقیق باشد
- amendment با وضعیت `OPEN` برای پرونده وجود نداشته باشد
- Idempotency-Key معتبر باشد

## Admin endpoint

`POST /api/v1/admin/seller-applications/{applicationId}/activate`

Body:

- revision

Header:

- Idempotency-Key

فقط account دارای نقش `ADMIN` مجاز است.

## Atomic role grant

Seller و Identity روی همان PostgreSQL database قرار دارند.

Activation در یک transaction انجام می‌شود:

1. registration activation state با CAS ثبت می‌شود.
2. `identity.role_assignments` برای `SELLER` ثبت می‌شود.
3. activation audit event ثبت می‌شود.
4. transaction commit می‌شود.

بنابراین activation committed بدون SELLER role ایجاد نمی‌شود.

Role insert با `ON CONFLICT (account_id, role) DO NOTHING` در برابر retry
یا provisioning قبلی مقاوم است.

## Seller activation state

روی `seller.registration_drafts`:

- activated_at_utc
- activated_by_account_id

Invariant:

- هر دو null هستند، یا
- پرونده باید SUBMITTED + APPROVED باشد و هر دو مقدار داشته باشند.

## Activation audit

جدول immutable:

`seller.seller_activations`

فیلدها:

- id
- application_account_id
- activated_by_account_id
- activation_key
- expected_revision
- created_at_utc

Constraints:

- activation key unique
- هر application فقط یک activation
- expected revision >= 1

## Idempotency

Retry دقیق با همان:

- activation key
- application
- Admin actor
- expected revision

همان نتیجه را برمی‌گرداند.

کلید متفاوت برای application فعال‌شده conflict است.

## Seller access boundary

`GET /api/v1/seller/access`

دسترسی فقط وقتی 200 است که هر دو شرط برقرار باشند:

1. Identity role = `SELLER`
2. همان registration واقعاً activation state معتبر داشته باشد

داشتن session، phone verified، registration یا حتی APPROVED به‌تنهایی کافی نیست.

Response:

- sellerAccess = true
- trackingCode
- activatedAtUtc

## Applicant status

Status API اکنون اضافه می‌کند:

- activatedAtUtc
- sellerAccessEnabled

قبل از activation:

- sellerAccessEnabled = false

بعد از activation:

- sellerAccessEnabled = true

## Panel UI boundary

در repository فعلی route واقعی `/seller` وجود ندارد؛ فقط
`/seller/register` وجود دارد.

بنابراین Seller 015:

- role و API access واقعی را فعال می‌کند
- UI یا route جعلی پنل نمی‌سازد
- `sellerPanelEnabled=false` باقی می‌ماند

ساخت shell پنل فروشنده یک slice مستقل بعدی است.

## QA

Integration test ثابت می‌کند:

1. APPROVED بدون activation هنوز SELLER role ندارد.
2. `/api/v1/seller/access` قبل از activation → 403.
3. UNDER_REVIEW قابل activation نیست.
4. non-admin نمی‌تواند activate کند.
5. stale revision conflict است.
6. Admin activation موفق:
   - revision + 1
   - activated_at_utc
   - activated_by_account_id
   - SELLER role
   - activation audit
7. retry همان activation key idempotent است.
8. activation دوم با key دیگر conflict است.
9. seller access بعد از activation → 200.
10. status sellerAccessEnabled=true.
11. sellerPanelEnabled=false تا UI واقعی ساخته شود.

## Platform scope

- backend
- web status
- mobile / Android release scope

iOS خارج از scope است.

## خارج از دامنه

- Seller panel UI
- catalog write UI
- seller profile operational setup
- deactivation / suspension
- role revocation
