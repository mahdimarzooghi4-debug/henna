# Henna external provider and funding-source evidence handoff — 002

**State:** DELIVERY CONTRACT / NOT CONNECTED / NOT RELEASE APPROVAL.
**Tracking:** #167 external dependencies, #168 internal completion. Baseline reviewed: main `4c0c834897770c423bd028319b015500e5dc7f80`.
**Scope:** Web, Android, server adapters and verified external systems. iOS Native is excluded.

## Purpose and ownership

This document makes the six external handoffs independently testable. It does not
choose a provider, create credentials, pretend that a ready UI is an integration,
or invent a bank/PSP API. An identified provider and its signed, approved technical
contract are prerequisites for implementation.

- Product owner / authorized contracting party: supplies provider identity,
  executed agreement, supported environment, operations and legal data-use basis.
- Provider technical contact: supplies versioned specifications, sandbox or
  preproduction access, authentication/signature documentation, error catalog,
  timeout, replay, retry, idempotency, webhooks/callbacks and support path.
- Henna engineering: maps the actual provider contract into existing fail-closed
  adapters, isolates credentials, produces contract tests and operational logs.
- Independent Finance Manager and banking/reconciliation authority: provide
  **separate** documentary and independent bank evidence for funding sources.
- QA and release owner: witness live-provider or sandbox tests, archive redacted
  evidence and approve the release gate separately.

No arbitrary timeout, retry cadence, policy threshold, callback URL, sender ID,
merchant ID, banking identifier, or privileged role is defined in this document.

## Mandatory delivery envelope — each external provider

A handoff is **incomplete** until the following evidence is available:

1. Vendor name/legal counterparty, contract approval, named technical owner and
   authorized personal/financial data purpose (or explicit not applicable).
2. API/service specification with version and environment; exact required and
   optional fields, known errors, states, timeout and rate-limit policies from
   the provider; real provider endpoints supplied securely, not inserted here.
3. Authentication and secret rotation mechanism, secure server-side secret
   provisioning, IP/network/TLS requirements, audit/log redaction and deletion
   policies where relevant; no browser/mobile secret exposure.
4. Request/callback correlation, authentication/signature validation, replay
   window and duplicate-event handling; documented safe behavior when the
   provider fails, delays or responds ambiguously.
5. Versioned adapter mapping + mocked contract tests **and** witnessed provider
   sandbox/live verification, including negative, duplicate, delayed and
   out-of-order responses. Mocks alone never establish real connectivity.
6. Observability/runbook evidence, rollback/recovery and operator escalation;
   authorized sign-off and exact environment evidence with timestamps and
   redacted identifiers.

## Workstream acceptance contracts

### A — OTP SMS (IOtpSmsSender)

**Provider must deliver:** approved sender/service identity; send API; provider
message correlation and acceptance/rejection rules; real-device delivery
verification evidence; provider-defined rate handling and retry policy.

**Henna acceptance:** existing OTP challenge remains server-authoritative;
send acceptance is never equivalent to phone delivery or OTP verification.
Expired, already used, replayed, wrong or rate-limited challenges fail safely.
Unknown delivery status is unknown, never "delivered" by default.
Evidence: contract tests + witnessed Android/real-device send and failure cases.

### B — seller natural-person identity (ISellerNaturalIdentityVerifier)

**Provider must deliver:** authorized identity matching source, explicit lawful
basis and consent requirements, supported national-ID/phone verification
operation, result semantics including no-match/unavailable/ambiguous/expired,
and permitted storage/retention requirements.

**Henna acceptance:** never infer identity match from phone possession,
format validation or entered name. Seller activation remains blocked on
unverified/ambiguous results. Verify secure audit without leaking sensitive
identity payloads. Tests cover mismatch, unknown, replay and revocation.

### C — PSP/real payment (IExternalPaymentProvider)

**Provider must deliver:** executed acquiring agreement, merchant/environment
identity via secure channel, exact payment initiation/status API, authoritative
settlement/confirmation mechanism, signed callback rules, reconciliation
reports, dispute/refund/cancellation handling and provider-defined retry policy.

