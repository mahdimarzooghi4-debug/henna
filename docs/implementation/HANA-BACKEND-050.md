# Backend 050 — Organization Reports Overview

## Scope

Backend 050 starts the Organization Reports screen with a mixed real-data /
capability-boundary read model.

Figma:
- ORGPORTAL / 12 Reports — node `386:1690`

The screen has three concepts:
1. recipient matching status
2. budget/usage status
3. allocation/distribution trend

Only the first can currently be calculated truthfully from approved persisted
data.

## Endpoint

`GET /api/v1/organization/reports/overview`

Requires:
- valid Hana Bearer session
- active organization membership
- active organization

Any active portal member may read the report.

No query parameters are accepted.
There is no report mutation route.

## Real matching metric

Matching is computed from the same tenant-scoped readiness model used by
Allocation.

Scope:

`ELIGIBLE_PROGRAM_RECIPIENT_RECORDS`

Only recipient records belonging to tenant-owned:
- REGISTERED Programs
- ACTIVE Programs

are counted.

The report returns:
- eligibleProgramCount
- totalEnrollmentRecordCount
- matchedRecordCount
- needsReviewRecordCount
- matchRatePercent

`MATCHED` is counted as matched.

`NEEDS_MATCH` and `PENDING_REVIEW` are counted as needs review.

This is a **recipient-record** metric, not a unique-person metric.

### Zero denominator

If there are eligible Programs but no recipient records:

`matchRatePercent = null`

The API does not call an empty population "0% matched."

## Financial usage card

The Figma "used budget" card is not backed by an approved financial model.

Backend 050 returns:
- usage.available = false
- usedBudget = null
- utilizationPercent = null

Null is unavailable/unknown, not zero.

## Allocation/distribution trend

The Figma bar chart is financial/operational allocation history.

No approved allocation execution/history model exists yet, so Backend 050
returns:
- allocationDistributionTrend.available = false
- points = []

No sample periods or bars are promoted to production data.

## Capability

The response states:
- financialReportingAvailable = false
- allocationDistributionTrendAvailable = false

## Sync time

`lastRecordedSyncAtUtc = null`

There is no approved source-sync history model that can truthfully supply this
timestamp yet.

## Privacy / tenant scope

The response does not expose:
- organization ID
- Program IDs/names
- recipient IDs/names/references
- account IDs
- phones
- amounts
- balances
- funding source
- ledger
- allocation IDs

## Persistence

No migration is added.

Reports are projections over existing approved data, and unavailable financial
sections remain schema-free.

## PostgreSQL QA

Real integration tests verify:
- anonymous => 401
- authenticated non-member => 403
- revoked session => 401
- query smuggling => 400
- only REGISTERED/ACTIVE Programs contribute
- DRAFT excluded
- foreign tenant excluded
- MATCHED count
- NEEDS_MATCH/PENDING_REVIEW count
- exact 50% match rate for 2/4
- null match rate for empty denominator
- financial usage unavailable/null
- allocation trend unavailable/empty
- no-store
- no tenant/Program/recipient/account/financial identifiers leak

## Next

Frontend 051 should connect the Figma Reports screen to this endpoint:
- render the real matching card and progress
- render the usage card as unavailable, not 0%
- replace the sample allocation trend bars with an explicit unavailable state
- keep the visual hierarchy from Figma
