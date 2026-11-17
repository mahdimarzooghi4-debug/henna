# HANA-ORGANIZATION-007 — Funding instruction verification readiness

## Business goal

Define the control that must happen between an organization recording a funding-instruction reference and Henna using that instruction for any later calculation or allocation workflow.

This is a backlog and contract-readiness slice only. It does not verify a funding source or authorize money movement.

## Current confirmed boundary

- Organization programs carry an explicit allocation mode: Henna needs-based or organization-defined.
- An organization funding-instruction record snapshots the program revision and allocation mode, stores the organization's reference, and remains `PENDING_VERIFICATION`.
- The reference is an identifier supplied by the organization. It does not prove source ownership, receipt of funds, or the submitter's authority.
- Household referrals contain qualitative member categories and selectable geography. They do not create eligibility, scores, calculations, amounts, balances, or credits.
- Funding policy v2 permits both modes for organization-owned resources; Henna charity-fund resources are needs-based only. Recording a mode does not override the policy or prove source ownership.
- The current referral and funding-instruction slices do not provide an approved funding-review UI or a persisted verification decision.

## Decisions required before implementation

1. **Verification authority:** confirm which existing privileged role may attest that an instruction was checked, and whether the existing Admin role is sufficient for this operation.
2. **Verification basis:** define what the reviewer checks when the application stores only an external reference. Do not represent the reference itself as evidence.
3. **Decision states and transitions:** approve the possible outcomes, whether a rejected instruction can be corrected or resubmitted, and whether verification is invalidated when the program revision or allocation mode changes.
4. **Audit fields:** approve the minimum reviewer, timestamp, decision, and reason fields. Decide whether any external evidence reference is needed; do not copy sensitive financial documents into Henna by default.
5. **User experience:** provide an approved Figma frame for the Admin review screen before building Admin UI. This backlog does not invent that screen.

## Proposed implementation boundary after those decisions

A later backend slice can add an Admin-only, revision-checked, idempotent decision endpoint and immutable audit history, then expose the actual decision to the organization read model. The endpoint and resulting state names must follow the approved decisions above.

The verification action must not itself:
- create a budget, credit, wallet balance, allocation, or ledger entry;
- infer an amount or eligible household;
- change the program's selected allocation mode;
- treat an external reference as proof without reviewer verification.

The later calculation path must continue to apply the recorded funding source and the source-mode policy. Financial execution remains a separate approved workflow.

## Sprint and QA outline

After the business decisions and Admin design are approved:

- add the Admin backend contract and persistence with optimistic revision and idempotency;
- verify unauthorized callers cannot decide;
- cover accepted and rejected decisions, stale revisions, same-key retries, audit persistence, and program-revision behavior;
- verify organization reads are tenant-scoped and show only persisted decisions;
- keep CI gates to backend, web, mobile, and Android. iOS is out of scope.

## Release boundary

This slice adds no runtime behavior, database migration, status, Admin screen, or financial data. It records the dependency and acceptance criteria for the next implementation sprint.
