# HANA — Internal Delivery Track (2026-10-09)

**Status:** Current-head reviewed backlog and questions; NOT release authorization.
**Scope:** Work owned by Henna's repository/engineering. External providers are separate.
**Baseline:** PR #165, commit `38f5ad236439a1e6535effac5fc0a96acab8ba52`.
**Policy:** Business → Technical → Product Backlog → Sprint → Code → Code Review → Stage → QA/Testing → Release Approval → Production → Monitoring → Improvement.

## 1. Implemented; do not rebuild

| Capability | Grounded implementation | Boundary |
| --- | --- | --- |
| Six initial household coefficients | `NeedsBasedAllocationV1.cs`, `AllocationWeightProfile` | Versioned baseline |
| MPI urban/rural and provincial capital adjustment | `NeedsBasedAllocationV1.CalculateGeographicFactor` | Authoritative geographic inputs separately required |
| Pool allocation with exact `floor(pool × H_iG_i / Σ(H_jG_j))` | `CommerceService.Allocate` | Existing operational code, not a new AI formula |
| Versioned coefficient promotion, rollback and historical lineage | `AllocationRuntimePromotionService`, Commerce journal | Only explicit human-authorized transitions |
| First-party allocation snapshots and usage telemetry | `HennaAllocationLearningCapture`, `HennaAllocationOutcomeCapture` | Usage is not a need label |
| Experimental six-weight proposal learner | `ExperimentalAllocationWeightLearner`, Training Workflow | Human label semantics still incomplete |
| Henna-owned XGBoost shadow, EBM challenger, independent evaluation | ADR-053–059 and `HennaXGBoostRuntimeContract` | XGBoost is Production-track family, NOT active Production or coefficient converter |
| Product QA/security, web/Android and DB integration | Existing CI, PR #165 review history | CI is not Stage or Release Approval |

Historical backlog PR #130 predates much of current PR #165 Commerce development; do not count its old missing-code statements as current deficiencies. Open PR #141 separately proposes owner/renter housing as a seventh factor, changing baseline coefficients; do not merge or infer its approval. Draft PRs #160/#161 are distinct address/checkout design previews and do not justify invented payments.

## 2. Internally executable now, without a new product decision

1. Regression tests protecting promoted coefficient calculation against distinct geographic factors and ensuring the real `ΣH_iG_i` Commerce flow, floor rounding, explicit remainder and exact runtime lineage remain intact.
2. Preserve Evaluation/Training separation, exact first-party lineage, authorization and append-only histories throughout existing Training, benchmark, Proposal and runtime-boundary tests.
3. Reconcile open stacked PRs against current HEAD before any integration work, especially outdated duplicate scope; perform Code Review and exact-head CI but never merge without explicit direction.
4. Ensure UI distinguishes observed data, reviewed labels, offline/evaluation evidence, proposed weights and activated version; no false Production/readiness claims.
5. Prepare existing catalog/geography import security, migrations, backup and runbooks for authorized Stage, without pretending that real signed-off data or external services exist.

## 3. Internal decisions that MUST be answered before new implementation

1. **Reviewed Need Label [0,1]**: exactly which independently evidenced aspects of unmet need define the numeric target, and what review/rationale/abstention contract applies? Existing `HENNA-AJF-v1` and `HENNA-ARR-v1` are reasoning foundations only. See `docs/product/HANA-POSITIVE-RUBRIC-ADMISSION-CONTRACT-DRAFT.md`.
2. **XGBoost → coefficients**: what governed objective/method is permitted to transform independent model evidence into a *six-weight* profile while retaining existing budget distribution? A raw need score is not automatically a weight. No algorithm or numeric threshold may be invented.
3. **Geography learning**: may MPI normalization/capital adjustment parameters themselves change through AI proposals, or must geography remain a fixed, approved separate input? Current six-weight model holds geography fixed.
4. **Housing factor**: should owner/renter become a seventh factor as proposed in unmerged PR #141, or should the existing six-factor formula stay canonical?
5. **Authoritative funding acceptance**: what human/business evidence authorizes actual receipt of each funding source and its allowed allocation mode? A text funding reference alone cannot establish received money.
6. **Checkout policy**: what is the consent/requote behavior for expired quotes and revised availability? Customer remains in control of unavailable items. Payment-reservation duration depends on real PSP contract.
7. **Model adequacy**: representative/time-separated cohorts, fairness groups and criteria, missing-feature meaning, benchmark acceptance and any Production thresholds remain separate decisions, not implicit code defaults.

Until accepted decisions exist, no positive rubric registry, geography learning, housing-factor revision, model-to-weight algorithm or automatic Production promotion is authorized.

## 4. External deliverables are NOT internal backlog blockers for unrelated slices

Separate provider handoff: real OTP/SMS, seller legal-identity verification, PSP and reconciliation, verified IBAN ownership, independent logistics. See `docs/implementation/HANA-EXTERNAL-INTEGRATIONS-001.md`. Also genuine reviewed data sources, Stage/Production credentials and hosting cannot be fabricated. Figma Admin Logistics remains design-deferred. iOS Native is out of scope.

## 5. Evidence in this slice

The real Commerce PostgreSQL integration test now runs a promoted six-weight profile using unequal geographic multipliers (.8, 1.2), checks the live pool-share equation, integer-rial floor results and unallocated remainder, and preserves its runtime version/proposal/sequence assertions. All test data is synthetic CI input, not Production funding or evidence of model accuracy.

**Gate:** full CI success for the exact new HEAD is required before recording Code Review completion. PR #165 must stay Draft/Open/Unmerged. No Stage, QA Gate, Release, Production, or Recovery permitted without explicit user instruction.
