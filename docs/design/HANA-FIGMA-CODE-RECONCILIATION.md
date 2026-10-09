# Henna Figma ↔ Code Design Status Manifest

**Date:** 2026-10-07  
**Figma file:** `uREafnhmH5dDRwPraBOmuk` (`henna-platform`)  
**Repository:** `mahdimarzooghi4-debug/henna`  
**Branch at reconciliation:** `feat/allocation-learning-foundation`

## Purpose

This file is the canonical reconciliation record between implemented Henna UI surfaces and their
Figma node references.

Figma is a design reference. Runtime/product data never comes from Figma.

A Figma frame name such as `DRAFT / NOT APPROVED` is not authoritative once an explicit later
owner approval exists in the repository decision/implementation record. Conversely, implementation
must not treat an unapproved Figma proposal as approved merely because code exists.

## Approved implementation references

### Existing foundational approved frames

| Surface | Figma node | Status |
|---|---:|---|
| Web authentication | `160:40` | APPROVED |
| Consumer app authentication | `160:58` | APPROVED |
| Seller registration — step 1 | `160:77` | APPROVED |

`160:111` is explicitly **OUT OF SCOPE** for the consumer app and must not be promoted.

### Buyer browse

Frontend 015 records explicit owner approval of all four original Frontend 010 proposals.

| Surface | Figma node | Repository authority | Canonical status |
|---|---:|---|---|
| Buyer browse desktop — empty | `476:3` | `HANA-FRONTEND-015.md` | APPROVED |
| Buyer browse mobile — empty | `476:4` | `HANA-FRONTEND-015.md` / `016` | APPROVED |
| Buyer browse desktop — data-backed | `478:2` | `HANA-FRONTEND-015.md` | APPROVED |
| Buyer browse mobile — data-backed | `478:22` | `HANA-FRONTEND-015.md` / `016` | APPROVED |

The current Figma canvas still carries historical `DRAFT / NOT APPROVED` frame/badge labels for
these four nodes. Those labels are stale and should be reconciled in Figma without changing the
layout or product contract.

Target Figma frame names:

- `476:3` → `APPROVED • Buyer browse / desktop • empty`
- `476:4` → `APPROVED • Buyer browse / mobile • empty`
- `478:2` → `APPROVED • Buyer browse / desktop • data-backed`
- `478:22` → `APPROVED • Buyer browse / mobile • data-backed`

Any descendant text whose only purpose is the historical `DRAFT / NOT APPROVED` marker should
be changed to `APPROVED`. Product copy, controls, spacing and data placeholders must not otherwise
change.

### Buyer product detail

Frontend 018 records the owner's explicit statement **«بله تایید میکنم»** for all six Frontend 017
detail-state frames.

| Surface | Figma node | Repository authority | Canonical status |
|---|---:|---|---|
| Published detail — desktop | `480:2` | `HANA-FRONTEND-018.md` | APPROVED |
| Published detail — mobile | `480:3` | `HANA-FRONTEND-018.md` | APPROVED |
| Confirmed 404 — desktop | `480:4` | `HANA-FRONTEND-018.md` | APPROVED |
| Confirmed 404 — mobile | `480:5` | `HANA-FRONTEND-018.md` | APPROVED |
| Unavailable/error — desktop | `480:6` | `HANA-FRONTEND-018.md` | APPROVED |
| Unavailable/error — mobile | `480:7` | `HANA-FRONTEND-018.md` | APPROVED |

Historical `DRAFT / NOT APPROVED` labels on these nodes should be removed/relabelled in Figma
without changing their approved visual contract.

Target Figma frame names:

- `480:2` → `APPROVED • Buyer product detail / desktop • published`
- `480:3` → `APPROVED • Buyer product detail / mobile • published`
- `480:4` → `APPROVED • Buyer product detail / desktop • 404`
- `480:5` → `APPROVED • Buyer product detail / mobile • 404`
- `480:6` → `APPROVED • Buyer product detail / desktop • unavailable`
- `480:7` → `APPROVED • Buyer product detail / mobile • unavailable`

## AI Admin Workspace — code-first draft (2026-10-09)

The proposed Admin `/admin/allocation-ai` workspace is a **DRAFT UX**, not an approved Figma screen. It is traceable to `docs/design/HANA-ADMIN-AI-WORKSPACE-DRAFT.md` and the real Playwright allocation-browser test; no Figma node was invented or marked APPROVED. The existing Figma Starter-plan tool-call limit still prevents fetching the needed Admin page detail and creating an approved node. Approved buyer/auth nodes above and all out-of-scope/Draft nodes below remain unchanged. The proposed workspace differentiates the existing six-feature experimental pages from seven-feature v1.1 backend-only research, with no fictional model activation state or result. The visual design must be reviewed in Figma and assigned an immutable Figma node before claiming fidelity.

## Frames that must remain Draft / Not Approved

The following are not authorized by the approvals above and must not be silently promoted:

| Surface | Figma node | Required status |
|---|---:|---|
| Consumer-app seller registration | `160:111` | OUT OF SCOPE |
| Seller onboarding step 2 desktop | `487:2` | DRAFT / NOT APPROVED |
| Seller onboarding step 2 responsive web | `488:3` | DRAFT / NOT APPROVED |
| Buyer reference cart desktop | `715:8` | DRAFT / NOT APPROVED |
| Buyer reference cart mobile | `715:35` | DRAFT / NOT APPROVED |
| Buyer offer comparison desktop | `723:2` | DRAFT / NOT APPROVED |
| Buyer offer comparison mobile | `723:34` | DRAFT / NOT APPROVED |

Admin Logistics also remains design-deferred under ADR-046 until an approved UI and real external
logistics integration contract exist.

## Code connection rule

Henna currently uses explicit Figma node references in implementation documents, code comments and
browser/mobile tests. There is no repository-level Figma Code Connect configuration, and the
screen-level frames above are not treated as runtime dependencies.

For screen implementation, the required traceability is:

`approved product decision → immutable Figma node id → implementation doc → shipping route/component → test`

Do not infer approval from:

- frame proximity;
- shared styles;
- existence of code;
- old mock/sample values;
- a historical DRAFT proposal;
- a Figma frame name alone.

## User-supplied node for AI design inspection

The owner provided node `181:2` in `uREafnhmH5dDRwPraBOmuk`:
https://www.figma.com/design/uREafnhmH5dDRwPraBOmuk/henna-platform?node-id=181-2&p=f&t=zTI08I3Zi2E2cb2T-0

This is an **inspection target, not an approved visual implementation reference**.
As of 2026-10-09, the attempt to retrieve its design context was blocked by
the Figma MCP Starter-plan tool-call limit. Its node type, screen content,
approval status and fidelity to `/admin/allocation-ai` have **not** been
verified. Do not silently promote or modify it; see
`docs/design/HANA-ADMIN-AI-WORKSPACE-DRAFT.md` for the follow-up.

## Current synchronization blocker

During this reconciliation attempt, the connected Figma MCP returned the Starter-plan tool-call
limit before write access could be used. Therefore the repository status is reconciled and
authoritative, but the stale Figma canvas labels listed above still require the exact renames in
this document once Figma write access is available again.

No Stage, merge, Release or Production authorization is implied by this design-status reconciliation.
