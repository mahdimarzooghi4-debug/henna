# HANA-ORGANIZATION-005 — Household referral intake

## Business scope

An organization may refer a household to one of its draft programs. This is an intake record only. It does not approve eligibility, create a benefit, set an amount, confirm funding, or execute either allocation method. Henna's own resources continue to use the Henna needs-based method; an organization's choice for its own program does not change that rule.

## Intake contract

- The organization supplies its own external case reference. Henna does not request a person's name, national identifier, phone number, bank details, or diagnosis.
- Location uses selectable province and city IDs from the canonical Geography data. Urban referrals require a city; rural referrals record the province and rural category without assigning a nearby city.
- Each household has 1–20 members. Per-member categories are gender (or not reported), life stage, education level (or not reported), and chronic support need (or not reported).
- Unknown information stays `NOT_REPORTED`; it is not converted to zero or to “no need”. The service does not score these values or calculate an allocation.
- Referral reference uniqueness is scoped to organization and program. Submission is tenant-scoped, revision-checked, idempotent, and persisted with submitter/time metadata. Member rows are created atomically with the referral.
- Organization lead and representative can submit; technical operator can read only. Any active member can read only that organization's program referrals.

## Deferred decisions

No coefficient table/version, eligibility review, funding verification, import/sync, consent workflow, retention duration, amendment, or allocation execution is established by this slice. Those require their own business and technical decisions. The current UI shows only the recorded referral count and submission facts; it does not show a needs score or financial state.
