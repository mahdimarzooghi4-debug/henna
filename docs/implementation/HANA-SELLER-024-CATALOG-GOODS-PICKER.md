# Seller 024 — Published Catalog Goods Read Model

## Scope

Seller 024 supplies the read-only candidate list for the Seller Offer picker. The responsive UI remains unimplemented until Seller 021's Figma proposal is approved.

Only current Catalog records with `kind=GOOD`, `state=PUBLISHED`, and a `PUBLISHED` category are eligible. Categories returned for filters contain at least one eligible good. Candidate fields are read live from Catalog; the Seller module stores no copied identity or media.

## API

`GET /api/v1/seller/catalog/goods?page=1&pageSize=20&categoryId=<uuid>&search=<text>`

The response contains a bounded page, total count, and eligible categories. Ordering is stable by product name and ID. Page size is 1–50, page is 1–10000, and search is limited to 80 characters with SQL LIKE wildcards escaped. The candidate DTO contains ID, category ID/name, product name, optional description, and the route to the current approved primary media. It includes no kind (all rows are GOODS), price, unit, quantity, inventory, seller identity, delivery, or publication controls.

Every request re-resolves the Identity session, current SELLER role, approved application, and activation state through the Seller 020 authorization gate. Missing session is 401; ineligible account is 403. Responses use `Cache-Control: no-store`; dependency failures return 503.

## Web BFF

`GET /api/seller/catalog/goods` uses the HttpOnly session cookie in the browser and forwards the bearer only server-to-server. It accepts only page, pageSize, categoryId, and search; validates upstream shape and field allowlists; rejects redirects; bounds payloads; and returns `no-store`.

The existing Offer draft creation route remains the only write path and retains its Idempotency-Key contract. Selecting a real Catalog ID cannot make a draft visible to buyers or set commercial fields.

## Verification

PostgreSQL/API tests cover active Seller authorization, anonymous and non-Seller denial, GOOD-only filtering, unpublished product and category exclusion, category/search filtering, pagination validation, and current media projection shape. An isolated HTTPS BFF test covers bearer forwarding, cookie isolation, input allowlists, DTO allowlisting, no-store, and rejection paths.

Only backend, web, mobile, and Android CI gates apply. iOS is out of scope. No Seller UI, sample product data, fabricated media, service, price, inventory, or publication behavior is included.
