# Backend 038 — Organization Program DRAFT → REGISTERED

## Contract

Backend 038 adds one lifecycle transition only:

`DRAFT -> REGISTERED`

It does not activate a program, allocate credit, create beneficiary
entitlements, move money, or write a ledger entry.

## Permission

- active members keep read access
- `PORTAL_ADMIN` may register a Draft
- every other/unknown role fails closed

The permission is checked independently on the API even if a frontend hides
the action.

## Endpoint

`POST /api/v1/organization/programs/{id}/register`

Required:
- valid Hana Bearer session
- active organization membership
- role `PORTAL_ADMIN`
- `Idempotency-Key: <non-empty UUID>`
- JSON body containing exactly `{"revision": <positive integer>}`

No other JSON field or query parameter is accepted.

## Atomic transition

The database update is scoped by:
- program id
- current organization
- `status = DRAFT`
- exact expected revision
- no previous registration key

Success atomically:
- changes status to `REGISTERED`
- increments revision by 1
- stores registration idempotency key
- stores the expected revision used for the transition
- stores registered actor/time
- updates general audit actor/time

## Retry semantics

The registration idempotency key is scoped to the specific program transition.

A retry using the same key + same expected revision returns the already
registered resource without incrementing revision again.

The same key with a different revision returns 409. A different key after the
program is already registered also returns 409.

Concurrent equal retries converge on the same single transition.

## Isolation and conflict semantics

- 401: invalid/revoked session
- 403: valid member without register permission
- 404: missing or cross-tenant program id
- 409: stale revision, non-Draft status, incompatible idempotent replay
- 503: dependency/storage failure

Cross-tenant identifiers remain indistinguishable from nonexistent IDs.

## Audit compatibility

New registration actions populate:
- `registration_key`
- `registration_expected_revision`
- `registered_by_account_id`
- `registered_at_utc`

The audit columns remain nullable for rows that may have reached REGISTERED
before this contract existed; historical actors are never fabricated.

## Next

Frontend 039 can add an explicit "ثبت نهایی طرح" action with confirmation,
same-origin BFF, idempotency retry and revision-conflict recovery.

Activation remains a separate future contract.
