# Frontend 039 — Organization Program Registration Action

## Scope

Connects Backend 038's single lifecycle transition to the Organization Portal:

`DRAFT -> REGISTERED`

No activation, allocation, beneficiary entitlement, balance or ledger action is
introduced.

## Visibility

The action is rendered only when:
- organization profile role is `PORTAL_ADMIN`
- program status is `DRAFT`

This is presentation only. Backend 038 re-authorizes the transition.

## Confirmation

The first click does not mutate state. It opens an explicit confirmation block
that states:
- Draft editing will be closed by the current contract after registration
- registration is not activation
- registration does not allocate credit

The second explicit confirmation sends the transition.

## BFF

`POST /api/organization/programs/{id}/register`

Browser JSON contains only:
- `revision`
- `idempotencyKey`

The BFF:
- requires exact same-origin Origin
- validates a strict two-field body
- reads only the HttpOnly Hana session cookie
- forwards Bearer server-to-server
- moves the idempotency value into the upstream `Idempotency-Key` header
- sends upstream body containing only `revision`
- re-parses the response through the Program DTO allowlist

Registration/audit keys and account IDs never reach browser JSON.

## Retry / conflict

The mounted action retains the same idempotency key for repeated attempts of
the same revision, including a transport failure.

A 409 preserves the page and reports `currentRevision` when Backend 038
provides it. The user must explicitly reload the new server version before
trying again; there is no silent transition or overwrite.

## Registered UI

After success, server refresh removes Draft edit/register controls and displays
the registration time returned by Backend 038.

## CI

CI covers:
- admin Draft action visibility
- viewer action/edit absence
- same-origin/CSRF rejection
- strict body allowlist
- viewer write rejection
- transition 200
- response field allowlist
- same-key replay
- registered SSR state and registration time
- stale revision 409 allowlist
- cross-tenant 404
- older Program web fixtures updated for `registeredAtUtc`

## Next

Backend 040 should define the next lifecycle contract only after the business
meaning and permission for activation are explicit. Allocation remains separate.
