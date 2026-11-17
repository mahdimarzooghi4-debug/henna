# Buyer 005 — Saved Purchase Selection Draft

## Product boundary

Buyer 005 follows the read-only offer comparison in [Buyer 004](HANA-BUYER-004-OFFER-COMPARISON.md). It lets a signed-in buyer save one seller and selected cart lines as an editable draft. Only a line for which the seller's currently published declared quantity covers the entire reference-cart quantity can be saved. Unselected and uncovered lines remain in the reference cart unchanged.

The saved record is not sent to a seller and does not represent a final quote, order, reservation, payment, delivery promise, or logistics request. Displayed price and quantity are seller-declared values; later order work must revalidate price, inventory, coverage, delivery, and other business rules.

## Design reference

- Desktop draft: [Figma node 730:3](https://www.figma.com/design/uREafnhmH5dDRwPraBOmuk/henna-platform?node-id=730-3)
- Mobile draft: [Figma node 730:35](https://www.figma.com/design/uREafnhmH5dDRwPraBOmuk/henna-platform?node-id=730-35)

## Storage and concurrency

- `buyer.purchase_drafts` stores one current draft/tombstone per buyer account, an opaque `seller_public_id`, saved full-quantity lines, revision, and update time.
- `buyer.purchase_draft_idempotency` stores successful mutation receipts scoped to the account and idempotency key.
- PUT and DELETE use exact revision checks and compare-and-set updates. Replaying the same key and payload returns the original response; reusing a key for another payload conflicts.
- Deleting a draft increments revision and leaves a tombstone so stale clients cannot recreate it using an old revision. It does not alter `buyer.reference_carts`.

## API and price confirmation

- `GET /api/v1/buyer/cart/purchase-draft` returns the account's saved lines and current offer price/declared quantity state.
- `PUT /api/v1/buyer/cart/purchase-draft` validates account session, reference-cart revision, one seller, current activated/approved seller state, published offer and GOOD Catalog product, unit/precision, and full quantity coverage.
- `DELETE /api/v1/buyer/cart/purchase-draft` clears the saved selection with revision and idempotency checks.
- If a submitted expected price is stale, PUT returns `PRICE_CHANGED`. After the buyer has loaded and reviewed the current price, saving a previously saved same-seller offer whose price changed also requires `confirmCurrentPriceChanges: true`; otherwise it returns `PRICE_CONFIRMATION_REQUIRED`. The server checks both conditions, so the confirmation is not only a UI convention.
- All endpoints are account-scoped and `no-store`. Browser mutations use the same-origin BFF with strict DTO allowlists and an HttpOnly session cookie; the bearer session is forwarded only server-to-server.

## Verification

API coverage includes account isolation, unauthenticated access, idempotent replay and key reuse, stale price, required explicit price confirmation, successful confirmed update, deletion, and unchanged reference-cart contents. Web coverage includes strict DTO parsing, BFF origin/session/bearer boundaries, the save/delete interaction, price reconfirmation, and mobile layout.

CI remains limited to backend, web, mobile, and Android. Native iOS is out of scope.
