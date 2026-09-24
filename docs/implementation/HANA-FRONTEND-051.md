# Frontend 051 — Organization Reports

## Scope

Connects the Figma Reports screen to Backend 050.

Route:
- `/organization/reports`

Figma:
- ORGPORTAL / 12 Reports — node `386:1690`

## Real matching KPI

The "وضعیت تطبیق افراد" card now renders real data:
- eligible Program count
- recipient enrollment-record count
- matched-record count
- needs-review count
- exact match rate

The visual progress bar is driven only by the backend match rate.

If the denominator is empty, the UI says the rate cannot be calculated. It
does not render 0%.

The metric is explicitly record-scoped, not a unique-person metric.

## Financial usage card

The Figma "بودجه استفاده‌شده" sample value/progress is removed.

Until a financial read model exists, the card shows:
- در دسترس نیست
- no percentage
- no monetary amount
- no fake progress fill

Null is not presented as zero.

## Allocation/distribution trend

All Figma sample periods and sample bars are removed.

The card keeps the visual chart area but renders a structured unavailable state
with reference grid lines only. No data bar is drawn.

## Strict browser contract

`organization-reports.ts` requires the exact Backend 050 shape.

It verifies:
- exact keys
- non-negative integer counts
- matched + needs-review = total
- null rate for zero denominator
- calculated rate consistency for non-empty denominator
- financial usage unavailable/null
- trend unavailable/empty
- capability flags remain false

Unexpected fields or inconsistent metrics fail closed.

## SSR

The dedicated Reports page loads:
- organization profile
- reports overview

in parallel.

Bearer authentication remains server-to-server. The browser never receives the
Hana Bearer session token.

## Read BFF

`GET /api/organization/reports/overview`

The BFF:
- accepts no query parameters
- reads only the HttpOnly Hana session cookie
- returns no-store
- clears invalid session on 401
- has no mutation method
- returns only the strict parsed report contract

## Sample-data removal

Shipping Reports no longer contains:
- وضعیت تطبیق: داده نمونه
- وضعیت استفاده: داده نمونه
- دوره نمونه ۱
- دوره نمونه ۲
- دوره مرداد
- دوره تیر
- fake financial bars

## Next

After Frontend 051, Reports is production-safe with one real KPI family
(matching) and explicit financial capability boundaries.

The next static Organization Portal surface to productionize is Notifications.
