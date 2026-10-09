# ADR-062 — Improve the Existing Henna Allocation Formula through Governed Coefficient Learning

**Status:** Accepted product objective; not an authorization of an unapproved numeric-label rubric, model-to-weight algorithm or Production promotion.
**Date:** 2026-10-09
**Scope:** Henna Allocation Learning / PR #165
**References:** `docs/product-rules/HANA-NEEDS-BASED-ALLOCATION-v1.md`, `docs/implementation/HANA-CREDIT-ALLOCATION-001.md`, ADR-048, ADR-058–061.

## Product decision

The purpose of Henna-owned Allocation AI is to **improve coefficients of the existing, operational, versioned needs-based allocation formula as real first-party Henna data and governed human-reviewed evidence accumulate**. The model must not replace the funding instruction, create a parallel benefit-allocation formula, or autonomously change an effective runtime profile.

In a source-authorized `POOL_NEEDS` allocation, the existing budget split is:

```text
householdFactor_i = 1 + 0.5 × Σ(sixWeight_k × score_ik) / 3
relativeWeight_i = householdFactor_i × geographicFactor_i
allocation_i = floor(poolRial × relativeWeight_i / Σ(relativeWeight_j))
```

Any remainder from floor-to-rial allocation remains unallocated. The approved other funding instructions — equal grants and independently capped per-household base amounts — **are not replaced** by pool redistribution. Source authority, household and geographic input provenance, budget limits and eligibility are independent requirements.

The six baseline weights (health .30, hardship .25, age/dependency .18, household size .12, care/support .10, education .05) sum to 1 and are a versioned starting point for coefficient improvement, not a permanent assertion about true relative need.

`geographicFactor` is a distinct multiplier obtained from approved urban/rural provincial MPI and provincial-capital adjustment. Its current values and input-data lineage remain governed by the existing geography policy. **Current experimental coefficient learning learns the six household weights only and holds the geographic factor constant during comparisons.** Whether or how geography parameters may be learned in the future requires a separate explicit Product/Data contract; no geography-learning targets or coefficients are invented here.

## What is implemented versus undecided

- **Implemented:** `CommerceService.Allocate` reads the effective `AllocationWeightProfile` and distributes the fixed pool using `H_i G_i / Σ(H_j G_j)`, with floor-to-rial rounding and recorded formula/runtime lineage.
- **Implemented:** Real first-party `ALLOCATE_CREDIT` journal snapshots enter the local Henna learning store through controlled capture; usage observations are telemetry, not a need label.
- **Implemented:** The bounded `ExperimentalAllocationWeightLearner` fits and proposes six-weight candidates against eligible, independently human-reviewed 0–1 labels. Its thresholds/step sizes are experimental engineering choices, not Production approval criteria.
- **Implemented:** XGBoost is the selected Production-track family but remains a local offline/shadow raw-need predictor; independent evaluation and EBM challenge evidence are separate. **XGBoost predictions are not currently an approved method of converting scores into coefficient proposals.**
- **Implemented:** A candidate coefficient profile can be simulated against the original pool formula. Human review, Pilot, explicit activation authorization, separate runtime promotion and rollback already preserve historical grants.
- **Unresolved:** An approved complete numeric-label rubric and positive rubric admission; valid evidence-to-target semantics; an evidence-backed contract connecting XGBoost findings to proposed coefficient changes; temporal stability, fairness, missing-value and Production acceptance rules. No such algorithm or threshold is created by this ADR.

## Guardrails

1. Operational numbers continue to be captured regardless of whether an approved numeric need-label rubric exists; do not falsely call spending, outcomes, usage or current formula results ground truth.
2. Training, Validation and independent Evaluation remain disjoint by household and exact frozen lineage. Evaluation rows must not influence fitting, candidate identity or admission.
3. Known reasoning-framework versions `HENNA-AJF-v1` and `HENNA-ARR-v1` are not complete numeric-label rubrics and are rejected even at direct Domain learner/evaluation boundaries.
4. A learned six-weight candidate must pass the same deterministic existing `Σ H_iG_i` formula, keeping geographic inputs and funding source instructions fixed unless a separately approved policy changes them.
5. AI may propose improvements and expose evidence, but never choose eligibility, money movement, wallet behavior, an automatic model winner or runtime activation. Human governance, versioning, provenance, audit and rollback stay intact.
6. No real beneficiary training result, approved rubric, activated XGBoost model, live Production rollout or benchmark pass is claimed here.

## Implementation slice attached to this ADR

- Centralize the known-negative rubric foundation check in Domain, retaining the existing Infrastructure facade.
- Reject independent Evaluation rows at the Domain coefficient-learner boundary even if a caller bypasses the workflow.
- Reject known non-labeling foundation versions at both direct coefficient training and independent coefficient benchmark entry points.
- Add synthetic regression tests proving learned coefficient profiles feed the *existing* pool allocation formula with frozen geographic factors. Synthetic fixtures never become governed model data.

This ADR establishes product intent and safety invariants; **it does not approve missing numeric labeling or model-to-coefficient conversion contracts**.
