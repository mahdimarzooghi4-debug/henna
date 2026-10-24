# AI Governance 005 — Research model evidence dossier (DRAFT)

Predecessors: PR #166 → #170 → #171 → #172 → this stacked Draft PR.

This is NOT a model registry, registration, positive Dataset acceptance, or Production authorization. Read-only ADMIN endpoint `GET /api/v1/admin/allocation-proposals/research/model-artifacts/{family}/{id}/evidence` provides the exact persisted lineage for a selected, already-existing six-factor offline XGBoost/EBM research artifact. It re-attests stored bytes by SHA-256 and binds every stored independent Evaluation benchmark to the TrainingRun, model version, artifact SHA and dataset. All queries use the same PostgreSQL REPEATABLE READ snapshot. Any mismatch, invalid fingerprint, or over 100 linked records fails closed; the cap is structural, not statistical.

Responses expose only model version, format, artifact ID/digest, TrainingRun ID, persisted Evaluation ID/protocol/fingerprint/dataset/instruction/cutoff. No PII, label IDs, raw scores, artifact bytes, benchmark metrics, or model output are returned. Status is RESEARCH_EVIDENCE_ONLY_NOT_APPROVED with registered/approved/active/runtimeApplied all false. The EBM research-artifact registration in storage is distinct from a future approved Production Model Registry.

No family/adapter invented, no winner rule, training flow, admission, payments, Commerce, runtime, Pilot, promotion, iOS/Stage/Release/Production. Pending separate business/architecture approval: versioned registry acceptance, compatible adapter policy, document source verification, human correction/withdrawal, positive seven-factor Dataset rubric, fairness/temporal criteria and explicit model selection.
