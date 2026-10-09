# ADR-064 — Approved Initial Seven-Factor Coefficients (HANA v1.1)

**Status:** Accepted numeric Product decision on 2026-10-09, with Domain-only implementation; runtime activation NOT approved.
**Supersedes:** The still-undecided initial housing weights and OWNER/TENANT scoring items of ADR-063, **not** its separate Production/funding/model governance.

## Approved starting profile

| Dimension | Initial coefficient |
| --- | ---: |
| Health | 0.30 |
| Economic hardship **excluding housing/rent** | 0.20 |
| Age and dependency | 0.15 |
| Household size | 0.10 |
| Care and support | 0.10 |
| Education | 0.05 |
| Housing tenure | 0.10 |
| **Total** | **1.00** |

Housing tenure is explicitly evidenced:
- `OWNER` → 0 of 3
- `TENANT` → 2 of 3
- missing/unknown/unsupported → **no score, fail closed**; never assume owner or zero.

Housing expense/rent **must not be counted again** in the hardship score. A separate, reviewable source reference for the non-housing hardship score is required by the new Domain assessment contract. That reference does not itself prove the underlying evidence is authentic; trusted first-party validation and schema are required before runtime.

## Version and unchanged math

```text
formulaVersion = HANA-NEEDS-BASED-ALLOCATION-v1.1
scoringVersion = HANA-HOUSEHOLD-NEED-SCORING-v1.1
weightedScore = .30*health + .20*nonHousingHardship + .15*age
              + .10*size + .10*care + .05*education
              + .10*housingTenureScore
H_i = 1 + 0.5*weightedScore/3
G_i = existing independently governed geographic factor
POOL_NEEDS allocation_i = floor(poolRial * H_i*G_i / Σ_j(H_j*G_j))
```

The existing single-household source funding modes remain source-governed and are not reinterpreted as a common pool. Floor remainder stays explicitly unallocated; the formula does not set payment/eligibility/settlement.

## Scope delivered

A separate `NeedsBasedAllocationV11` Domain calculator and review-only pool preview, full explicit scoring, exact snapshot-linked housing evidence, required non-housing hardship evidence reference, formula/scoring version identity, geography preservation, floor remainder and fail-closed tests. This is not a producer of actual grants, labels or payments. It does not overwrite the active six-factor `NeedsBasedAllocationV1`, existing `HouseholdNeedScores`, `AllocationWeightProfile`, historical `formulaVersion` or journal records. No database backfill, runtime promotion or automated training takes place.

## Deferred integration: hard gates, not optional code TODOs

Before an operational seven-factor profile can be admitted, require: approved first-party housing and reviewed non-housing hardship intake/provenance; versioned seven-factor persistence, DTOs and migration preserving prior immutable snapshots; explicit source-authority and bank/Finance Manager dual confirmation per ADR-063; tests ensuring v1 and v1.1 never mix in one TrainingRun/evaluation cohort; independent model evaluation, anti-bias and missing-value semantics; explicit human approval/Pilot/production authorization/runtime promotion. The XGBoost six-feature artifact cannot silently be treated as a seven-feature model. No provider integration, thresholds, scores for missing values or model-to-coefficient mapping may be invented.

PR #165 remains Draft/Open/Unmerged and Stage/QA/Production require separate user instruction.
