# AI Governance 009 — Exact two-family stored-source alignment (DRAFT)

Stack on PR #176; no merge/Stage/QA Gate/Release/Production.

This is a human-driven comparison of **one specific XGBoost shadow artifact/Evaluation** and **one specific EBM offline artifact/Evaluation**, not an algorithm choosing a model. An ADMIN calls the read-only `/api/v1/admin/allocation-proposals/research/cross-model-source-alignment/preview` with four explicit GUIDs. A single PostgreSQL REPEATABLE READ transaction revalidates both artifacts against stored SHA-256 bytes; reconstructs each historic independent Evaluation set from persisted human Reviewed Need Labels, assessments and first-party runtime lineage; rechecks both saved ADR-053 Evaluation fingerprints and metrics; then compares exact sorted Evaluation label IDs, sample count, baseline version, dataset version, funding source reference, runtime profile identity/sequence, cutoff and rubric.

If both independently reconstruct but are not aligned, return `REVERIFIED_STORED_EVALUATION_LINEAGE_MISMATCH` and `evaluationLineageAligned=false` — **do not** assert comparability. If all match, return `REVERIFIED_STORED_EVALUATION_LINEAGE_ALIGNED_ONLY`; this is not an assertion of scientific sufficiency. The identity digest covers model identifiers, hashes, key lineage and outcome, not a signature or authorization token.

No raw scores, features, labels, household IDs, reviewer IDs or artifact bytes leave the backend. No Model Registry row, Dataset admission, ranking, winner, automatic model-selection threshold, Pilot, runtime inference, Production promotion, payments or Commerce mutation. Historical source authenticity/consent, approved numeric label semantics, cohort representativeness, fairness, missingness criteria and any clinical/social causal claims remain outside this technical audit.

Full CI + actual PostgreSQL tests + Node/Web parser tests + Android native links required. iOS Native excluded; PR remains Draft/Open.
