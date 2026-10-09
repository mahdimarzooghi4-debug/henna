# Henna AI UX — Admin versus Funding Supporter panel

**Status:** DRAFT UX / role-authorization contract pending. **Decision confirmed by Product Owner on 2026-10-09:** «حمایتگر» means a PERSON or ORGANIZATION that funds household-support programs, **not** an order-return support agent.

## Existing surfaces — do not conflate them

| Surface | Confirmed currently implemented role and purpose | AI access |
| --- | --- | --- |
| `/admin/allocation-ai` | Admin AI research/governance hub, proposed in Draft PR #166 | Links to existing admin-only research and comparison screens |
| `/support` | Order/incident customer-support operations | **Not** a financial supporter and **not** an AI workspace |
| `/organization` | Scoped manager-of-organizations portal, with real registered programs, funding and unallocated balances | **Not** verified as an independent funding-supporter authorization; do not reuse its session as donor role |

No current `SUPPORTER` identity, membership, authorization, funding-to-supporter relationship, or release contract for supporter-facing aggregate outcome statistics was verified in this repository inspection. Do not invent a backend role name, create a public donor API, or expose organization/household records as a shortcut.

## Two perspectives of the same AI evidence, with different rights

### Admin: full governed lifecycle, human authority

Data sourcing → reviewed need severity and distinct essential-needs coverage outcomes → evidence conflict reconciliation → versioned Dataset admission → offline Training and independent Evaluation → comparison of Profile / XGBoost Shadow / EBM → candidate, documented human review, Pilot → separately authorized Production promotion. The v1.1 seven-factor intake and new training admission remain incomplete; page links must not imply capabilities absent from the actual API.

### Funding Supporter: narrowly scoped, read-only impact transparency

Only after the identity/role and server-scoped funding ownership contract is approved, the eventual funding-supporter panel may expose:

- The funding-supporter's **own** eligible, verified program summaries, tied to actual documented funding/authorization and independent bank reconciliation; distinguish registered plans from verifiably funded programs.
- Aggregated, policy-permitted *observed* coverage of essential needs after allocation, independently reviewed and attributable to the program; differentiate observed outcome, missing/unknown data, and AI projection.
- A documented high-level explanation of which approved household-need dimensions were considered, but only in a non-identifying aggregate permitted by a later approved disclosure policy.
- Optional internal-model research insights clearly labeled **research/unverified**; no automatic promised impact, uplift or causal attribution and no fabricated success percentages.

Supporters must **never** see household identifiers, medical/financial/evidence documents, raw per-household severity labels, model training sets, fairness group slices that identify individuals, admin-wide model evaluations, funding secrets or another funder's programs. Small-group disclosure and aggregation safeguards cannot use an invented numerical threshold: they require an explicit privacy policy and tests. If the data are not approved for exposure, show a truthful unavailable/insufficient-evidence state instead of zero.

No supporter-facing workflow may approve/alter need severity, Dataset, weight coefficients, geographic parameters, model version, Pilot, Production, eligibility, wallets or credit grants. No ability to edit or reconcile bank transactions. A request to fund a program is a **separate** financial contract and must not be implied by an AI insight screen.

## Design and technical dependencies

1. **Business and Authorization:** supported funder actor(s), verified legal relationship to programs/organizations, tenant scope, revocation, allowed fields, lawful disclosure and audit; explicitly distinguish support agent, organization manager, and funding supporter.
2. **Data:** authoritative funding approval + independent bank confirmation, source/program attribution, independently verified post-allocation outcomes, unknown/null, cohort aggregation and disclosure safeguards; absence of real evidence blocks metrics rather than rendering placeholders as truth.
3. **Backend + BFF:** add a server-side authorized supporter-only read model with bounded aggregate output, no family-level identifiers and no public fallback, after contracts exist; audit, rejection/denial, and cross-funder isolation tests.
4. **UI states:** funded/verified versus registered-only, pending evidence, no consent/permission, no qualifying outcomes, revoked membership, forbidden, server unavailable, non-causal AI research badges. Provide no button for currently missing authorization or API.
5. **Figma:** draft distinct desktop/mobile screens and map immutable approved node IDs, then compare screenshots to code. Figma node `181:2` is only an unverified user-supplied inspection target; Starter-plan MCP limit prevents direct comparison.

## Current execution decision

The Admin workspace in PR #166 is real UI code and has CI browser coverage. The Funding Supporter AI panel is **UX/contract design only**, not a shipping route, linked page, backend API, active AI feature, funding proof or Production release. Work continues only inside Draft PR #166; no merge, Stage/Production, iOS native, model training or real-money changes without their respective gates.
