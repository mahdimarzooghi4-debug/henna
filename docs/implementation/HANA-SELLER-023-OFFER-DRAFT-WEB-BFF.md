# Seller 023 — Web BFF for Offer Drafts

## Scope

The web server exposes same-origin routes for the existing Seller Offer draft API. Seller UI remains deferred until an approved responsive Catalog picker design is available. Scope is supermarket GOODS only; services, price, unit, quantity, stock, delivery, publication, and buyer visibility remain out of scope.

## Routes

- `GET /api/seller/offers` accepts no query parameters, reads the HttpOnly session cookie, and forwards the bearer only server-to-server to `GET /api/v1/seller/offers`.
- `POST /api/seller/offers` requires same-origin Origin/Host, JSON content type, the HttpOnly session cookie, one non-empty `catalogProductId` field, and a UUID `Idempotency-Key`. It forwards only the allowlisted product ID and idempotency key.
- Both routes use `no-store`, reject redirects, bound upstream payloads, validate response shapes, and map invalid/unavailable upstream data to 503. GET returns only seller draft fields and the Catalog-owned current read projection. POST response is validated as a DRAFT for the requested Catalog ID.
- Backend authorization remains authoritative on every call: active SELLER role, approved application and activation, ownership, current Catalog eligibility, and idempotency.

## Tests and release gates

The web CI combines anonymous/query/CSRF checks with an isolated HTTPS upstream test covering cookie isolation, bearer and idempotency forwarding, DTO allowlisting, no-store, and rejected requests. No live service or seller data is used. Web typecheck/build runs in the web gate; Seller 020 PostgreSQL/API tests continue to cover authorization, ownership, Catalog eligibility, and idempotency. Only backend, web, mobile, and Android gates are in scope; iOS remains out of scope.
