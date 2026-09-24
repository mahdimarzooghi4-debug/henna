# Backend 036 — Organization Program Draft Mutation

## Permission contract

Read endpoints keep the existing rule: any active member of an active
organization may read that organization's programs.

Mutation is deliberately narrower:
- `PORTAL_ADMIN`: create/edit draft
- every other or unknown role: no program mutation

Unknown roles fail closed. No role is inferred from seller/account state.

## Create draft

`POST /api/v1/organization/programs`

Required header:
- `Idempotency-Key: <non-empty UUID>`

Allowed JSON fields only:
- `name`
- `kind`
- `beneficiarySource`: `MANUAL | API | API_OR_MANUAL`
- `description`

The client cannot set:
- organization
- allocation method
- status
- revision
- program id
- audit actor

Server derives:
- organization from session -> active membership
- allocation method from active organization profile
- status = `DRAFT`
- revision = 1
- id
- created/updated actor account
- timestamps

The same idempotency key + identical payload returns the same program. Reusing
the key with a different payload returns 409. A unique database index makes
concurrent retries converge on one draft.

## Edit draft

`PUT /api/v1/organization/programs/{id}`

Allowed fields:
- the same editable draft fields
- `revision`

Update executes only when all conditions match:
- current tenant
- program id
- status = `DRAFT`
- revision = client's expected revision

A successful update increments revision atomically. A stale revision returns
409 with `currentRevision`. A cross-tenant id remains 404. A non-draft program
returns 409 and is not modified.

## Audit compatibility

New writes store `created_by_account_id` and `updated_by_account_id`.
Those columns remain nullable for records that existed before Backend 036;
no historical actor is fabricated.

## Deliberate non-scope

No endpoint exists yet for DRAFT -> REGISTERED/ACTIVE, pause, end, allocation,
beneficiary entitlements, balances, or ledger entries.

## Next

Frontend 037:
- enable the create form for PORTAL_ADMIN
- BFF POST with generated idempotency key
- detail edit with revision conflict recovery
- keep non-admin mutation controls unavailable
