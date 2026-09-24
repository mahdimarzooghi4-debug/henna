# Backend 048 — Organization Usage Status Boundary

## Scope

Backend 048 starts the Organization **Usage & Status** area without fabricating
financial usage data.

Figma reference:
- ORGPORTAL / 11 Usage & Status — node `386:1557`

The Figma screen contains:
- total allocated credit
- active credit in use
- consumed credit
- idle/unused credit
- per-beneficiary allocated amount
- per-beneficiary usage amount
- usage state
- last recorded usage/sync time

The current codebase has no approved entitlement, balance, ledger or usage
read model that can truthfully supply those values.

Backend 048 therefore exposes capability state only.

## Endpoint

`GET /api/v1/organization/usage/status`

Requires:
- valid Hana Bearer session
- active organization membership
- active organization

Any active portal member may read this boundary.

No query parameters are accepted.

There is no usage mutation route.

## Response

Real organization context:
- `organizationType`

Unavailable financial state:
- `lastRecordedSyncAtUtc = null`
- `summary.available = false`
- totalAllocated = null
- activeInUse = null
- consumed = null
- idleOrUnused = null

Per-beneficiary usage:
- `beneficiaryUsage.available = false`
- empty items

Capability boundary:
- `state = NOT_CONFIGURED`
- `monetaryUsageReadModelAvailable = false`
- `ledgerAvailable = false`

Null means **unknown/unavailable**, not zero.

## Important non-inference rule

Organization Programs and Recipients already exist, but they are enrollment
data.

Backend 048 does not infer any of the following from enrollment records:
- allocated credit
- consumed credit
- unused credit
- balance
- usage status
- last usage date

A MATCHED recipient is not treated as having credit or usage.

## Privacy

The response does not expose:
- organization ID
- Program ID/name
- recipient ID/name/reference
- matched account ID
- phone
- amount/currency
- balance
- funding source
- allocation ID
- ledger entries

## Persistence

No migration or financial table is added.

Creating a placeholder ledger/usage table before financial semantics exist
would make an unapproved domain model look authoritative, so Backend 048 keeps
the boundary read-only and schema-free.

## QA

Real PostgreSQL integration coverage seeds a real:
- active organization
- active Program
- MATCHED recipient

and verifies that the endpoint still does **not** infer usage.

Coverage includes:
- anonymous => 401
- authenticated non-member => 403
- revoked session => 401
- query smuggling => 400
- no-store
- organization type only as real context
- sync timestamp null
- all four financial summary values null
- beneficiary usage unavailable/empty
- capability NOT_CONFIGURED
- no tenant/Program/recipient/account identifiers in JSON
- no amount/balance/funding/ledger fields

## Next

Frontend 049 can connect the Figma Usage & Status screen to this boundary,
remove all sample amounts and sample beneficiary rows, and render a clear
"financial usage data not configured" state.

Real monetary values must wait for an approved financial model defining at
least:
- allocation/entitlement identity
- currency and amount semantics
- balance source of truth
- consumption event semantics
- reversals/refunds
- ledger posting model
- synchronization source/time
- beneficiary usage privacy policy
- reconciliation/audit rules
