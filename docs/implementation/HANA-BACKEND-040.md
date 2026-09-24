# Backend 040 — Organization People & Recipients Read Model

## Why this comes before activation

The Figma Organization Portal contains ACTIVE/REGISTERED/DRAFT visual states,
but it does not define an organization-side activation authority or approval
workflow. Backend 040 therefore does not invent `REGISTERED -> ACTIVE`.

Instead it implements the next explicit portal surface: People & Recipients.

## Data boundary

`organization.recipients` represents one person enrolled in one organization
program. It is deliberately **not**:
- an allocation
- a credit entitlement
- a wallet balance
- a usage/consumption record
- a ledger entry

The table stores only the masked external reference used by the portal read
model. It does not introduce raw identity-document storage.

## Fields

- id
- organization_id
- program_id
- display_name
- reference_masked
- source: `MANUAL | API`
- match_status: `MATCHED | NEEDS_MATCH | PENDING_REVIEW`
- optional matched Hana account reference
- created/updated timestamps

Database constraints require MATCHED rows to have a real Hana account reference,
while non-matched rows cannot carry one.

## Tenant integrity

Recipients reference Programs using a composite database FK:

`(program_id, organization_id) -> programs(id, organization_id)`

This prevents a recipient row from claiming organization A while linking to a
program owned by organization B.

## API

`GET /api/v1/organization/recipients`

Filters:
- page / pageSize
- programId
- source
- matchStatus
- search (display name or masked reference)

The organization is always resolved from the authenticated Hana session and
active membership. A client-supplied `organizationId` is rejected.

A foreign programId filter returns the same empty result as a nonexistent local
program, so it cannot be used to enumerate another tenant.

## Response privacy

The API exposes:
- recipient display data
- masked reference only
- source and match state
- boolean `hanaAccountMatched`
- linked program id/name/status
- timestamps

It does not expose:
- organization_id
- matched_account_id
- raw identity data
- allocation/usage/entitlement fields

## Permission

Any active member of the active organization may read its recipient list,
matching the existing Organization Portal read policy. Mutation remains closed.

## Next

Frontend 041 can connect the People & Recipients Figma table to this API and
replace the sample allocation/usage cells with explicit "not connected" states
until those separate backends exist.
