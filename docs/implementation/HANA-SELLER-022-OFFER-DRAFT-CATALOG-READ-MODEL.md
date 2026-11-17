# Seller 022 — Seller Offer Draft Catalog Read Model

**Status:** Backend read-model slice. Seller UI and BFF remain separate follow-ups.

## Product and data contract

Seller Offers currently support supermarket `GOOD` identities only. The Seller database stores a seller-scoped draft reference to a Catalog product ID; Catalog continues to own mutable product identity, category, description, and operator-reviewed media.

`GET /api/v1/seller/offers` first reads the authenticated seller's own drafts. It then reads the matching current Catalog identities and returns a nested `catalogProduct` projection for records that are:

- kind `GOOD`
- state `PUBLISHED`
- in a `PUBLISHED` category

The projection contains Catalog ID, current name, category name, optional description, and the current primary media route when available. That route is the existing read-only media endpoint, which serves only the currently published product's operator-approved primary media.

If the Catalog product or its category ceases to be eligible, the Seller draft remains unchanged and the current projection is `null`. This avoids stale or invented product content while preserving the seller's draft reference.

## Boundaries

- No Catalog title, description, category, or media URL is copied into Seller storage.
- No cross-module database foreign key is introduced.
- GET remains account-scoped, rechecks Seller role and activation, and returns `Cache-Control: no-store`.
- POST, its idempotency contract, and the draft persistence model are unchanged.
- No price, unit, quantity, inventory, delivery, services, publication, order, or buyer-visible offer behavior is added.
- No web UI, BFF route, Admin UI, sample product, or capability flag is included.
- Only backend, web, mobile, and Android gates are required; iOS is out of scope.

## Verification

The PostgreSQL/API test reads the Catalog name, category, and description from their actual test records, verifies seller isolation and no-store, and confirms that unpublishing a Catalog product nulls only the read projection while preserving the Seller draft. Existing public Catalog tests continue to verify that Seller draft fields do not leak to buyers.