**Henna acceptance:** a payment request, redirect or callback reception alone
does not mark PAID. Authenticate and deduplicate callbacks; reconcile amount,
currency, order reference and actual provider transaction; preserve pending
state on timeout/unknown. Test duplicate/out-of-order notifications, partial
and full refund, mismatched amount, replay and crash/retry recovery. No real
cash transfer is assumed from existing internal wallet/order demonstrations.

### D — IBAN ownership (IExternalIbanOwnershipVerifier)

**Provider must deliver:** authorized account-owner verification source,
subject identity requirements, supported IBAN matching operation, match,
mismatch, pending/unavailable/revoked semantics and privacy/consent terms.

**Henna acceptance:** valid IBAN syntax and bank name do not prove owner.
Block bank withdrawal while pending/unknown/mismatch, preserve audit and
support independent reassessment on provider correction. No inferred
bank-transfer success.

### E — external logistics (IExternalLogisticsProvider)

**Provider must deliver:** service area and eligibility contract,
dispatch/order mapping, supported status taxonomy, tracking/confirmation,
exceptions, cancellation and reverse flow, authenticated provider events and
vendor-controlled operational responsibilities.

**Henna acceptance:** no invented fleet/courier routing. Missing service
coverage or unknown provider status fails safely, existing PICKUP flow remains
distinct, delivery/receipt is not confirmed on dispatch request alone.
Test deduplication, unavailable service, handoff loss, return and delayed
confirmation against provider sandbox/live evidence.

### F — real funding source: independent dual evidence (separate finance gate)

This gate is **not** one of the five integration readiness booleans.

- **Approval 1 — authorized Finance Manager:** independently signed and
  auditable approval of the *identified* source, program, permitted amount,
  currency and versioned source documentation. A text fundingReference or
  administrative CREATE_PROGRAM request is not documentary proof.
- **Approval 2 — external bank reconciliation:** independently verified
  cleared bank transaction and reconciled statement/event for that same
  source/program and amount, with bank reference/provenance, verified time,
  integrity protection and duplicate-use prevention. The bank verifier and
  evidence must be independently attributable; an internal ledger movement
  is not a substitute for bank proof.
- **Acceptance:** link both immutable evidence records to the same identified
  source and program; reject disagreement, stale/revoked approval, pending
  settlement, amount mismatch, missing evidence, repeated funding receipt,
  cross-program or cross-tenant application. Never treat a provider timeout as
  approval. Persist actor, timing, evidence digest, reconciliation outcome
  and explicit human decision with auditable corrections.
- **Production guard:** real grant allocation or checkout funded by this
  source must not proceed unless both proofs pass the approved internal gate.
  A historical program/credit or `APPROVED_SOURCE` journal entry cannot
  retroactively become bank-verified by virtue of its name.

**Known code gap:** Commerce `CREATE_PROGRAM` currently accepts
`fundingReference` and posts an internal `APPROVED_SOURCE` transfer without
an external clearing/bank proof. That mechanism is **not** real-money
readiness. Detailed schema, authorized approver identity and bank integration
must be explicitly approved before implementing the gate; do not invent them.

## Exit criteria and release separation

| Gate | Evidence required | Present status |
| --- | --- | --- |
| Five provider identities and signed API contracts | Contracting owner + versioned technical handoff | UNVERIFIED |
| Five production-capable implementations | Authenticated adapters, negative contract tests, secure secrets | UNVERIFIED |
| Provider sandbox/live E2E | Hosted run identifiers and redacted results for each service | UNVERIFIED |
| Source-funding documentary approval | Authorized Finance Manager, exact source/program/amount, digest | UNVERIFIED |
| Independent bank reconciliation | Confirmed bank transaction matched to same source and amount | UNVERIFIED |
| Real-money internal enforcement | Verified immutable source gate before allocation/checkout | NOT IMPLEMENTED |
| Stage / QA / Release approval | Separate explicit authorization and acceptance evidence | NOT AUTHORIZED |

Existing `/admin/integrations` only reports registered adapter readiness.
It is not proof of real integration, verified funding, successful settlement,
or permission to deploy. PRs stay Draft/Open; no Stage, QA Gate, Recovery,
Release or Production execution is authorized by this document.
