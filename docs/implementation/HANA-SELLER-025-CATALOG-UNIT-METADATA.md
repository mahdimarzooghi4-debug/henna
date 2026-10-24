# Seller 025 — canonical Catalog unit metadata

## Scope

Seller 025 starts the internal goods-offer flow by recording each good's canonical display unit and permitted quantity precision in Catalog. Sellers read these values from Catalog; they cannot supply or change them. Services do not use these fields.

The Catalog operator import accepts `unitName` and `quantityScale` for goods. `unitName` is required and non-empty when either field is present; `quantityScale` is an integer from 0 through 6. Legacy Catalog rows may keep both fields null. They are excluded from the seller's eligible-goods picker and cannot be used to create new offer drafts until a reviewed Catalog import supplies both fields.

No product unit or stock values are inferred or backfilled. The migration adds nullable columns and a database constraint that requires the two fields together and permits them only for goods.

## Verification

- Catalog import tests cover valid unit metadata on goods and null metadata on services.
- Seller offer API tests assert the eligible-goods response includes the canonical unit and quantity scale.
- CI must pass the backend, web, mobile, and Android gates. iOS is out of scope.

## Remaining work

This change does not add seller price, sellable quantity, offer publication, buyer visibility, cart, order, or payment behavior. Those are later slices; a draft still cannot be purchased.
