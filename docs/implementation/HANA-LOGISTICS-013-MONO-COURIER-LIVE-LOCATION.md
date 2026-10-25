# HANA Logistics 013 — Mono courier live location

Henna's existing admin integrations page reads the order-scoped Mono status through the authenticated Henna BFF and ASP.NET API. This sprint extends that same server-to-server path with a current courier point for an active Mission.

- Henna's browser never receives the Mono API key; the backend calls Mono with the tenant-scoped `X-Mono-API-Key` credential already used for delivery reads.
- Mono resolves the point only when the Mission belongs to the Henna customer, has an accepted courier offer, is in an active delivery state, and the point is no more than 60 seconds old.
- Henna validates the coordinate range and freshness again, returns only latitude, longitude, accuracy, and observed time, and never stores the location.
- The admin page refreshes active Mission status every 15 seconds while the page remains open; terminal Missions stop polling. Missing/stale points produce no location payload.
- The display includes coordinates and a native map-app handoff. No public tile provider is used; the in-panel map awaits the separately provisioned self-hosted OSM tile source.

This is read-only tracking. It does not dispatch a courier, mutate a Mission, or expose courier identity, route history, pickup/dropoff addresses, or contact details.
