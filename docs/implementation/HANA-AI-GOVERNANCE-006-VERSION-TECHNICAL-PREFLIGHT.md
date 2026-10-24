# AI Governance 006 — Explicit existing model-version technical preflight (DRAFT)

**Stack:** #166 → #170 → #171 → #172 → #173 → this Draft PR. No merge, Stage, QA Gate, Release or Production.

Admin explicitly selects **one persisted offline artifact plus one independent Evaluation record** from its exact, SHA-256-attested dossier. The controller already requires ADMIN authentication. The non-mutating POST `/api/v1/admin/allocation-proposals/research/model-version-technical-preflight/preview` re-attests one PostgreSQL REPEATABLE READ dossier, verifies that the **selected** Evaluation ID belongs to the artifact, and checks frozen model version/format/protocol against the existing Henna code contracts. The check confirms artifact-byte SHA-256 integrity and **stored Evaluation record linkage**, NOT independent re-attestation of the original evaluation set. There is no latest-wins evaluation selection, no model ranking or generic model provider.

- XGBoost: existing `henna-xgboost-runtime-contract-v1` for **raw in-process prediction only**. Its existence does not provide a Production/Commerce allocation mapping; reporting its exact technical contract match never enables runtime.
- EBM: existing offline research challenger only; no Production execution contract or Adapter. No inference endpoint.
- Any stale/fabricated/unsupported model family, evidence ID, format, protocol or digest **fails closed**; no missing evidence is inferred.
- The Admin BFF enforces session credentials, browser same-origin on POST, bounded exact-schema payload, no-store, verifies all non-admission flags and refuses forged Production compatibility. The UI reconciles the response to the exact user-selected artifact and evaluation and ignores stale async responses.

The response ALWAYS reports `productionRuntimeCompatible=false`, `registrationEnabled=false`, `datasetAdmitted=false`, `modelApproved=false`, `candidateCreated=false`, `runtimeApplied=false`. Artifact/evidence attestation is **technical identity only**; it does not prove independent Evaluation adequacy, fairness, temporal stability, source rights, real positive seven-factor labels, business policy sufficiency, a legal Production model, Pilot, or formal Human Release Approval.

This slice deliberately does **not** create a model registry table, write an artifact, register a compatible user-provided version, add an adapter, train a model or promote Production. Those are separate architecture/business contracts requiring explicit owner approval. No iOS Native/Commerce/payment changes.
