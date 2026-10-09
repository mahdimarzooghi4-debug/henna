# Internal 002 — Credit-funded purchase history, scoped facts projection

**State:** Internal domain/infrastructure slice only; no public API, no UI and
no claim that the funding-supporter panel is already operational.

The authorized supporter-facing product requirement is **only**:
(1) allocation amount per beneficiary, and
(2) the goods/services purchased **with that beneficiary's credit from
that supporter's own program**. No supporter-facing AI or impact analytics.

This slice composes existing immutable/recorded \`CreditGrant\`,
\`Order.CreditGrantId\`, \`Order.BuyerId\` and \`Order.Items.CreditRial\`.
It only selects matching program grants, never purchases paid in full cash
or from another program, and keeps returns/refunds and cancelled orders
honest. For a partial refund it reproduces Commerce's cumulative-floor
credit reversal, so the reported net is not the gross original payment.
A missing \`ProductName\` stays null rather than inventing a product.

Tests cover cross-program isolation, mixed cash/credit item lines, full
cancellations, partial credit refunds and fail-closed corrupt linkage.

**Not yet allowed:** a supporter's funding-program membership/ownership and
per-beneficiary purchase disclosure authorization are NOT approved or
implemented here. Callers must never treat the \`programId\` input as proof
of permission. No authenticated external endpoint invokes this service; no
HTTP route, BFF or Figma view is added. Do not conflate \`/support\` or
\`/organization\` MANAGER with a financial funding supporter.

See Issues #167 (external/banking) and #168 (internal/completion). No
Production funding proof, Stage, merge or iOS Native work was performed.

## Read-model consistency
A grant ID may legitimately remain on an entirely cash-funded order when its
available credit is exhausted at checkout. It contributes no purchase lines.
Positive credit payment without a grant ID fails closed; the projection also
validates the exact item unit-price × quantity and cash/credit order totals,
unique order-item identities, and cancellation/refund coherence. No cash-funded
share is reported as supporter spend.
