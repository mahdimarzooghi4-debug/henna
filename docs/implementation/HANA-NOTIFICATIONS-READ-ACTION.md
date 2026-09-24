# Organization notification read action

`POST /api/v1/organization/notifications/{id}/read` creates one read receipt
for the authenticated active member. It accepts no query or body, verifies
that the Program registration event belongs to the member's organization,
and returns `204` on first use and on identical retry. An unknown or foreign
event returns `404`; unauthorized, inactive and unavailable states remain
separate. Database primary key and organization/program/member foreign keys
protect the receipt from duplication and cross-tenant references.

The Next BFF route uses the HttpOnly session only, verifies same origin,
forwards Bearer server-to-server and never returns an upstream response body.
Only unread notifications render the action. A successful action refreshes
the server-rendered list; failure shows an error without claiming READ.

The notification list GET remains read-only. Integration coverage verifies
anonymous and foreign-member rejection, draft rejection, an idempotent retry,
one persisted receipt, and read state isolated from another member.
