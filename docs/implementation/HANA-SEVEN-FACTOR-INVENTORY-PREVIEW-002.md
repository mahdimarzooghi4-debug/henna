# Seven-factor reviewed-feature inventory — deterministic read-only preflight

**Scope:** Internal Backend-only. Follows ADR-063 / ADR-064 and
`HANA-SEVEN-FACTOR-REVIEW-INTAKE-001.md`.

## What exists

`AllocationSevenFactorReviewInventoryService.PreviewAsync` takes an explicitly
authorized Admin, a bounded, explicit selection of immutable Review IDs, and an
explicit UTC cutoff. It never chooses a review automatically.

The service checks every selected row and revalidates its historical
first-party allocation snapshot and effective runtime profile lineage.
It fails closed when selected reviews are absent, from after the cutoff,
have stale provenance, contain duplicates, conflict on one snapshot or
household, or mix source formula/dataset/funding/runtime versions.

A canonically ordered, versioned SHA-256 manifest digest covers all
reviewed feature values (seven dimensions including housing),
provenance references, source/cohort identities, reviewer identities,
source runtime lineage and cutoff. It returns the count, exact source
identity and digest without enumerating households in its result.

This is **REVIEW_ONLY_NUMERIC_RUBRIC_REQUIRED**, not an APPROVED
Dataset, a numeric Need Severity Label, a split Train/Validation/Evaluation
dataset, an EBM/XGBoost training input or a model selection decision.

## Safe boundaries

- Old six-factor snapshots, existing allocations, labels and training
  flows are unchanged.
- Existing essential-needs coverage outcomes remain an independent
  evidence-backed target, not an imputed need severity score.
- The presence of a SHA-256 digest does not establish source authenticity
  of arbitrary evidence references or approve an unreviewed numeric rubric.
- Competing/corrected reviews must be resolved by a separately approved
  human/versioning policy; no last-write-wins selection.
- This implementation does not expose a web/API route and does not create
  a persistence object, dataset row, AI proposal or runtime promotion.

## Next blocked contract

An approved *complete* positive numeric need-severity rubric and its
abstention/conflict/legacy-label semantics must exist before enabling
admission into a training dataset. Independently defined coverage
measurements and temporal/fairness/missing-data policies remain separate.

PR #165 remains Draft/Open/Unmerged. No Stage, QA Gate, Production or
recovery activity is implied.
