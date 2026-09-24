# Frontend 037 — Organization Program Draft Create/Edit

Backend 036 write contract is connected to the Organization Portal.

PORTAL_ADMIN sees real create/edit controls; other roles do not. This UI check
is only presentation: Backend 036 independently re-authorizes every mutation.

Create uses a browser-generated idempotency UUID. The BFF requires same-origin
Origin, validates a strict field allowlist and sends the key upstream as the
Idempotency-Key header. Organization, allocation method, status, audit actor and
revision cannot be supplied by the browser.

The mounted create form reuses the same key when an unchanged request is
retried after a transport failure; changing form content causes a fresh key on
the next submission.

Draft detail exposes edit only for PORTAL_ADMIN + DRAFT. The current revision is
submitted. On 409 the UI keeps local unsaved fields, reports the newer server
revision when available, and requires an explicit reload instead of silently
overwriting concurrent changes.

CI covers role-gated SSR, CSRF rejection, forbidden tenant fields, idempotent
create 201/200, response allowlisting, revision 1->2, stale 409/currentRevision
and cross-tenant 404.

Next: define an explicit DRAFT submission/registration transition. Activation
and allocation remain separate contracts.
