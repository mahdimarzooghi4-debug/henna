# Backend 032 — Organization Identity, Membership & Profile API

## Business

Organization Portal must never infer organization access from a successful login.
An authenticated Hana account can read organization data only when an explicit,
active organization membership exists.

## Technical

A new PostgreSQL schema and EF context named `organization` is introduced with
independent migration history.

Tables:
- `organization.organizations`
- `organization.memberships`

The membership links an Identity account to an organization. The migration adds
a database FK to `identity.accounts`; no Identity secret or phone is copied to
the Organization schema.

The current Figma portal has no organization switcher. Until a multi-org UX is
designed, the database permits at most one active organization membership per
account.

## API

`GET /api/v1/organization/me`

Requirements:
- valid, non-revoked Bearer session
- explicit active organization membership
- active organization

Responses:
- `200`: organization profile + current member role
- `401`: missing/invalid/revoked session
- `403`: authenticated account without active organization access
- `503`: database unavailable/unconfigured

All responses that may contain organization data use `Cache-Control: no-store`.

## Security boundaries

- no test token minting endpoint
- no organization selected through a request header
- no production seed data
- no allocation, beneficiary, ledger, report, or support-ticket claims
- no access granted by seller status or ordinary account existence

## Next backlog

1. Next.js same-origin Organization BFF using HttpOnly session cookie.
2. Wire Profile/header to `GET /api/v1/organization/me`.
3. Add organization programs and people read models.
4. Add allocation workflows only after their domain rules are approved.
