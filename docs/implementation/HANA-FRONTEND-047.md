# Frontend 047 — Organization Allocation Readiness UI

## Scope

Frontend 047 connects the two Allocation Figma screens to Backend 046 without
inventing financial execution.

Implemented screens:
- `/organization/allocation`
- `/organization/allocation/{programId}`

Figma references:
- ORGPORTAL / 09 Allocation — `386:1279`
- ORGPORTAL / 10 Allocation Detail — `386:1414`

## Real data

The overview now renders:
- organization type
- registered allocation method
- real input recipient-record count
- real ready count
- real needs-review count
- MANUAL/API source counts
- real REGISTERED/ACTIVE programs

Each program links explicitly to its own readiness detail route. The UI never
silently selects a program as a financial target.

## Sample-data removal

The Allocation screens no longer render Figma placeholders such as:
- داده نمونه
- تاریخ نمونه
- fake distributed/processing history
- fake allocation ID
- fake allocated-record count
- fake target period

When a backend concept is unavailable, the UI says so directly.

## Financial boundary

The Figma "شروع فرایند تخصیص" control remains visible for layout fidelity but
is disabled.

The page displays the backend boundary:
- execution state = NOT_CONFIGURED
- no monetary mutation
- no amount
- no balance
- no entitlement
- no ledger

The detail screen is a **readiness detail**, not a completed allocation.

"ready" means the current recipient enrollment record is matched to a verified
Hana account. It does not mean financial eligibility was approved or credit was
created.

## Process history

Backend 046 exposes process history as unavailable.

Frontend 047 renders an explicit empty-state and does not promote Figma sample
history to production data.

## Routes and target identity

The old generic sample navigation to
`/organization/allocation/detail` is removed.

A detail screen now requires the actual tenant-owned Program UUID:

`/organization/allocation/{programId}`

Missing, foreign, DRAFT, PAUSED or ENDED programs resolve to not-found through
the backend readiness boundary.

## Parsing / fail-closed behavior

`organization-allocation.ts` strictly validates:
- exact top-level object keys
- eligible statuses only
- UUID program IDs
- count arithmetic
- source-count arithmetic
- execution boundary
- empty/unavailable process history
- unavailable allocation result

Unexpected fields or inconsistent totals make the response unavailable rather
than partially trusting it.

This means an accidental new monetary field cannot silently appear in the
browser contract.

## Server data path

Server-rendered pages read the HttpOnly Hana session cookie server-side and
call Backend 046 with Bearer authentication.

No Bearer token is exposed to browser JavaScript.

## Same-origin read BFF

Also available for future in-page refresh:

- `GET /api/organization/allocation/readiness`
- `GET /api/organization/allocation/readiness/{programId}`

The BFF:
- accepts no query parameters
- reads only the HttpOnly session cookie
- returns no-store
- returns only the strictly parsed readiness contract
- clears an invalid session on 401
- exposes no mutation method

## UI adaptation from Figma

The original visual hierarchy is retained:
- organization context banner
- population/source card
- active rule/method card
- highlighted allocation control card
- process-history card
- detail toolbar
- readiness/result card
- base program information card

Production-state adaptations are intentional:
- sample values are replaced by real counts or explicit unavailable states
- allocation ID is replaced by a short Program identifier
- "processed/completed" is replaced by "financial execution disabled"
- final allocation result is replaced by "allocation not executed"

## Next

The Allocation UI is now ready for real financial execution only after a
separate approved backend contract defines at minimum:
- funding source
- amount calculation / currency semantics
- eligibility version
- effective/expiry rules
- budget ownership
- idempotency/replay/reversal
- ledger postings
- operator authorization
- audit/reconciliation behavior

Until then the UI remains read-only by design.
