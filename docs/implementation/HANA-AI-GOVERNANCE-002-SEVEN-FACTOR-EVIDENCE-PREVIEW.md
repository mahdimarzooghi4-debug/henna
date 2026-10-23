# AI Governance 002 — Seven-factor evidence preview (Draft)

**Date:** 2026-10-23
**Branch:** `feat/admin-ai-seven-factor-evidence-preview` stacked on Draft PR #166 (`feat/admin-ai-workspace-ux`). Neither branch is approved for merge or Production.

## Business and technical boundary

The current operational six-factor allocation, approved historical journals, settlement and wallets remain untouched. XGBoost v1 remains an in-process, offline/shadow training and evaluation artifact; the official InterpretML EBM remains an independent offline challenger. The existing `/admin/allocation-model-comparison` page compares evidence bound to the same Evaluation fingerprint and explicitly surfaces lineage mismatch; it does not rank or automatically select a model.

An authorized ADMIN may inspect *persisted* seven-factor human review identifiers via:
- `GET /api/v1/admin/allocation-proposals/research/seven-factor/review-inventory?page=1`
- `POST /api/v1/admin/allocation-proposals/research/seven-factor/review-inventory/preview` with `{"reviewIds":["<review UUID>"],"cutoffUtc":"2026-10-09T12:00:00.000Z"}`, no mutation.

Both routes inherit the existing session-token/ADMIN/HTTPS/no-store endpoint group filter. GET returns a bounded page of ID, time, v1.1 version and whether a qualitative review is recorded; **not** household identities, names, raw features, amounts or evidence reference text. A qualitative review's presence is neither proof of authenticity nor a positive label. A missing record or a conflicting/stale/non-first-party exact selection fails closed in `AllocationSevenFactorReviewInventoryService`. POST computes the existing canonical SHA-256 lineage manifest for the explicit selection. Result contains source formula/dataset/instruction identity, cutoff, count and digest plus `REVIEW_ONLY_NUMERIC_RUBRIC_REQUIRED`, `admitted=false`, `active=false`, `runtimeApplied=false`. It does not save a DatasetVersion or invoke an AI model.

The authenticated Next.js BFF checks cookie/token shape, same-origin for the POST, bounds review UUIDs, rejects duplicate IDs, limits response bytes, validates every non-admission flag and never exposes bearer tokens to the browser. The Web route `/admin/allocation-ai/evidence` shows actual verified-transport *read-only inventory data*, allows an explicit review selection and UTC cutoff, and displays the signed-by-content SHA-256 inventory digest. A successful preview proves internal provenance consistency according to current service validation, **not** independent authenticity of each external evidence document.

## Tests and review

- API integration: unauthenticated = 401, non-admin = 403, bad selection = 400, response has no-store and non-admission flags.
- Existing PostgreSQL inventory-service tests cover canonical digest, ordering, first-party runtime lineage and duplicate/conflicting review rejection.
- Node parser tests reject forged `admitted/active/runtimeApplied`, wrong versions, bad digests and duplicate IDs.
- Real Chromium test covers the responsive view, explicit user action, no-store authorization boundary via BFF 401 and cross-origin POST rejection; browser fixtures are tests only.
- Current CI also includes unrelated Expo SDK version compatibility; a manifest alignment to the versions requested by `expo install --check` is present in this Draft PR. **Exact-head full CI must succeed; packaging lockfile should be regenerated and reviewed if npm package resolution changed.**

## Important remaining blockers

1. The complete immutable approved **positive** numeric rubric and dataset admission contract does not exist. ADR-065/066 approve the human severity scale and qualitative anchors, not dataset admission.
2. External evidence source authentication, correction/withdrawal/dispute governance, time-separated disjoint Training/Validation/Evaluation acceptance, fairness and missingness rules remain unapproved/incomplete.
3. No seven-factor XGBoost training, independent quality PASS or production model runtime is authorized by this preview.
4. No generic admin-registered Model Registry/family adapter is created. Compatible version registration, provenance, evaluation, human promotion and rollback need a separate backend contract and security review; XGBoost selection in ADR-058 is **not** activation.
5. No real provider, Stage, Production or iOS-native scope. No model or geographic coefficient promotion from a successful digest.
6. Figma synchronization still needs tool availability; do not claim a matching approved Figma frame.

**Delivery gates:** Business → Technical → Backlog → Sprint → Code → Code Review → Stage (only after explicit authorization) → QA → Release Approval → Production → Monitoring → Improvement.
