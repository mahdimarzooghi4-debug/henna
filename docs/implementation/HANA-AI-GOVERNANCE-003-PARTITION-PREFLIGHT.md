# AI Governance 003 — Human-selected three-way partition preflight (DRAFT)

**Status:** Code and tests in stacked Draft branch; no merge, Stage, release or Production authorization.
**Predecessors:** `feat/admin-ai-workspace-ux` (PR #166) → `feat/admin-ai-seven-factor-evidence-preview` (PR #170) → this branch.

## Scope

Existing backend `AllocationSevenFactorPartitionPreflightService.PreviewAsync` is exposed only through ADMIN-authenticated, read-only control plane. Explicit human severity review IDs (not arbitrary source- or household IDs) are collected into **three disjoint partitions**: Training, Validation and independent Evaluation. All three must be nonempty; the backend never invents a split, threshold, model score or acceptance outcome.

- `GET /api/v1/admin/allocation-proposals/research/seven-factor/human-reviews?page=1` lists at most 20 persisted human severity review IDs, their linked seven-feature review ID, review time, evidence-disposition and approved scale/criteria version. No household identifiers, evidence text, PII, need scores, assessment feature values or model values are returned.
- `POST /api/v1/admin/allocation-proposals/research/seven-factor/partition-preflight/preview` accepts three explicit review-ID lists and nonfuture UTC cutoff; this is a **nonmutating query** despite POST because it requires a bounded explicit structured selection. It returns only source formula/dataset/instruction version lineage, three counts, SHA-256 fingerprint and the fixed `NOT_ADMITTED_COMPLETE_RUBRIC_AND_EVALUATION_GOVERNANCE_REQUIRED` status.
- `/admin/allocation-ai/partitions` is a responsive Persian RTL workflow for HUMAN partition assignment; it does not automatically select, label, deduplicate or split cohorts.
- The cookie-secure BFF enforces no-store, browser same-origin on POST, server authorization through the real API, unique UUIDs across all partitions, request-size bounds and exact non-admission response flags; a forged `admitted=true`, `active=true`, `runtimeApplied=true` or fake SHA-256 is rejected.

## Existing PostgreSQL reconciliation guarantees

The underlying tested service uses REPEATABLE READ, checks first-party assessment and runtime lineage, checks all selected and competing household review universe, refuses household overlap across partitions (including other snapshots), refuses missing/abstained/conflicting/outdated judgments and mismatched v1/v1.1 source identities, and hashes exact review selection and evidence provenance. It cannot produce a DatasetVersion, Learning Label, artifact, Model Candidate, quality PASS, allocation command or Runtime Promotion.

A successful structural preflight is **not** proof of independent document authenticity, data sufficiency, unbiased labels, adequate demographic coverage, fair results, validated temporal training/evaluation strategy or an approved complete numeric rubric.

## Tests

- API integration: anonymous 401, non-ADMIN 403, zero-page 400, no-store/non-admission flags, empty independent Evaluation 400 and overlapping partition IDs 400.
- Node parser/contract tests: three nonempty partition lists, no duplicate IDs, nonfuture UTC cutoff, rejection of fake approval flags, incorrect counts/digests, unsupported qualitative disposition.
- Real Chromium test: ADMIN workflow navigates human-review IDs, explicitly allocates exactly three groups, receives read-only digest from mock transport fixtures, verifies same-origin block and narrow-screen layout.
- No changes to Android/iOS, wallets, Commerce formulas, real-money integrations, XGBoost/EBM inference, automatic cohort policy or Production.

## Gates not approved

Authentic independently reviewed source evidence and complete positive admission rubric, review correction/withdrawal governance, explicit policy for demographic/temporal independence, fairness and model acceptance, and final explicit human approval are still required. The five-level scale and seven initial coefficients are approved only within their documented narrow scopes. Production model selection cannot be inferred from this structural manifest.

**Full parent process:** Business → Technical → Backlog → Sprint → Code → Code Review → Stage (explicitly approved only) → QA → Release Approval → Production → Monitoring → Improvement.
