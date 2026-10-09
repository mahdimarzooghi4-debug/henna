# Allocation rubric foundation — fail-closed identification

**Status:** Implementing the existing ADR-060 / ADR-061 boundaries; NOT an approved numeric labeling rubric
**Scope:** PR #165, backend training governance
**Versions:** `HENNA-AJF-v1` and `HENNA-ARR-v1`

## Why this boundary exists

The approved Judgment Framework `HENNA-AJF-v1` and the approved Review Rubric *foundation* `HENNA-ARR-v1` establish review reasoning, provenance, anti-bias discipline and reviewer training. Neither specifies a mapping from evidence to the existing numeric [0,1] Reviewed Need Label. A foundation version therefore is **not** an approved, complete numeric-label rubric.

A reviewer must not supply either foundation identifier as a labeling rubric in the existing API. Pre-existing or manually persisted labels carrying one of those identifiers must not be used to initiate an internal training run or a ready automated cohort. Offline XGBoost training must not accept the known foundation identifiers as though they were complete rubrics.

This is a **narrow negative admission rule** implementing an explicit existing prohibition. It is not evidence that every other arbitrary rubric string is approved.

## Invariants for this slice

- Reject `HENNA-AJF-v1` and `HENNA-ARR-v1` as label rubric versions (including surrounding whitespace or case variants); never create a label for them.
- Reject an existing cohort carrying either identifier before training; no new TrainingRun, model artifact or Proposal should be created from that input.
- Do not offer known foundation-version cohorts for automatic training.
- Preserve historical persisted rows; do not rewrite or delete labels.
- Preserve existing experimental test rubrics and behavior for all other identifiers in this slice; *do not* claim this is a complete positive admission check.
- Reject these identifiers before the in-process shadow learner fits a model. This is a defense-in-depth check, not a claim of production readiness.
- No behavior change to Commerce, allocation, wallet, eligibility, provider integration, pilot or Production activation.

## Separate future product / data decisions (NOT made here)

The decision inventory, admission/enforcement map and future acceptance-test plan are recorded in [`HANA-POSITIVE-RUBRIC-ADMISSION-CONTRACT-DRAFT.md`](../product/HANA-POSITIVE-RUBRIC-ADMISSION-CONTRACT-DRAFT.md). That document is explicitly DRAFT and authorizes no numeric labeling, approval registry or runtime change.

A complete **positive Rubric Admission** contract must be explicitly approved before production-grade Reviewed Need Labels or their downstream evidence can be relied upon. It must specify:

1. Versioned complete-rubric identity, approval authority/status and immutable effective version;
2. Semantic interpretation of the numeric [0,1] label and permitted mapping from reviewed evidence to the value;
3. Treatment of incomplete, unknown and conflicting evidence, including whether abstention is required;
4. Evidence references, accountable reviewer rationale and audit/version lineage;
5. Training / Evaluation validation against that approved immutable rubric version;
6. Policy for legacy labels and reviewer agreement/calibration without invented thresholds.

The values, thresholds, fairness cohorts/metrics, temporal stability and missing-value semantics remain undecided. No default, new score formula, synthetic training row or automatic admission is authorized by this document.

## Evidence / validation

Regression tests should cover rejected label creation and rejected legacy foundation cohort, as well as continued acceptance of existing synthetic test rubrics. Only full exact-head CI on PR #165 determines successful integration.

References: `docs/product/HANA-ALLOCATION-JUDGMENT-FRAMEWORK.md`, `docs/product/HANA-ALLOCATION-REVIEW-RUBRIC.md`, ADR-060, ADR-061.

## Independent benchmark and EBM artifact boundary

Before a new benchmark record is created, the Baseline/Profile, XGBoost, and EBM independent Evaluation services reject legacy labels whose rubric version identifies either known non-labeling foundation (`HENNA-AJF-v1` or `HENNA-ARR-v1`). The pure XGBoost and EBM benchmark evaluators also reject those identifiers. EBM artifact registration rejects training-run frozen examples with those identifiers. Existing rows and previously recorded evidence remain unchanged.

This implements **known-negative version rejection only**. It does not establish positive approval or a numeric labeling rubric for any other identifier. A separate explicitly approved Rubric Admission registry and complete numeric-label semantics are prerequisites before future evidence can be asserted as production-grade. No change to runtime or Production authorization.
