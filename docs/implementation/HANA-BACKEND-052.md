# Backend 052 — Organization notifications source boundary

`GET /api/v1/organization/notifications` accepts no query parameters and
does not expose a mutation. It sets `Cache-Control: no-store` and requires a
valid Bearer session, active organization membership and active organization.

The later durable read implementation uses only the persisted final Program
registration transition (`registration_key` plus `registered_at_utc`). A
registration remains an event even if the Program status later changes.
Records without transition metadata are excluded; edited timestamps,
recipient matching and financial data never become notifications.

The response contains up to 100 most recent registration events scoped to the
member's active organization. Program IDs are opaque notification IDs. The
message is fixed text, with no Program name, recipient, account or amount.
Read state is computed for the current member only from tenant-scoped read
receipts. The GET route never creates a receipt; a separate reviewed action
is needed to mark one read. With no registrations, a valid source returns
`{ "notifications": [] }`. Database/source errors return `503`. An invalid
session returns `401`, inactive/missing organization access returns `403`,
and any query returns `400`.

The migration adds only read receipts. It does not add a generic outbox,
support messages or a delivery worker. Historic Program rows without
registration metadata cannot be reconstructed as notification events.
