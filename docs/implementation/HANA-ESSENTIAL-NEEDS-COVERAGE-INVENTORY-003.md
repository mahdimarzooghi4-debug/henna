# Independent essential-needs coverage — reviewed evidence inventory

**Status:** Backend-only, read-only preflight in Draft PR #165.
**Authority:** ADR-052, ADR-063, ADR-064; feature-inventory
`HANA-SEVEN-FACTOR-INVENTORY-PREVIEW-002.md`.

## Purpose

Product Owner chose two independent learning objectives: reviewed need severity
and evidence-backed **essential-needs coverage after allocation**. This inventory
prepares only the second objective. It does not construct a numeric severity
label, conflate coverage with health or hardship, or infer coverage from wallet
activity, grant utilization, stock, delivery or access barriers.

## Data contract

`AllocationEssentialNeedsCoverageInventoryService.PreviewAsync` accepts an
explicit, bounded set of outcome Event IDs and an explicit UTC cutoff; only
an authorized Admin can request it.

Accepted events must have:
- genuine first-party Henna source snapshots and verified runtime lineage,
  same frozen formula/dataset/funding instruction and runtime profile;
- human-reviewed non-financial outcome provenance, reviewer ID, evidence
  reference, and a completed observation interval after allocation;
- an **observed** `EssentialNeedsCoverage` between 0 and 1 inclusive;
  **0 is valid; null means unknown and is rejected from this inventory**;
- no `CreditUsedRial` and no inferred or automatically reviewed outcome;
- no duplicate snapshot or household in the selected set; no latest-wins
  between competing intervals or reviews.

The canonical SHA-256 digest covers the selected IDs, coverage observations,
reviewer provenance, period/cutoff, optional independent barrier observations
and frozen source lineage. Results provide a count and fingerprint without
exposing household identities. Unknown targets are not coerced to zero or false.

**Status:** `OBSERVED_COVERAGE_ONLY_NOT_NEED_SEVERITY_LABEL`.

## Explicit exclusions

No dataset persistence, training/validation/evaluation split, new numeric
Need Severity rubric, label creation, coefficient learning, geographic learning,
new model or runtime activation, threshold, scoring formula, automated benefit
eligibility, wallet effects, payment integration or Production deployment.

The SHA-256 digest guarantees deterministic identity of the selected
representation, not that an external evidence reference has been verified
or that observed coverage is a causal effect of allocation.

To combine outcomes with reviewed seven-factor features in future, require
a **separate approved join and temporal/household isolation contract** and
positive numeric severity-label rubric for any severity learner. These two
inventories are independently inspectable but not automatically joined.

PR #165 remains Draft/Open/Unmerged; Stage, QA Gate, Release and Production
are not authorized by this read-only feature.
