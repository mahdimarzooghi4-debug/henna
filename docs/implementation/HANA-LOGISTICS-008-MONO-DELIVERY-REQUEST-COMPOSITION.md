# Logistics 008 — Compose a delivery request safely

## Boundary

This pure composer turns a delivery order, the seller's mapped branch as observed in the current Mono branch response, and a ready shipment composition into a validated Mono request DTO. It performs no network calls and stores no addresses.

## Blocking rules

The request remains unavailable unless the order is deliverable, the mapped branch identifier is valid and matches a branch currently marked ACTIVE, pickup and dropoff have a usable address or coordinate pair, and shipment composition is ready. The external reference is the stable order UUID in compact form.

A later dispatch workflow must still require a deliberate user action, durable idempotency and request recovery, and a provider quote/price policy before creating a delivery request. This composer does not submit anything.
