# Henna — Funding Supporter panel: allocation and purchases only

**Status:** Accepted PRODUCT SCOPE by Product Owner on 2026-10-09; backend authorization and UI integration remain unimplemented.
**Supersedes:** The previous draft suggestion of funding-supporter AI analytics/impact dashboards in this file and PR #166.
**Actor:** `حمایتگر` is a person or organization providing funding for household support. It is NOT a customer-support agent at `/support`, nor is it automatically the same role as an organization manager at `/organization`.

## Exactly two questions the supporter panel must answer

1. **How much credit did Henna allocate to each beneficiary from this supporter's authorized programs?**
2. **What goods or services did that beneficiary purchase using credit from the corresponding program?**

The page is a factual, read-only allocation and purchase report. There are **no** AI scores, AI predictions, need-severity recommendations, impact claims, model comparisons, Dataset management, XGBoost/EBM reports, or model activation controls in the supporter panel. AI governance stays in Admin.

## Proposed minimum display (no fabricated rows)

- Select/see one **authorized funding program** and its actual assigned beneficiaries.
- For each beneficiary in that program, show a minimally necessary, authorized identification label and **allocated credit in rial** (the `CreditGrant.GrantedRial` for that program).
- Open that beneficiary's purchase history **funded by the same credit grant**: order date/status, product/service name where a recorded trustworthy name exists, item quantity, credit-paid amount for that item, and return/refund status if applicable.
- Clearly distinguish `no purchase yet` from `unavailable evidence`. Do not infer purchases from a decrease in balance; actual order linkage is authoritative.

Any extra column, analytics KPI, per-household need score, medical/economic evidence, product recommendation or ability to modify allocations is **out of scope**. Displaying identity beyond a minimally necessary beneficiary label requires the approved disclosure/authorization policy; never guess the user's full legal name from a GUID.

## Existing source-of-truth fields and joins

- `CreditGrant`: `Id`, `AccountId`, `HouseholdKey`, `ProgramId`, `GrantedRial`, `AvailableRial`. This is the exact per-person, per-program allocation; the consumer may have grants from other programs that must not leak.
- `Order`: `BuyerId`, `CreditGrantId`, `CreatedAtUtc`, `State`, `RefundState`, `CreditPaidRial`, `Items`. Include an order only when `CreditGrantId` matches the scoped grant and its `BuyerId` matches the grant's `AccountId`.
- `OrderItem`: `ProductId`, `ProductName` (nullable), `Quantity`, `CreditRial`, `RefundedQuantity`; these let the view show **only the share actually paid from the credit**, not the buyer's unrelated private cash purchases or inferred category use. Preserve returned/cancelled/refunded state; never label a fully refunded item as currently consumed credit.

`CommerceService.Allocate` creates the first-party `CreditGrant`; `PlaceOrder` records matching `CreditGrantId` and immutable purchase-line credit funding. A `CreditGrant` balance is not a purchase ledger. Real external financial funding/reconciliation still has separate admission requirements.

## Required access guard before an operational endpoint or page

The currently implemented `/organization/dashboard` is limited to `MANAGER` memberships and returns aggregate program balances and beneficiary counts, **not individual allocations and orders**. It is NOT already a funding-supporter report. The generic `ReadAsync` order listing is buyer-scoped and must not be exposed as a shortcut.

Before enabling the supporter report, the backend must verify a real documented relationship between authenticated funding supporter and each program (including revoke and cross-supporter isolation), authorize beneficiary-level purchase disclosure, and return a server-filtered, bounded projection for only those `CreditGrant`/`Order` links. Auth must not be inferred from a query parameter, source-reference string, organization-manager membership alone, or a frontend filter. Test revoked membership, foreign program, mismatched buyer/grant, unauthenticated access, direct-ID enumeration, mixed cash/credit, cancellations and refunds. Do not invent a `SUPPORTER` role or pretend such authentication is already active.

## Practical UI shape

`طرح حمایتی → جدول مشمولان (شناسه مجاز / اعتبار تخصیص‌یافته) → جزئیات خرید با همان اعتبار (کالا/خدمت، تعداد، مبلغ از اعتبار، تاریخ، وضعیت مرجوعی)`.

No AI dashboard for supporter. The Admin AI workspace remains under `/admin/allocation-ai` in Draft PR #166. Figma node `181:2` remains an unverified inspection reference due to the Starter-plan MCP call limit, not an approved donor screen.

This file records an approved **functional scope**, not a functioning supporter-facing endpoint, Figma approval, CI QA completion, merge, Stage or Production.
