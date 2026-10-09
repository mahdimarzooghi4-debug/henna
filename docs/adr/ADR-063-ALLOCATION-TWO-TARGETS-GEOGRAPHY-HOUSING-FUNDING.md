# ADR-063 — Allocation: Two Independent Targets, Geography Proposals, Housing and Dual Funding Proof

**Status:** Accepted PRODUCT decisions by Product Owner on 2026-10-09. Numerical mappings, learning algorithms, verifier integrations and rollout remain UNAPPROVED.
**Scope:** Henna Allocation Learning, Geography, Household Need Scoring, Source Funding. PR #165 stays Draft/Open/Unmerged.
**Predecessors:** ADR-048, ADR-052, ADR-058–062; `docs/product-rules/HANA-NEEDS-BASED-ALLOCATION-v1.md`.

## Four product decisions (accepted)

**D1 — Two independent learning objectives.** Henna assesses (a) reviewed severity of household need and (b) separately observed/reviewed coverage of essential needs after allocation. They are **two distinct targets/evidence streams**, never one mechanically computed label. Need severity is not inferred from spending, initial formula, unused balance or a model prediction. Essential-needs coverage remains a nullable evidence-backed Outcome under ADR-052; it is NOT automatically a Reviewed Need Label. Both can inform future evaluation only through approved objective-specific contracts. Do not combine, subtract or weight them without another explicit decision. Observation remains unknown when not measured.

**D2 — Geography may be proposed for improvement by Henna AI.** In addition to the existing household coefficients, a separately reviewed research candidate may contain changes to the MPI-related geographic normalization bounds and provincial-capital adjustment. Candidate values must pin a geographic dataset version, real internal Training Run and independent Evaluation lineage. No learning algorithm, proposal limit, quality threshold, or approval authority for geographic promotion is chosen here; no change to existing baseline geography or formula may be activated by this ADR. Urban/rural provenance, MPI min/max and exact dataset versions remain mandatory. Geography proposals must not silently reuse a six-coefficient Profile `Version` as proof of geographic approval.

**D3 — Housing tenure becomes the seventh household-need dimension in the NEXT approved formula version.** Housing must distinguish `OWNER` and `TENANT` with attributable source evidence. A missing or unsupported value cannot become `OWNER` or a zero housing score. The proposed design in unmerged PR #141 includes housing weight 10%, owner score 0 and tenant score 2 (plus redistributed existing weights), but those numerical choices are **NOT approved by this decision** and cannot be silently imported. Define a separate seven-factor scoring and versioned coefficient contract; preserve historic six-factor snapshots and allocations exactly. A seven-factor experimental draft has no active Commerce or Runtime path until explicit scoring weights and migration policy are accepted.

**D4 — Real funding activation requires BOTH independent controls:** accountable approval by authorized Henna Finance Manager against documentary source evidence **and** actual external bank transaction reconciliation/confirmation for the same permitted source/program. Neither a text funding reference, a user's checkbox, a bank account number nor a matching amount alone is equivalent to authoritative confirmation. These controls are conjunctive, not alternatives. Until a trusted reconciler and auditable manager-approval persistence/role contract exist, mere references may be stored or planned but MUST NOT be interpreted as `VERIFIED` or as authorization for real money. Current `CREATE_PROGRAM` and `ALLOCATE_CREDIT` implementation does not provide the complete two-proof operational gate and cannot be claimed compliant for real-money Production. Do not invent a bank integration or change existing test doubles into real providers.

## Internal implementation admitted by this ADR

The first safe Domain-only contract slice introduces:
- Strongly separate target kinds and per-target evidence identity; no numeric mapping, dataset admission or model training happens here.
- Explicit, evidence-backed housing tenure type with missing/unknown fail-closed, without mapping tenure to a score.
- An explicitly versioned seven-coefficient *research draft* with all seven weights supplied and nonnegative/sum-to-one validation, but no new active profile, score mapping or Commerce change.
- An explicitly versioned, lineage-bearing *geography research draft* with positive ordered parameters; no geographic learning, promotion or automatic status change.
- A *pair of evidence references* for Finance Manager approval and bank reconciliation, with distinct identities and no reliance on either reference to prove authoritative verification.

These are inert Domain value contracts, not persistence, HTTP routes, data producers, funding approval authority, model proposals, payment, wallets, geographic status or runtime promotion. They may be exercised by synthetic unit tests; they do not fabricate Production evidence.

## Remaining explicit decisions and dependency order

1. Approve a complete versioned numeric Reviewed Need Severity rubric, evidence, reviewer authority, conflicts and abstention semantics; separately define how reviewed Essential Needs Coverage contributes to evaluation (if at all). ADR-061 foundation alone is insufficient.
2. Approve the seven-dimension weights and Owner/Tenant-to-score mapping, anti-double-counting of rent and hardship, exact formula/scoring `Version`, historical compatibility, UI and approved first-party source.
3. Approve how internal model findings yield **auditable seven-factor coefficient** and **separately versioned geographic** candidate values, plus independent Evaluation, temporal stability, fairness and missing-value governance. XGBoost predictions cannot be reinterpreted as coefficients without this contract.
4. Specify trusted Finance Manager approval authority and evidence receipt, external bank reconciling record/replay/actor/signature checks, matching to same program/source/instruction, and fail-closed transactional release-gate integration before real allocation.
5. Complete CI/Code Review, authorize Stage and run real integrations/QA. Production requires separate human release approval; no automatic AI, spending, wallet or bank actions.

**Preserved baseline:** `CommerceService.Allocate` continues to use the existing six-factor `H_i G_i / Σ(H_jG_j)` method and audited runtime versions until the full seven-factor business and technical contract is approved. No existing grant is recalculated.
