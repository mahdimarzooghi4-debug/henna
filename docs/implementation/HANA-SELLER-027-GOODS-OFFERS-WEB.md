# Seller 027 — Goods offers web flow

## Scope

This slice adds the seller web page for supermarket goods offers at `/seller/offers`.
It reuses published goods from Catalog, accepts the canonical Catalog unit and
quantity precision, displays only real offer records, and supports editing and
direct publication through the Seller 026 API lifecycle. Service-only seller
accounts do not receive the goods capability and are rejected by the API gate.

No sample products or offer values are introduced. Offer creation uses separate
idempotent steps: create a draft, update price and sellable quantity with an
exact revision, then publish. If a network error interrupts a step, the page
keeps the draft context so the seller can retry or return to the list and
refresh from the server.

## Routes and contracts

- `GET /api/seller/offers` — current seller's offer read model.
- `GET /api/seller/catalog/goods` — searchable eligible goods; first page is
  shown and the seller can search the actual Catalog when it contains more.
- `POST /api/seller/offers` — create an idempotent draft reference.
- `PUT /api/seller/offers/{offerId}` — update exact revision, price in integer
  Iranian rials, and sellable quantity.
- `POST /api/seller/offers/{offerId}/publish` — explicitly publish after the
  Catalog item and unit contract are revalidated by the backend.

The web UI uses same-origin BFF routes, HttpOnly session cookies, no-store
responses, and request-specific idempotency keys. It does not expose a bearer
token or accept a seller/account identity from the browser.

## Verification

`tests/web-seller-offers-browser-smoke.mjs` covers Catalog selection, the
create/update/publish sequence, and a narrow mobile viewport. The backend
offer test covers unit precision, revision conflicts, seller ownership,
idempotency, audit entries, and service-only seller denial. iOS is out of scope.
