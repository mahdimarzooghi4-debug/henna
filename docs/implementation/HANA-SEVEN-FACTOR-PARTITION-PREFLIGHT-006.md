# Human seven-factor evidence: explicit three-partition preflight

**State:** Internal-only, read-only in Draft PR #165. Does NOT authorize
positive numeric-label admission, training, candidate selection or Production.

This is an executable data-integrity step between the approved five-level
human review/qualitative criteria (ADR-065/066/067) and the still-unapproved
complete positive model-learning rubric. It deliberately does not infer
need severity, join the independent post-allocation coverage objective,
or assign a partition without explicit human selection.

\`AllocationSevenFactorPartitionPreflightService.PreviewAsync\` takes three
nonempty explicit sets of **human review IDs** for Training, Validation and
independent Evaluation, plus an explicit UTC cutoff and authorized Admin.
It rejects duplicate IDs, multiple competing reviews for one seven-factor
review, stale/ineligible first-party snapshots, mismatched source formula,
dataset, funding instruction or runtime profile and **any household overlap
across the entire selection** (including different snapshots of one household).
Missing or conflicting/abstained severity reviews cannot enter the preview.
Level and qualitative anchor must match the approved five-level scale.

The service validates the actual seven reviewed household inputs including
explicit evidence-backed housing, separate non-housing hardship and geographic
factor. It generates a canonical SHA-256 over the explicit partition choices,
source identity, human review identities/values/rationale, seven feature
values and provenance plus cutoff. Only partition counts and the manifest
digest are returned; no individual household data are exposed by the result.

**Status:** \`NOT_ADMITTED_COMPLETE_RUBRIC_AND_EVALUATION_GOVERNANCE_REQUIRED\`.
This digest is evidence identity, NOT a DataSetVersion/TrainingRun/label,
evaluated XGBoost model, score-calibration evidence or source authenticity
certificate. The operator may NOT assume a complete positive rubric or
statistical sufficiency based on three nonempty partitions: these bounds
are structural and request-size safeguards, not approved quality thresholds.

Further required: verifiable evidence provenance beyond arbitrary source
strings, explicit complete rubric identity/positive admission, human review
correction/withdrawal policy, temporal stability windows, missingness/fairness
criteria and explicit independent Model Evaluation/Pilot promotion. The
independent post-allocation essential-needs coverage objective remains
separately governed. No iOS/Stage/QA Gate/Production/Recovery or real money
is authorized.


## Full-universe conflict guard and consistent read

A caller cannot bypass unresolved amendment/withdrawal decisions simply by
omitting a known review ID. For every selected household, the preflight queries
**all** relevant source snapshots and requires the **entire** set of existing
seven-factor human feature reviews and qualitative severity judgments to
match the explicit selected IDs. An omitted competing or abstained human review,
a second feature assessment, or another reviewed snapshot for the same
household causes a fail-closed rejection, **including when the extra review
was recorded after the requested cutoff**. There is no latest-wins or silent
acceptance of an older digest after new evidence surfaces.

Related reads execute in one PostgreSQL REPEATABLE READ transaction to avoid
mixing different database snapshots during eligibility checks and SHA-256
creation. This protects consistency during preview; any later authorized
admission must re-attest against fresh data and still requires an explicit
correction/withdrawal resolution policy. No auto-withdraw or correction
precedence is invented.
