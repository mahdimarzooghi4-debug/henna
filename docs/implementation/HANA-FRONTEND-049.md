# Frontend 049 — Organization Usage & Status

## Scope

Connects the Figma Usage & Status screen to Backend 048.

Route:
- `/organization/usage`

Figma:
- ORGPORTAL / 11 Usage & Status — node `386:1557`

## Production truth over sample data

The Figma frame contains sample:
- allocated-credit amount
- active-credit amount
- consumed-credit amount
- idle-credit amount
- beneficiary names/references
- per-beneficiary allocation/usage values
- usage states
- dates

Frontend 049 removes all of those sample values from shipping UI.

Backend 048 does not yet have a financial usage model, so the production screen
renders **در دسترس نیست** rather than zero.

Null is never presented as zero.

## Visual mapping

The Figma structure is preserved:
- organization/context + sync state
- four summary cards
- beneficiary usage table header
- status-oriented empty state

The sample table rows are replaced by one explicit unavailable empty-state.

## Strict browser contract

`organization-usage.ts` accepts only the exact Backend 048 shape:
- organizationType
- null sync timestamp
- unavailable summary with four null values
- unavailable/empty beneficiary usage
- NOT_CONFIGURED capability
- usage read model unavailable
- ledger unavailable

Unexpected keys, non-null monetary values, or beneficiary rows fail closed.

This prevents accidental future monetary fields from silently appearing in the
browser contract before the frontend is explicitly updated.

## SSR

The dedicated Organization Usage page loads in parallel:
- current organization profile
- usage capability/status

The HttpOnly session cookie is read only on the Next server. Bearer
authentication is server-to-server.

## Read BFF

`GET /api/organization/usage/status`

The BFF:
- accepts no query parameters
- reads only the HttpOnly Hana session cookie
- returns no-store
- clears an invalid session on 401
- exposes no mutation method
- returns only the strict parsed Backend 048 contract

## Financial boundary

The UI explicitly says:
- monetary usage read model unavailable
- ledger unavailable
- enrollment data is not converted into financial usage
- MATCHED recipient does not imply allocation or consumption

No amount, balance, usage percentage, allocation record, or last-usage date is
fabricated.

## Next

With Usage & Status no longer showing sample financial data, the next portal
surface to productionize is Reports.

Reports must follow the same rule: only metrics backed by current real read
models may be shown; monetary allocation/usage charts remain unavailable until
the financial domain exists.
