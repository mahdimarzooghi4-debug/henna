# Backend 042 — Manual Organization Recipient Create

## Scope

Backend 042 implements the Figma **Add People Manually** single-person action.

It creates an enrollment record only. It does not:
- allocate credit
- create an entitlement
- move balances
- create wallet state
- record usage
- write a ledger entry

CSV/XLSX bulk import remains closed until its duplicate/error/partial-import
contract is designed separately.

## Permission

Read access remains available to active organization members.

Manual recipient mutation is fail-closed to:
- `PORTAL_ADMIN`

Unknown and read-only roles cannot create recipients.

## Endpoint

`POST /api/v1/organization/recipients`

Required header:
- `Idempotency-Key: <non-empty UUID>`

Body must contain exactly:
- `displayName`
- `externalReference`
- `phone` (valid Iranian mobile or null/empty)
- `programId`

The browser/client cannot set:
- organizationId
- source
- match status
- matched account
- allocation/usage fields
- audit actor
- fingerprints

## Program lifecycle boundary

New enrollment is accepted only for:
- `REGISTERED`
- `ACTIVE`

It is rejected with 409 for:
- `DRAFT`
- `PAUSED`
- `ENDED`

A cross-tenant program id is 404.

This permission to enroll a person does not define or imply who may activate a
program.

## Identity/reference privacy

The raw organization reference is normalized in memory, then:
- only a masked value is stored for display
- a keyed HMAC-SHA256 pseudonym is stored for duplicate detection

The raw reference is not stored in Organization persistence.

The HMAC uses an independent environment secret:

`OrganizationRecipients:FingerprintKeyBase64`

It must decode to at least 32 bytes. Missing/invalid configuration makes manual
create return 503. OTP/authentication keys are not reused.

The optional phone is normalized using the Identity module's
`IranianMobileNumber`. It is used only for a verified-account lookup and is
not stored in the recipient row.

If a verified Hana account exists:
- match state = `MATCHED`
- matched account id is stored internally

Otherwise:
- match state = `NEEDS_MATCH`
- matched account id remains null

Neither phone nor matched account id is returned to the portal.

## Duplicate policy

The duplicate identity is scoped to:

`organization + program + external-reference pseudonym`

Therefore one organization reference can participate in multiple programs, but
cannot be enrolled twice in the same program.

Persian, Arabic and ASCII digit variants normalize to the same reference before
the keyed pseudonym is calculated.

## Idempotency

The key is unique inside the organization.

A creation fingerprint is also keyed and covers:
- organization
- target program
- display name
- normalized external reference
- normalized optional phone

Same key + same request:
- first request => 201
- replay => 200 with the same recipient

Same key + different request => 409.

Concurrent equal retries converge on one row.

A replay is evaluated before current program-state rules, so a lost successful
response can still be retried safely even if the program is paused later.

## Audit

New manual rows populate:
- creation_key
- creation_fingerprint
- reference_fingerprint
- created_by_account_id
- created/updated timestamps

Columns remain nullable for recipients that existed before this mutation
contract. Historical actors are not fabricated.

## Response

The mutation response uses the same privacy boundary as the recipient read API:
- display name
- masked reference
- source
- match state
- boolean Hana-account match
- linked program id/name/status
- timestamps

It does not expose raw references, phones, tenant ids, account ids, HMACs,
idempotency keys, allocation state or usage state.

## Next

Frontend 043 can safely re-enable the single-recipient Figma form through a
same-origin BFF with client-side idempotent retry.

Bulk CSV/XLSX import remains a separate contract.
