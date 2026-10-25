# Logistics 007 — Compose order shipment data

## Decision and boundary

A Henna delivery order is composed from seller-declared per-unit profiles for every product and its ordered quantity. This code only prepares a validated Mono shipment value. It does not call Mono, create a delivery request, set a price or promise an ETA.

## Composition rules

- Each product profile belongs to the order's seller and must be unique and valid.
- Bag count, package count, known weight and known volume are multiplied by quantity and summed.
- Shipment load class is the highest declared class in the order.
- Handling flags become true if any included product requires them; they become false only when every product explicitly says false; otherwise they stay unknown.
- Mixed non-null temperature classes block composition. Missing optional measurements remain omitted rather than being guessed or partially summed.
- Missing, duplicate, invalid, non-delivery, cancelled, collected, or empty orders remain blocked.

Before any live dispatch, the composed request and current branch mapping still need to be revalidated and the request snapshot must be durably recorded with the existing idempotency key. Real Mono credentials and provider approval are external prerequisites.
