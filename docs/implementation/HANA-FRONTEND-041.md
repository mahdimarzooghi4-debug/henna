# Frontend 041 — Organization People & Recipients

## Scope

Connects the Figma **People & Recipients** screen to Backend 040.

The page now reads real tenant-scoped recipient records. It does not activate
recipient mutations, allocation, usage, wallet balances or entitlements.

## Route

`/organization/people`

The explicit page route replaces the previous sample-data rendering for this
screen.

Supported URL filters:
- page
- pageSize
- programId
- source
- matchStatus
- search

Invalid or duplicate parameters fail closed and render an invalid-query state.

## Server rendering

The page reads the HttpOnly Hana session cookie server-side and calls:

`GET /api/v1/organization/recipients`

The authenticated organization is never supplied by the browser.

## Browser BFF

`GET /api/organization/recipients`

The BFF:
- validates the same query allowlist
- reads the HttpOnly Hana session cookie
- forwards Bearer server-to-server
- parses the upstream response into a strict browser DTO
- returns no-store
- clears invalid sessions on 401

Unknown upstream fields are discarded rather than forwarded.

## Privacy boundary

Browser/SSR recipient data contains only:
- display name
- masked reference
- source
- match state
- boolean Hana-account match
- linked program id/name/status
- timestamps

It does not expose:
- organization_id
- matched_account_id
- raw identity data
- allocation state
- usage state
- wallet or entitlement data

## Figma table semantics

The Figma columns for allocation and usage remain visible, but Frontend 041
renders both as **هنوز متصل نشده** for every recipient.

This is deliberate: recipient enrollment and Hana-account matching do not prove
that credit was allocated or used.

## Mutation boundary

The visible "افزودن مشمول" control is disabled.

The old sample add-recipient form has also been replaced with a fail-closed
message. Backend 040 is read-only, so the frontend must not imply that manual
or CSV additions are persisted.

## Filters

- source: API / manual
- Hana match state
- related program among the currently visible result set
- literal name / masked-reference search

Pagination preserves the active filters.

## CI

The isolated HTTPS upstream smoke test verifies:
- authenticated SSR uses real recipient data
- sample recipient rows are gone
- source/match filters are server-backed
- literal masked-reference search
- program filter forwarding
- strict query allowlist and duplicate rejection
- 401 / 403 behavior
- organization and matched-account IDs do not reach browser JSON
- injected allocation/usage/internal fields are discarded
- allocation/usage UI remains explicitly unconnected
- direct add-recipient route cannot expose the old fake mutation form

## Next

Backend 042 can define recipient mutation semantics separately: manual add,
duplicate identity/reference policy, allowed program states, idempotency,
audit actor/time, and CSV import behavior.
