# Frontend 053 — Organization notifications

The dedicated `/organization/notifications` page loads the organization
profile and notification state from the server. The browser endpoint
`GET /api/organization/notifications` reads the HttpOnly session cookie,
forwards only Bearer authentication to the upstream read endpoint, rejects
query parameters, and returns `no-store`. POST has no route.

The old hard-coded synchronization, sample program and status notifications
have been removed. The first approved source is the durable Program
registration transition. A validated empty response displays a true empty
state; source errors show unavailable. Real items display member-scoped read
receipts and the registration UTC timestamp. Marking an item read requires a
separate action and is not claimed by this read-only milestone.

Unexpected keys, invalid timestamps, duplicate IDs, unknown event types and read states
make an upstream response unavailable. The browser receives only projected
notification fields; tenant IDs and Bearer credentials are never returned.
