# Seller 020 — Draft Catalog Offer API

## Result

A seller can persist a seller-owned `DRAFT` reference to a currently published supermarket Catalog product. This is not a purchasable listing. The slice has no price, unit, quantity, stock, service, buyer visibility, or publication behavior.

## API

- `GET /api/v1/seller/offers` returns the authenticated seller's own drafts and a nested read-only projection of each currently eligible Catalog GOOD (ID, name, category name, description, and the current approved media route when present). The projection is read from Catalog on each request and is not persisted in Seller. If the Catalog identity is no longer a published GOOD in a published category, `catalogProduct` is `null`; the Seller draft remains intact.
- `POST /api/v1/seller/offers` accepts only `catalogProductId` and a required UUID `Idempotency-Key`.
- Creation validates the current Catalog product is a published `GOOD` in a published category.
- Identity session, current `SELLER` role, and approved/activated application are resolved from server databases on every request.
- The Seller table has no cross-module Catalog or Identity FK; its seller owner references the existing Seller registration row.
- Same-key/same-product retries return the original draft; same-key/different-product conflicts.
- No public Catalog response or buyer purchase flow reads Seller drafts.

All API responses use `no-store`; unauthenticated requests return 401, non-Sellers and non-activated accounts return 403, and unconfigured database or non-Development HTTP returns 503.

## Database

`seller.offer_drafts` stores a UUID offer ID, seller account ID, Catalog product ID, constrained `DRAFT` state, revision 1, seller-scoped idempotency key, and UTC timestamps. The migration seeds no data.

## Deferred

The Seller UI waits for an approved Figma adaptation of Catalog product selection. Price, unit/precision, inventory, edit/publish transitions, review policy, buyer visibility, orders, and services remain outside this slice. Seller listings capability remains false.

## Tests and release gates

PostgreSQL/API coverage checks authorized Seller creation, role/application denial, published-goods eligibility, idempotent retry, seller isolation, and that no Offer fields leak into the public Catalog. CI gates are backend, web, mobile, and Android only; iOS is out of scope.
