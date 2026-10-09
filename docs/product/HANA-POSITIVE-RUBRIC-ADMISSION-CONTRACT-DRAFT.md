# Positive Rubric Admission — Contract and Enforcement Map (DRAFT)

**Status:** Decision-preparation only; NOT an approved product contract or executable authorization.
**Date:** 2026-10-09
**Scope:** Henna Allocation Learning / PR #165. No Commerce, wallet, eligibility, payment, Pilot or Production runtime change.
**Existing authorities:** ADR-060 (Accepted Judgment Framework `HENNA-AJF-v1`), ADR-061 (Accepted Review Rubric *foundation* `HENNA-ARR-v1`), ADR-058/059 (Production-track model family and in-process runtime boundary).
**Related implementation:** `docs/implementation/HANA-ALLOCATION-RUBRIC-FOUNDATION-FAIL-CLOSED.md`.

## 1. Decision boundary

The currently approved foundation specifies how a human reviewer must reason about first-party evidence, uncertainty, bias, conflicts and rationale. It **does not** define how that judgment becomes a numeric [0,1] Reviewed Need Label. Neither `HENNA-AJF-v1` nor `HENNA-ARR-v1` is an approved numeric labeling rubric. Approval of this foundation cannot authorize the creation of production-grade labels, a training dataset, selection of an XGBoost winner or Production promotion.

Current safeguards reject the two known non-labeling foundation identifiers at relevant label creation, learning and evaluation boundaries. That is a **known-negative restriction**, not a registry of approved complete rubrics. In particular, an arbitrary identifier that is not rejected is **not thereby approved**. Do not interpret current experimental acceptance of other strings as Production-grade rubric authorization.

**This document records missing product decisions and the prospective enforcement footprint. It creates no positive allowlist, new status machine, authorization, thresholds, numeric mapping or model-selection policy.**

## 2. Approved invariants that subsequent implementation must preserve

1. A Reviewed Need Label is a human judgment made with an accountable reviewer and explicit versioned rubric lineage; AI cannot invent or modify it.
2. Framework or rubric content is not a model input, feature, training row or synthetic Production evidence.
3. Usage/spend, unused credit, complaints, prior allocations, the current formula and model outputs are not ground-truth need labels; unsupported causality is prohibited.
4. Unknown or conflicting evidence stays visible. No inference of zero, false, “no need” or “no barrier” from missing evidence.
5. Material changes must not silently reinterpret or mutate historical labels. Subsequent correction requires governed new review evidence.
6. Training, independent evaluation and candidate governance remain distinct; evidence alone cannot select a winner or activate Production.
7. XGBoost is a Production-track **family**, not an active Production model. EBM is a challenger; the constrained profile is a baseline. All AI remains Henna-owned, in-process and explicitly governed.
8. Any unresolved policy remains unresolved; no fallback “approved” rubric or unreviewed migration of legacy labels.

## Accepted evidence-review actor decision — ADR-067

The Product Owner approved **one authorized Admin as sufficient** to review
authenticity of Need Severity evidence; no second independent signer is
required. The Admin may be the same actor who captured the seven-feature
review and chosen qualitative level. An evidence reference must not be
treated as an automatically authenticated underlying document. This resolves
the actor requirement only; document-level verification, complete positive
rubric admission, temporal/fairness/missing-data policy and model promotion
remain separate gates.

## 3. Product decisions still required (no defaults)

| Decision area | Precise question for Product / Data Governance | Current disposition |
| --- | --- | --- |
| Complete rubric identity | What versioned document, immutable content identity and framework reference constitute a *complete* numeric label rubric? | OPEN |
| Approval | Who may approve that complete version, how is approval evidenced, and which version/status can admit *new* labels? | OPEN |
| Numeric meaning | What does each value on the existing [0,1] label scale mean, and how is evidence mapped to it? | OPEN |
| Evidence admissibility | Which attributable first-party/human-reviewed evidence can justify a label, with what review-period and provenance rules? | OPEN |
| Insufficient / conflicting evidence | When must the reviewer refrain from producing a number, and is abstention required or permitted? | OPEN |
| Review record | Which structured evidence references, rationale, reviewer attestations and uncertainty/conflict declarations must be retained? | OPEN |
| Version lifecycle | How are amendment, replacement, withdrawal, effective time and historic use of a rubric represented without rewriting the past? | OPEN |
| Legacy labels | Which previously stored experimental labels, if any, can qualify later, and under what separately approved review/relabel process? | OPEN |
| Evaluation alignment | What exact checks link approved rubric identity and frozen label lineage across Training, Validation and independent Evaluation? | OPEN |
| Calibration | What reviewer-consistency protocol, if any, applies, including disagreement treatment? No threshold is approved. | OPEN |

