# Seller 026 — offer edit and direct publication API

## Product decisions applied

On 2026-09-28, the product owner confirmed that Catalog owns each good's canonical unit and quantity precision; an activated seller can publish its offer directly after server validation, without an Admin approval queue; and stock is reserved when payment starts, then released when payment fails or expires. The reservation deadline remains tied to the future payment contract.

## Scope

- Sellers update an offer's price in whole Iranian rials and its sellable quantity.
- Quantity is validated against the current Catalog scale (0–6 fractional digits).
- Mutations require the exact current revision and an `Idempotency-Key`.
- Every successful update or publication writes a Seller mutation record in the same transaction as the state change.
- Updating a published or paused offer returns it to `DRAFT`; the seller must publish that revision explicitly.
- Publishing requires a positive price and quantity and a currently published Catalog good with a valid unit contract.
- The same activated-seller server authorization gate applies to every read and mutation. Web uses same-origin BFF routes and HttpOnly cookies; bearer tokens remain server-to-server.

## Not included

This slice does not expose offers to buyers, implement the seller offer screen, cart/order, payment, stock reservation, or shipping. It also does not invent Catalog items or media. Those steps depend on this write API and the future payment/order state machine.

## Verification

Backend/API tests cover quantity precision, seller isolation, activation checks, revision conflicts, successful update/publication, idempotent retries, and audit insertion. The isolated HTTPS BFF test covers same-origin enforcement, request allowlists, bearer forwarding, response validation, and `no-store`.

CI gates are backend, web, mobile, and Android only. iOS is out of scope.
