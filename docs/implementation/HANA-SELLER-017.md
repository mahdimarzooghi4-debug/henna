# Seller 017 — Orders List and Detail Backlog

## Business outcome

An activated seller needs to inspect only orders assigned to that seller and the fulfillment information needed to process them. The product decision in [ADR-001](../adr/ADR-001-SINGLE-SELLER-ORDER.md) makes each order belong to exactly one seller. Seller 017 is a read-only list/detail slice; it does not approve, prepare, complete, cancel, refund, or otherwise change an order.

## Approved design references

Seller Panel Figma page `260:697`:

- Desktop orders list: `258:158`
- Desktop order detail: `258:282`
- Mobile orders list: `259:102`
- Mobile order detail: `259:176`

These frames contain sample order numbers, people, amounts, products, payment and fulfillment states. They are design examples and must never be used as runtime or seeded data.

## Repository evidence and dependency

At the Seller 016 parent commit, the repository has no Order aggregate, order persistence, or executable seller-order API. The order-related API document is explicitly a proposal, not a deployed contract. The approved ADR-001 gives the single-seller ownership rule, but does not define the order state machine or the remaining checkout and fulfillment policies.

Therefore this backlog item must consume the canonical order source created by the buyer checkout/order work. It must not create a parallel seller-owned order table, invent order states, or add fixtures that look like production orders. Runtime implementation is blocked until that source and its seller-scoped read contract exist.

## Proposed vertical-slice boundary

After the dependency is available, Seller 017 should add:

- A seller-scoped read endpoint for a paginated order list and a single order detail.
- A same-origin Web BFF that uses the HttpOnly session cookie; any bearer credential stays server-to-server.
- Responsive list/detail views based on the four Figma frames above.
- Real empty, loading, unavailable, and unauthorized states. An empty list is valid only when returned by the canonical backend.
- The smallest fulfillment fields approved by the order contract. Customer identity and delivery details must be minimized and available only to the seller assigned to that order.
- No order mutations. The Figma action buttons require separately approved command contracts and are outside this read-only slice.

Endpoint names such as `GET /api/v1/seller/orders` and `GET /api/v1/seller/orders/{orderId}` are candidates only; the canonical order owner must approve the API contract before implementation.

## Backlog acceptance criteria

1. A seller can read only orders whose persisted seller ID matches the seller account resolved by the server.
2. The request cannot widen scope by supplying a seller/account ID; client claims are not authorization.
3. List and detail values come only from the canonical order and item snapshots, including authoritative timestamps, amounts, fulfillment method, and status.
4. Cross-seller access is denied without disclosing order existence or protected fields.
5. Pagination is stable and bounded; any status filters use only canonical status values.
6. An empty result, backend outage, malformed response, and denied access render distinct truthful states.
7. No Figma samples, fabricated orders, or production seed records are introduced.
8. Web mutations remain same-origin, strict-allowlisted, and `no-store`; bearer tokens are never exposed to the browser.
9. Backend and browser integration tests cover seller isolation, pagination, list/detail consistency, empty/error handling, and absence of fake data.
10. CI release gates are backend, web, mobile, and Android only. iOS is out of scope.

## Business decisions still required from the order-domain owner

Before the read contract is finalized, confirm:

- The canonical seller-visible order states and their mapping to the Figma labels.
- Which order and item snapshot fields are safe and necessary for seller fulfillment.
- Which payment summary, delivery address, customer contact, and buyer note fields the seller may read.
- Whether service orders need different list/detail fields from goods orders.

Actions shown by the Figma designs (confirm, begin preparation, report a problem, mark ready, and complete) remain out of scope until each transition has an approved command, authorization rule, concurrency rule, and audit behavior.

## Current status

Backlog definition complete; runtime implementation is blocked by the missing canonical order/checkout domain and API. Seller 016 capability readiness must remain `orders=false` until a real seller-scoped read model is available.