Separate unresolved contracts remain **out of scope**: temporal stability cohort rules, fairness cohorts/metrics/acceptance, feature missing-value semantics, statistical adequacy, model ranking and Production/Pilot thresholds.

## 4. Existing enforcement footprint (verified at PR #165 HEAD `341a8ac`)

| Boundary | Current behavior | Future decision-dependent work |
| --- | --- | --- |
| `AllocationTrainingWorkflow.ReviewNeedAsync` | Admin role, first-party snapshot lineage, score range, rubric string; rejects `HENNA-AJF-v1`/`HENNA-ARR-v1` | Check an explicitly approved *complete* version, capture review rationale and evidence by an approved schema; only when decisions above exist |
| `AllocationTrainingWorkflow.TrainAsync` | Verifies label IDs, cutoff, partitions, lineage and known-negative versions; frozen examples retained | Verify exact admission/label-version lineage and any authorized handling of historical labels before a new run; preserve idempotency and immutability |
| `AllocationLearningAutomationPlanner.BuildAsync` | Excludes known-negative labels from discovered cohorts; groups by stored rubric string | Do not offer or trigger production-grade cohorts without approved positive admission; exact experimental/production separation awaits contract |
| `HennaXGBoostOfflineLearner.Train` | Validates a single rubric string, partitions and distinct households; rejects known-negative identifiers | Add approved-version defense in depth only after registry contract exists; keep offline learner independent of text/rubric as feature |
| `AllocationModelBenchmarkService`, `AllocationShadowModelBenchmarkService` | Validate independent Evaluation labels and reject known-negative identifiers | Bind evaluation to approved rubric and immutable label lineage, including revalidation/replay semantics as contracted |
| `AllocationEbmArtifactService` and EBM benchmark paths | Validate frozen TrainingRun/evaluation evidence and reject known-negative identifiers | Apply the same future positive admission and lineage policy to challenger evidence |
| `AllocationRubricFoundationBoundary` | Intentionally negative-only; trims/case-folds two known foundation version identifiers | Do not turn it into a positive registry by interpreting unknown strings as approved |

**Important:** Existing synthetic/experimental test rubric compatibility does not make those rubrics approved for governed Production learning. This table is a code inspection map, not a claim of end-to-end Production readiness.

## 5. Contract-first future acceptance tests (NOT executable until decisions are approved)

- Given a known reasoning-foundation identifier (including case/whitespace variations), label creation, new training, cohort eligibility, offline fitting, artifact registration and independent benchmark admission reject it.
- Given an unknown rubric string, no code path claims that it is approved merely because it is not on the known-negative list.
- Given an explicitly approved complete immutable rubric version, newly created labels must link to that exact version, the accountable reviewer, the defined admissible evidence and required rationale; **the schema and admission semantics are not yet defined**.
- Given incomplete or conflicting evidence, behavior must follow the future approved abstention/labelability contract; there is no current numeric fallback.
- Given a revoked/replaced/version-mismatched rubric or a historical label, the system must follow the future approved temporal and legacy policy, without mutating historical rows.
- Given a TrainingRun and independent Evaluation, both must preserve the applicable version/identity and authorized lineage; any new policy check must not bypass independent partitions, immutable artifacts, actor isolation or replay checks.
- Given synthetic reviewer-education cases, never treat them as first-party Production model-training evidence.
- Given a successfully evaluated candidate, no automatic rollout, allocation weight change, eligibility determination or Production activation occurs.

## 6. Implementation sequencing after explicit product approval

1. **Business/Product:** record the missing numeric labeling semantics, evidence and abstention rules, approval authority and immutable version lifecycle in an *accepted* ADR and complete rubric specification.
2. **Technical:** design relational identities, reviewer evidence/rationale provenance, legacy handling, read/write and replay behavior; include a migration and compatibility review, not silent historical rewriting.
3. **Tests first:** cover newly approved versions, incomplete/withdrawn versions, known-negative foundations, unknown identifiers, stale/conflicting lineage, legacy labels and immutable audit.
4. **Backend:** introduce positive admission only as authorized by the accepted contract across label creation, automatic cohort planning, frozen Training Runs, artifact registration and independent Evaluation.
5. **Code Review / CI:** require full exact-head CI; leave PR Draft until explicitly authorized otherwise. Stage/QA/Release/Production are separate gates.

**Hard stop:** No machine-enforced *positive* approval, numeric-label algorithm, invented `approved=true` state, migration/relabel of historical data or runtime promotion may be implemented based on this DRAFT alone.
