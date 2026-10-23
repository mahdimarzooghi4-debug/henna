# AI Governance 004 — Read-only research model artifact evidence (DRAFT)

**Predecessors:** PR #166 → PR #170 → PR #171 → this stacked Draft PR.
**Boundary:** An artifact inventory is **not** a production Model Registry; registration, adapter choice, admission and promotion are not enabled.

## Implemented
- ADMIN-authenticated `GET /api/v1/admin/allocation-proposals/research/model-artifacts?page=N` reads existing persisted XGBoost TrainingRun shadow artifacts and EBM research artifacts. It performs **SHA-256 re-hashing of stored bytes** on read, pages each family to ten rows, and correlates independently persisted Evaluation benchmark rows by the exact artifact SHA and model version. It exposes metadata only, never artifact bytes, household IDs, labels, evaluation individuals or source text.
- The existing authenticated same-site server session BFF validates the strict response contract, bounds its size, enforces no-store, and rejects any fabricated admitted, ready, registerable, approved or active state.
- Admin route `/admin/allocation-ai/models` shows both evidence families, artifact identity, version, training lineage, integrity state and count of matching independent Evaluation records. A matching digest means **byte integrity only**, not model quality, authenticity, approved fairness or successful Evaluation.
- This is research evidence from existing six-factor experimentation. The seven-factor pathway remains structurally preflight-only and not an approved Dataset.

## Deliberately omitted
No new model family, model adapter, repository schema/migration, new training job, model registration API, artifact upload, automatic evaluation, Dataset admission, threshold, ranking, Production candidate, Runtime wiring, wallet or Commerce modification. XGBoost and EBM remain offline/shadow. An actual Admin Model Registry (compatible-version registration, immutable approved metadata, human review and activation) still requires a separate approved technical/business contract and governed dataset policy.

## Verification
- C# unit coverage for stable SHA-256 byte integrity, tampering, missing bytes and invalid digests.
- Node contract coverage for strict non-admission status, malformed artifact metadata and duplicate rows.
- Existing full CI for Backend, Web, Mobile and Android Native Links remains required before review.
- PR remains Draft/Open and must not be merged or deployed without explicit owner approval.
