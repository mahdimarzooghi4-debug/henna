# Seller 020 — Draft Catalog Product Offer Technical Design

**Status:** Proposed technical slice. No runtime code is included in this PR.

## Product scope

- Henna's current release covers supermarket goods only. Services are out of scope.
- A seller chooses an already published Catalog product; the seller does not create or alter the Catalog identity.
- Creating a draft does not set a price, quantity, unit, inventory, delivery promise, or buyer-visible publication state.
- A draft is not purchasable and is never included in public Catalog responses.
- Seller activation remains separate from Offer draft creation. Requests require a valid session, the current Identity `SELLER` role, and an approved, activated seller application resolved server-side.

## Proposed API contract

### Create draft

`POST /api/v1/seller/offers`

Headers:

- `Authorization: Bearer …` — server-to-server only through the Web BFF
- `Idempotency-Key: <UUID>` — required and scoped to the authenticated seller account
- `Content-Type: application/json`

Body:

```json
{ "catalogProductId": "..." }
```

The server accepts no account ID, product name, image URL, kind, price, quantity, unit, status, or publication value from the client.

On first success, return `201 Created` with the offer ID, Catalog product ID, status `DRAFT`, revision `1`, and creation time. Repeating the same key and same product returns the original result. Reusing a key with a different product returns `409 Conflict`.

Eligibility is checked against the real Catalog database at create time: the product must be `GOOD`, `PUBLISHED`, and belong to a `PUBLISHED` category. An ineligible or missing identity returns `409 Conflict`. The seller database keeps the Catalog ID without a cross-module EF foreign key.

### List own drafts

`GET /api/v1/seller/offers`

Return only records whose owner is the seller account derived from the current Identity session. Each row contains only offer ID, Catalog product ID, `DRAFT` state, revision, and timestamps. The client cannot request another seller's account ID.

All responses use `Cache-Control: no-store`. Errors fail closed.

## Persistence proposal

Add a Seller-owned `seller.offers` table:

- `id` UUID primary key
- `seller_account_id` UUID, derived from the verified session
- `catalog_product_id` UUID, validated through Catalog at creation
- `status` constrained to `DRAFT` in this slice
- `revision` constrained to `>= 1`
- `idempotency_key` UUID, unique with `seller_account_id`
- `created_at_utc`, `updated_at_utc`

Do not add a Catalog FK, Identity FK, seeded rows, price, stock, quantity, unit, service fields, or publication transitions.

## Authorization and web boundary

Every request resolves the bearer session from Identity DB and reads the current `SELLER` role from Identity `role_assignments`. It also verifies the same account has a `SUBMITTED` registration, current review `APPROVED`, and a non-null activation timestamp. Client claims and submitted account IDs are never authorization inputs.

The browser integration, when designed, must use a same-origin Next.js BFF: HttpOnly session cookie in browser, bearer only from server to API, strict route/method/query allowlist, origin validation for mutations, and `no-store`. This technical slice does not design or ship the seller selection UI.

## Design dependency

The current Figma Add/Edit Listing frames show seller-entered product identity and image controls. That conflicts with the approved Catalog-owned identity boundary. A Seller UI for selecting published Catalog goods requires an approved design adaptation before implementation. No UI is invented here; no Admin UI is in scope.

## Acceptance tests for the implementation slice

1. Missing/invalid session returns `401`; authenticated non-Seller and unactivated/unapproved accounts return `403`.
2. Only a real published Catalog `GOOD` in a published category can create a draft.
3. Payload-supplied seller, name, image, kind, price, quantity, unit, status, or publication fields are rejected or ignored according to the reviewed strict parser contract; none may alter stored values.
4. New draft is always `DRAFT`, revision `1`; repeated same-key retry is idempotent, and same key with a different product conflicts.
5. Sellers can list only their own drafts; another seller cannot read them.
6. Drafts are never exposed by public buyer Catalog or treated as purchasable.
7. PostgreSQL/API tests cover authorization, Catalog eligibility, isolation, and idempotent retry.
8. CI release gates are backend, web, mobile, and Android only. iOS is out of scope.

## Explicitly deferred

Goods unit/precision, price representation, stock, offer publication/review policy, editing, deleting, buyer visibility, order/payment behavior, and Seller UI are separate decisions or slices. The draft API alone does not enable Seller listings capability.
