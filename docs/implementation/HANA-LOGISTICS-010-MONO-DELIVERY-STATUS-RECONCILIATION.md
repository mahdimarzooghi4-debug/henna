# Logistics 010 — Mono delivery status reconciliation

## Scope

The Admin-only endpoint
`GET /api/v1/admin/integrations/mono/orders/{orderId}/status`
reads the Henna correlation and, when a Mono delivery-request ID exists, fetches the tenant-scoped Mono delivery detail. A prepared correlation with no Mono request ID is reported locally without making a provider call.

The response is an allowlisted status view: correlation state/revision, Mono request and mission identifiers, provider and mission statuses, committed delivery time, Quote and Promise. It does not expose the Mono request payload, pickup/dropoff, names, phone numbers, or internal provider errors.

## Reconciliation rules

- Mono detail must refer to the request ID already linked to the Henna order and its `external_reference` must equal the compact Henna order UUID.
- A returned Mission is linked through the existing idempotent correlation store. Quote and Promise are returned for the current read and are not copied into Henna persistence.
- Mono transport or invalid-provider responses fail closed. No automatic retry, request creation, quote issuance, confirmation, or mission action is performed.
- The endpoint requires an authenticated Henna administrator, HTTPS outside development, and configured commerce storage.

## Verification boundary

Unit tests cover a locally prepared correlation, a successful detail read with Mission linking, and rejection of a detail belonging to another order. CI and the integration HTTP gateway are still required to verify this endpoint. No live Mono call is made by the tests.