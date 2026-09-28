# ADR-010: Buyer reference cart

**Status:** Accepted for Buyer 003 implementation
**Scope:** Internal first-party buyer catalog only

## Decision

The buyer cart is an account-scoped reference list of published catalog goods
and customer-requested quantities. It is not a quote, offer selection, order,
reservation, or payment instruction.

The cart stores product identity, requested quantity, catalog unit and
quantity precision. The API accepts only currently published `GOOD` products
with a canonical catalog unit, and rejects quantities that exceed that unit's
declared precision. The cart is not a source of price, stock, seller, delivery,
or eligibility facts.

Each account has one reference cart. Reads and writes require a valid existing
Identity session; possessing an account does not grant Seller, Admin, or other
business roles. Reads are account-scoped. Mutations carry the expected cart
revision and use compare-and-set semantics. Setting a product quantity replaces
that product's requested quantity, so replay cannot increment it twice. A
retry with the same requested quantity returns the existing current cart
without creating another revision. A stale revision with a different desired
quantity returns a conflict and the client must reload before trying again.
Removing an item is an explicit buyer action; unavailable or withdrawn
catalog products are not silently removed.

## Follow-on purchase flow

The later quote flow compares seller offers for the reference list. A future
order must select exactly one seller. The buyer may proceed with a seller who
covers all or part of the list, with unfulfilled items handled by explicit
buyer choice. Price, inventory, address coverage, delivery, quote expiry,
reservation, and payment are revalidated by their own contracts before an
order can be created. No checkout or purchase confirmation is enabled here.

## Consequences

- Buyer 003 can persist buyer intent without inventing prices or availability.
- Public catalog unit metadata is exposed on existing product read models.
- A new `buyer` schema owns reference-cart persistence and revision state.
- Payment, logistics, quote expiry, stock reservation, and seller selection
  remain outside this slice.
