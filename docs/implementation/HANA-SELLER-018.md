# Seller 018 — Seller Offers Foundation Backlog

## Business outcome

A seller should be able to offer an approved catalog product or service from their activated seller account. The seller offer is a seller-owned commercial relationship; it must not turn the global Catalog product identity into a seller record.

## Product decisions recorded

- Sellers select an already published Catalog product or service. They do not create global Catalog identities directly.
- Product images are operator-reviewed Catalog content. Sellers do not upload a new image in this slice.
- The Seller 05 Add/Edit Listing Figma screen shows an inactive draft as the initial publication state.
- Seller authorization requires the real Identity `SELLER` role and the activated, approved application resolved by the server.
- No Admin UI is in scope without an approved Admin design.

## Figma references

Seller Panel page `260:697`:

- Desktop Products & Services: `261:10`
- Desktop Add/Edit Listing: `261:184`
- Desktop Inventory & Availability: `261:347`
- Mobile Products & Services: `259:257`
- Mobile Add/Edit Listing: `259:338`
- Mobile Inventory & Availability: `259:583`

These frames contain sample products, prices, inventory counts, image quality results, and seller names. None are production data.

## Current system boundary

The existing Catalog owns moderated product identity and published categories/products. `ProductRecord` has no price, inventory, seller ownership, or image field. Its operator import accepts reviewed JSON identity data only. Catalog public APIs expose identity fields only.

There is no Seller Offer or Media persistence/API in the Seller 017 parent. The architecture keeps Catalog identity separate from seller offer, price, inventory, and availability. This backlog must preserve that boundary.

## Proposed vertical slice

Seller 018 should establish a separate, persisted Seller Offer model that references a published Catalog identity and belongs to the activated seller account. Initial offers are drafts. The seller account and eligible Catalog identity are derived and validated server-side; neither is trusted from a client claim or accepted as a free-form product identity.

Candidate data responsibilities:

- seller account and catalog product identity
- goods/service kind derived from Catalog
- offer draft state and revision
- price stored as integer Iranian rials; UI presentation may convert to toman
- goods stock quantity and unit, or service availability/capacity fields, kept type-specific
- create/read/update operations with idempotency and optimistic revision checks
- a same-origin Web BFF using the HttpOnly session cookie and `no-store` for mutations

Candidate routes are `GET /api/v1/seller/offers`, `POST /api/v1/seller/offers`, and revision-checked offer update. These are proposals until the technical contract is reviewed.

## Dependencies to close before a seller can save/publish an offer

1. **Catalog image records and operator import:** the selected product must carry an operator-reviewed primary image reference. The current ProductRecord/import/API do not support images.
2. **Durable image hosting:** repository code has no media store, upload service, or configured object-storage provider. A product image reference must resolve to a durable approved asset before it is shown in the Seller Panel or buyer Catalog.
3. **Goods units and quantity precision:** the Figma lists units and stock quantities, but Catalog has no unit vocabulary or measurement precision contract.
4. **Service availability contract:** service hours, capacity, and booking semantics need an approved model; stock fields must not be reused for services.
5. **Publication policy:** the Figma exposes Draft and Active. Confirm whether sellers may activate an offer as soon as its Catalog identity is published, or whether each offer needs a separate review.

Do not use arbitrary remote image URLs, placeholder images, seed offers, sample prices, or Figma inventory values to hide these dependencies.

## Backlog acceptance criteria

1. Each offer belongs to one activated seller account and one published Catalog identity.
2. A seller cannot read or change another seller's offer.
3. A seller cannot submit a forged seller ID, Catalog identity, kind, or publication state.
4. Offer values use the canonical price and quantity contracts; service availability remains distinct from physical stock.
5. A draft offer is never exposed as a purchasable public Catalog item.
6. Conflicts report stale revisions; repeated idempotency keys cannot create duplicate offers.
7. Read and mutation responses contain only the seller's authorized fields and are `no-store`.
8. Seller panel readiness remains false until a real Seller Offers API and usable UI are connected.
9. Backend and web tests cover authorization, Catalog eligibility, seller isolation, validation, conflict, and idempotent retry.
10. CI release gates remain backend, web, mobile, and Android. iOS is out of scope.

## Current status

Product identity selection and operator-reviewed Catalog imagery are decided. Technical backlog is defined; implementation remains blocked until Catalog media/hosting, goods units, service availability, and offer publication policy are settled. Seller 016 capabilities remain truthful and disabled.
