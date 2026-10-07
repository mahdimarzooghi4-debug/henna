# PR #165 — Final Mutation / Security Code Review

**Date:** 2026-10-07  
**Branch:** `feat/allocation-learning-foundation`  
**Reviewed baseline before this record:** `82c8c1d003366188dc9fb7c2a6b15d6ea1b96117`  
**PR state:** Draft / Open / Unmerged

## Scope reviewed

The final high-risk review covered:

- Allocation proposal, review, training, automation, benchmark and model-evidence mutations.
- Pilot, production authorization, runtime promotion and rollback boundaries.
- Retention purge and reviewed outcome mutations.
- Browser/BFF same-origin, cookie-authenticated forwarding, allowlisted routes and no-store behavior.
- Buyer, seller, support and organization ownership/scoping in Commerce.
- Commerce command idempotency, PostgreSQL transaction serialization and settlement preparation.
- Allocation-learning append-only behavior and historical evidence replay semantics.
- External-integration fail-closed boundaries relevant to SMS, bank/payment and logistics.

This review did not authorize Stage, Production, merge, recovery, real SMS, bank/payment or logistics integration.

## Findings fixed

### 1. Training replay identity did not bind cutoff

**Risk:** Medium — the same training request identity could be replayed with a different UTC cutoff and be treated as the previous request.

**Invariant:** One durable training request identity must resolve to one exact requester, label set, pool and cutoff.

**Fix:** The cutoff is validated/canonicalized before replay lookup and stored `CutoffUtc` is checked by `SameTrainingRequest(...)`.

**Regression coverage:** Same request ID with a different cutoff now fails with `AllocationTrainingIdempotencyConflictException`.

### 2. Rollback authorization could observe stale runtime state

**Risk:** High — rollback authorization checked active runtime outside the serialization boundary shared by runtime promotion/rollback.

**Invariant:** Rollback authorization must be based on the active runtime observed while holding the same cross-replica mutation lock used by runtime transitions.

**Fix:** `AuthorizeRollbackAsync` now runs in a transaction, acquires `AllocationRuntimeMutationLock.Key`, then re-reads authorization/current-runtime state before appending the authorization event.

**Regression coverage:** A deterministic PostgreSQL race test blocks the advisory lock, changes the active runtime, releases the lock and verifies stale rollback authorization fails.

### 3. Benchmark concurrent replay did not re-validate actor-bound input

**Risk:** Medium — the unique-conflict replay path could return an already-created benchmark without re-running the same actor/input checks used by the normal replay path.

**Invariant:** A benchmark identity is replayable only for the exact actor and frozen benchmark input.

**Fix:** Profile, XGBoost and EBM benchmark services now use a shared per-service replay validation path after both normal lookup and PostgreSQL unique-conflict recovery.

**Regression coverage:** Each benchmark family verifies that a second ADMIN cannot replay another evaluator's benchmark identity.

## Confirmed controls

### Allocation / AI governance

- Training and benchmark paths remain evidence/control-plane only.
- XGBoost and EBM remain offline research/shadow challengers.
- Evaluation evidence does not select a winner or activate Production.
- Profile, XGBoost and EBM comparison remains read-only and lineage-aware.
- Human review, Pilot, Production authorization and runtime promotion remain separate gates.

### Concurrency and idempotency

- Allocation runtime mutation uses PostgreSQL transaction advisory locking.
- Commerce mutations are serialized across API replicas with a PostgreSQL transaction advisory lock.
- Commerce command replay is actor + command ID + canonical payload bound.
- Training deterministic request IDs remain used by automatic orchestration.
- Benchmark replay is actor-bound after race recovery.

### Browser/BFF security

Reviewed write-capable BFFs use the authenticated HttpOnly session cookie and do not expose bearer tokens to browser JavaScript. Mutation routes reviewed use same-origin checks, bounded/allowlisted route construction, no-store responses and upstream timeouts. Commerce/admin mutation gateways require explicit idempotency keys where their backend contracts require them.

No generic arbitrary upstream proxy was found in the reviewed mutation paths.

### Actor / tenant / ownership boundaries

Reviewed Commerce mutations enforce the relevant buyer, seller, support, finance/admin or organization membership boundary before consequential mutation. Seller return actions check the incident seller; buyer confirmation/cancellation paths check buyer ownership; evidence access is scoped to owner/support or the seller on the referenced incident.

No concrete cross-actor mutation bypass remained after review.

### Commerce financial safety

Refund and late-return penalty are intentionally separate settlement deductions under ADR-024/027/029. A negative computed seller net is not marked bank-transfer-ready; it is held as `FINANCE_REVIEW_REQUIRED`. Settlement preparation runs inside the global Commerce PostgreSQL mutation serialization boundary, preventing concurrent multi-replica creation races.

No bank transfer or payment completion is fabricated.

### Append-only research evidence

`HanaAllocationLearningDbContext` rejects tracked `Modified` or `Deleted` research entities. Training runs, reviews, pilot events, production-control events, runtime-profile events, benchmarks and EBM evidence remain append-only through normal application writes. The explicit privileged retention purge remains the narrow deletion exception for its approved research scope.

### External integrations

Real SMS delivery is not implemented and was not fabricated. Bank/payment/IBAN/logistics integrations remain fail-closed or pending where authoritative external integrations do not exist.

## QA evidence available at review time

Latest reviewed GitHub CI for `82c8c1d003366188dc9fb7c2a6b15d6ea1b96117` was Bootstrap checks Run #1347 / `37618102755`, fully successful across Backend, Web, Mobile and Android Native Links.

The Web CI successfully installed CI-only Chromium and ran the actual browser interaction suites, including buyer commerce, seller/support commerce, admin seller operations, allocation proposal review, authentication recovery and public catalog/product flows.

This does not change the separate Codex development-environment limitation where Chromium download was reported blocked.

## Remaining non-code / product blockers

The following must not be invented during code review:

- approved representative/time-separated cohort construction for temporal stability;
- approved fairness groups, metrics and acceptance criteria;
- approved missing-value semantics for the six allocation features;
- real SMS provider/integration;
- real payment/bank/IBAN ownership integration;
- real logistics integration.

## Review disposition

No additional concrete high-risk mutation/security defect remained in the reviewed scope after the fixes above.

PR #165 must remain Draft/Open/Unmerged until explicit product-owner instruction. This review does not authorize Stage, merge, Release, Production, recovery or external-provider activation.
