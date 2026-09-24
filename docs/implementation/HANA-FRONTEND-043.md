# Frontend 043 — Manual Organization Recipient Create

## Scope

Connects the Figma **Add People Manually** single-person form to Backend 042.

The screen keeps both Figma cards:
- batch CSV/XLSX card remains visibly disabled
- single-recipient card is real for `PORTAL_ADMIN`

No allocation, usage, wallet or entitlement behavior is introduced.

## Route

`/organization/people/add`

The explicit route loads:
- current organization profile
- all `REGISTERED` programs
- all `ACTIVE` programs

Pagination of the existing Program API is followed server-side so the select is
not limited to the first page.

`DRAFT`, `PAUSED` and `ENDED` programs are not offered as create targets.

## Permission UX

The list page shows the Add Recipient link only to `PORTAL_ADMIN`.

Direct access to the add route by another active role renders a no-permission
state instead of the form.

This is only UI gating. Backend 042 remains the security boundary and
re-authorizes every mutation.

## Single-recipient form

Follows the Figma fields:
- display name
- organization-required external reference
- optional phone for Hana account matching
- target program

The optional-phone help explicitly states that the phone is used for matching
and is not stored in the Organization recipient record.

## Browser BFF

`POST /api/organization/recipients`

Browser JSON contains exactly:
- displayName
- externalReference
- phone
- programId
- idempotencyKey

The BFF:
- requires exact same-origin Origin
- validates a strict body allowlist / size
- reads only the HttpOnly Hana session cookie
- forwards Bearer server-to-server
- moves idempotencyKey into the upstream `Idempotency-Key` header
- sends upstream JSON containing only the four Backend 042 fields
- re-parses successful recipient responses through the strict read DTO
- allowlists only existingRecipientId/currentStatus from 409 responses

## Idempotent retry

The mounted client form keeps one UUID for an unchanged normalized payload.

If the transport fails, pressing Add again sends the same logical request with
the same key.

Changing display name, reference, phone or target program causes a fresh key.

After a successful 201 or idempotent 200 replay the key is cleared.

## Success / match result

The success state displays only:
- display name
- masked reference
- Hana match label
- program name

Raw reference, phone, account IDs, tenant IDs, fingerprints and audit IDs never
appear in the returned browser DTO.

## Conflict recovery

- duplicate reference in the same program: show duplicate warning; no new row
- target program state changed: show warning + explicit reload control
- target program disappeared: show warning + explicit reload control
- incompatible idempotency replay: preserve form and same key for deliberate
  retry/reconciliation

There is no silent program substitution.

## Bulk boundary

CSV/XLSX controls remain disabled.

Frontend 043 does not download a fake template, parse files, or send a bulk
request because Backend 042 defines only one-person mutation semantics.

## CI

The isolated HTTPS smoke test verifies:
- admin list link + real add form
- viewer does not get the form/link
- only REGISTERED/ACTIVE program options are loaded
- DRAFT program is excluded
- batch card remains explicitly disconnected
- same-origin CSRF rejection before upstream
- strict browser-body allowlist
- viewer mutation rejection
- 201 create
- same-key 200 replay
- incompatible same-key 409
- duplicate 409 allowlist
- changed-program-status 409 allowlist
- missing/cross-tenant target 404
- upstream body contains only four Backend fields
- raw reference/phone/tenant/account/HMAC/audit/financial fields are discarded

## Next

Backend 044 can define bulk CSV/XLSX import only after atomicity, per-row error
reporting, duplicate handling, idempotency and file limits are explicit.
