# HANA-ORGANIZATION-002 — Program drafts and allocation collaboration mode

## Business boundary

When an organization provides the resources, it can work with Henna in either of two ways for a program:

- `HENNA_NEEDS_BASED`: Henna calculates each household's amount using its versioned need model.
- `ORGANIZATION_DEFINED`: the organization determines each beneficiary's amount; Henna's need model is not applied.

Exactly one mode is selected per organization-funded draft program. Henna's own charity-fund resources are always allocated with `HENNA_NEEDS_BASED`; an organization cannot choose another method for those resources. The funding instruction must later verify the owner and authorize the method. Selection is not a funding instruction and creates no wallet balance, allocation, beneficiary amount, ledger entry, or payment.

## Implemented slice

- Persists organization program drafts with an explicit allocation mode, description, creator, timestamp, idempotency key, and initial revision.
- Account-scoped read returns only programs belonging to organizations with active membership.
- `ORG_LEAD` and `ORG_REPRESENTATIVE` can create a draft; `ORG_TECHNICAL_OPERATOR` can read but cannot create one.
- The organization portal lists real drafts and offers a Figma-aligned draft form with the two distinct methods for organization-provided resources.
- Mutations use the same-origin cookie BFF; the browser never receives a bearer token.
- Database constraints restrict mode to the two approved values and drafts to revision 1.

## API

- `GET /api/v1/organization/programs`
- `POST /api/v1/organization/programs` with an `Idempotency-Key` header
- Web BFF: `GET/POST /api/organization/programs`
- Web routes: `/organization/programs`, `/organization/programs/new`

## Deferred

Funding source verification/authorization, editable drafts, recipient imports/eligibility, organization-entered per-recipient amounts, review/submission, Henna quote generation, allocation approval, wallet/ledger posting, consumption, reversals, and reports remain separate increments. No amount or fake organization data is generated here.

## Verification

- EF model snapshot drift test.
- PostgreSQL/API coverage for two modes, membership scoping, `ORG_TECHNICAL_OPERATOR` denial, idempotent retry, changed-payload conflict, and absence of financial fields.
- Browser flow checks selecting organization-defined mode, draft persistence through the read model, no financial values, and mobile layout.
- Required CI gates: backend, web, mobile, Android. iOS remains out of scope.
