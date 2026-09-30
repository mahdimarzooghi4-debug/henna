# Organization 009 — Needs-based allocation preview and audit

## Referral-to-score mapping

The server maps the stored qualitative referral to `HouseholdNeedAssessmentInput` version 1.1:

- Health burden, non-housing economic hardship, care/support, reference-person education, and owner/tenant map through explicit allowlisted categories.
- Member count becomes household size. `INFANT`, `PRESCHOOL`, `SCHOOL_AGE`, `ADULT`, and `OLDER_ADULT` map to the formula bands under 2, 2–5, 6–17, 18–59, and 60+.
- The count of older members marked as needing practical support is passed to the age score.
- Gender and member-level education/chronic-need are preserved for context but do not add a score in version 1.1.
- City previews require a currently selectable city belonging to the selectable province. Non-city previews use the province's rural MPI. Only the dataset's exact provincial capital receives the configured 20% adjustment.
- A referral with historic null fields, mismatched age counts, or an unsupported geography fails closed; the system does not infer missing answers.

## Preview command

`POST /api/v1/admin/organization/programs/{programId}/allocation-previews`

The endpoint is admin-only, requires an idempotency key and exact revisions, and accepts explicit per-household amounts for `ORGANIZATION_DEFINED` or explicit base/ceiling amounts for `HENNA_NEEDS_BASED`. It calculates each selected household independently using the registered program mode and the organization-submitted instruction reference.

The immutable `organization.allocation_previews` row stores a SHA-256 request fingerprint and JSON audit snapshots containing the exact source-policy, scoring, formula, geography-dataset versions, mapped scores, factors, amount inputs, and calculated result. An identical retry returns the original preview; reuse of the key with changed inputs conflicts. The preview can be read through the admin-only GET endpoint.

## Safety boundary

The current funding instruction state is `PENDING_VERIFICATION`; every saved record is therefore forced to `PREVIEW_ONLY`. The preview is a deterministic calculation record, not an eligibility decision, award, reserve, wallet credit, ledger entry, or payment. It does not verify the source reference. No balance or allocation is changed.
