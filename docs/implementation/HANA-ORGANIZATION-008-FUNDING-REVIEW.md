# HANA-ORGANIZATION-008 — Funding instruction review

## Business behavior

An organization records an external reference for a funding instruction. The reference is not proof that funds were received or that the source is authorized. An existing Henna Admin may manually record that the reference was checked (VERIFIED) or reject it (REJECTED). Rejection requires a reason. The review action is an attestation by the reviewer and does not independently validate the source.

A rejected organization-defined instruction can be corrected by an active organization Representative or Lead and resubmitted. The initial submission and every review or correction remain in the instruction's history. A resubmission returns the current instruction to PENDING_VERIFICATION; it does not remove earlier review events.

## Technical contract

- Admin review endpoint: POST /api/v1/admin/organization-funding-instructions/{instructionId}/review.
- Admin history endpoint: GET /api/v1/admin/organization-funding-instructions/{instructionId}/events.
- Organization correction endpoint: PUT /api/v1/organization/programs/{programId}/funding-instruction.
- Review decisions and resubmissions require exact revision and an Idempotency-Key.
- Review events are stored separately from the current read model, with unique instruction revision and idempotency key.
- Organization reads expose only the current persisted state; rejected references can be corrected and sent back for review.
- Browser writes use the existing same-origin BFF boundary, HttpOnly session cookie, server-to-server bearer forwarding, strict payload validation, and no-store.
- Admin authority is resolved from Identity role assignments on the server.

## Verification gate

A funding-instruction reference must be marked `VERIFIED` before an allocation preview can be created. A pending or rejected instruction cannot be used for a calculation. Resubmission returns the instruction to `PENDING_VERIFICATION`, requiring a new review before preview.

## Explicit scope

This slice does not add an Admin screen because no approved Admin Figma exists. It does not create budgets, balances, credits, allocations, or ledger entries, and it does not change allocation mode or program state. It does not treat a reviewer decision as confirmation of money movement.

## QA and release gates

API integration coverage checks non-Admin denial, rejection reason validation, rejected reference correction, successful verification, stale revisions, idempotent retries, event history, and persisted current review state. Web smoke coverage checks same-origin and BFF session isolation for correction.

CI gates are backend, web, mobile, and Android. iOS remains out of scope.
