# Backend 046 — Organization Allocation Readiness

## Scope

Backend 046 begins the Allocation area without inventing financial rules.

It exposes read-only readiness projections from data already owned by the
Organization module:
- active organization profile
- REGISTERED / ACTIVE programs
- recipient enrollment records
- Hana account match state
- enrollment source

It does **not** create credit, entitlement, balance, reservation, consumption,
ledger entry, funding record or allocation result.

## Why execution is disabled

The architecture documents describe allocation/ledger as a financial domain and
explicitly require approved credit rules and an approved Hana allocation model
before real monetary automation is implemented.

No current repository ADR defines enough executable semantics for:
- amount calculation
- funding source
- budget ownership
- effective / expiry dates
- eligibility version
- retry/reversal semantics
- ledger postings
- operator authority to run/replay the Hana allocation model

Therefore Backend 046 fails safe: it makes real inputs visible while financial
execution remains unavailable.

## Endpoints

### Overview

`GET /api/v1/organization/allocation/readiness`

Requires:
- valid Hana session
- active organization membership
- current organization must be active

Any active portal member may read readiness. There is no mutation on this
endpoint.

No query parameters are accepted.

Response contains:
- organization type
- registered default allocation method
- targetPeriod = null
- eligible program count
- input recipient-record count
- ready record count
- needs-review record count
- MANUAL/API source counts
- per-program readiness for REGISTERED/ACTIVE programs
- execution boundary
- process-history boundary

### Program readiness

`GET /api/v1/organization/allocation/readiness/{programId}`

Returns readiness for one tenant-owned REGISTERED/ACTIVE program.

Foreign, missing, DRAFT, PAUSED and ENDED program IDs are not allocation-ready
resources and return 404 from this route.

## Count semantics

The API reports **recipient records**, not unique people.

A recipient record is program-scoped. The privacy model deliberately does not
provide a cross-program global identity key suitable for counting one person
once across multiple programs.

Readiness:
- `MATCHED` => ready record
- `NEEDS_MATCH` => needs review
- `PENDING_REVIEW` => needs review

Only recipients belonging to REGISTERED/ACTIVE programs are counted.

## Execution boundary

Every response exposes:

```json
{
  "execution": {
    "enabled": false,
    "state": "NOT_CONFIGURED",
    "monetaryMutationSupported": false
  }
}
```

This is a technical capability boundary, not a claim about an external legal or
financial approval process.

There is no POST/PUT/DELETE allocation endpoint in Backend 046.

## Process history boundary

The Figma screen includes recent allocation-process history, but the codebase
does not yet have an approved financial allocation process model.

Backend 046 therefore returns:
- `processHistory.available = false`
- empty `items`

It never fabricates sample history as production data.

## Privacy and tenant scope

Responses do not expose:
- organization ID
- account ID
- matched Hana account ID
- recipient ID
- recipient display name
- raw or masked recipient reference
- phone
- allocation amount
- balance
- funding source
- ledger
- beneficiary account ID
- allocation ID

Program IDs/names/statuses are returned because they are tenant-owned portal
resources required to navigate the readiness UI.

## QA

Real PostgreSQL integration coverage verifies:
- anonymous => 401
- authenticated non-member => 403
- revoked session => 401
- query smuggling => 400
- REGISTERED + ACTIVE inclusion
- DRAFT exclusion
- foreign-tenant exclusion
- MATCHED readiness counts
- NEEDS_MATCH/PENDING_REVIEW review counts
- MANUAL/API source counts
- detail route for eligible program
- DRAFT/foreign/missing detail => 404
- no-store
- execution disabled
- process history unavailable
- no tenant/account/financial fields in JSON

## Figma mapping

This read model supplies the real-data portions of:
- ORGPORTAL / 09 Allocation — node `386:1279`
- ORGPORTAL / 10 Allocation Detail — node `386:1414`

The Figma "Start allocation process" control must remain disabled/guarded in the
shipping frontend until a later backend defines approved monetary semantics.

## Next

Frontend 047 should replace Allocation sample counts with Backend 046 data,
show REGISTERED/ACTIVE program readiness, expose the execution boundary
visibly, and turn the existing detail screen into a readiness/detail view
without implying that credit has been allocated.
