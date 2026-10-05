# Seller 016 — Activated Seller Panel and Commerce Operations

## Figma basis

Seller Panel page:

- page: `02 • Seller Panel` — `260:697`
- desktop dashboard: `SELLER / 01 Dashboard` — `258:6`

The Figma dashboard contains sample operational values for:
- orders
- inventory
- listings
- pricing
- settlements
- reports

Those sample values are design fixtures only and are not shipped as runtime data.

## Access boundary

The real panel route is:

`/seller`

The page does not trust client state to grant access.

Browser access goes through:

`GET /api/seller/access`

which is a Next BFF over:

`GET /api/v1/seller/access`

Backend access requires both:

1. Identity role `SELLER`
2. matching Seller application with:
   - `SUBMITTED`
   - review `APPROVED`
   - non-null activation timestamp

A verified account, an APPROVED review by itself, or a browser-only flag is insufficient.

## Seller access response

The backend returns only real persisted context:

- sellerAccess = true
- sellerPanelEnabled = true
- trackingCode
- activatedAtUtc
- storeName
- businessName
- offeringType
- activity province/city IDs
- capability readiness

Current capability readiness:

- dashboard = true
- orders = true only when IdentityDb + CommerceDb are configured; otherwise false
- listings = true for GOOD/BOTH sellers when CommerceDb is configured
- inventory = same readiness as listings
- pricing = same readiness as listings
- settlements = true when CommerceDb is configured
- reports = true when CommerceDb is configured

## Dashboard UI

The shell follows the Seller Dashboard Figma structure. The repository has no
separate approved Figma frame for order/return operations, so those operational
views reuse the current Henna tokens without claiming pixel-level Figma fidelity:

- seller identity/sidebar
- business-management heading
- active seller/business card
- seller navigation
- operational capability cards
- activation notice

The sidebar includes the Figma navigation labels, but routes without a connected backend are rendered disabled rather than linking to fake pages.

## Data honesty

Seller 016 deliberately does not render Figma sample values such as:

- sample order counts
- sample monetary totals
- sample inventory
- sample recent orders
- sample settlement values
- sample notifications

Unavailable modules show:

`هنوز متصل نشده`

When the backend reports `orders=true`, orders are backed by real commerce reads and commands. The seller can load
its own server-scoped orders, move `PAID → PREPARING → READY_FOR_PICKUP`,
and load its own incident/return list. For an approved damaged-item return the
seller can register first contact and then a door visit with a traceable
evidence reference. The buyer remains the only actor that confirms physical
return collection.

This prevents design data from being confused with production state.

## Registration status integration

After successful Seller 015 activation:

- `sellerAccessEnabled=true`
- `sellerPanelEnabled=true`

The registration status page turns the previously disabled panel control into a real link to `/seller`.

Before activation the control remains disabled.

## BFF

`GET /api/seller/access`

Validates:

- authenticated HttpOnly-cookie session
- upstream Seller access = true
- panel enabled = true
- tracking-code shape
- valid activation timestamp
- non-empty store/business name
- offering type
- exact capability readiness map

Bearer credentials remain server-to-server only.

## QA

### Backend

Seller activation integration now verifies:

- activation response reports panel enabled
- Seller access returns real business name
- dashboard capability enabled
- orders capability is true only when the commerce database/service is configured
- seller order/incident lists are scoped by SellerId before pagination
- support incident reads require current SUPPORT permission

### Web gateway

The secure-cookie smoke verifies:

- status before activation has panel disabled
- activation status has access + panel enabled
- `/api/seller/access` returns the exact capability contract
- no-store is preserved

### Chromium

The browser journey continues through:

`registration → submit → review status → activation → seller panel`

It proves:

- panel link is disabled before activation
- panel link becomes available after activation
- `/seller` opens
- real business/store names are rendered
- only still-unsupported capability cards are marked «هنوز متصل نشده»
- commerce data is loaded only after an explicit seller action
- order-state and return-contact commands use persisted idempotency
- no Figma sample metrics are required for the dashboard shell

## Platform scope

Seller panel is a responsive Web experience.

Release gates remain:

- backend
- web
- mobile typecheck
- Android native-link checks

iOS remains out of scope.

## Connected commerce BFF

Browser code never receives the bearer token. Seller commerce uses the
HttpOnly-cookie BFF under `/api/seller/commerce/*`, with an explicit route
allowlist, same-origin checks for writes, bounded request/response bodies and
UUID idempotency keys. An ambiguous 503 freezes the original key/body for a
safe retry; a known 409 reloads server state before a new decision.

## Connected seller business operations

For GOOD/BOTH sellers, the panel now connects existing commerce contracts for:

- seller-owned offers
- price and stock updates with expectedVersion
- published GOOD catalog lookup before creating a new offer
- read-only prepared settlements
- internal notifications and mark-read
- internal support ticket creation/history
- server-scoped operational report for order states, incident/refund totals and prepared-settlement breakdowns

Settlement states are deliberately shown as `READY_FOR_BANK_TRANSFER` or
`FINANCE_REVIEW_REQUIRED`; the UI never labels them paid. Bank transfer remains
an external integration.

Offers whose catalog product/category is later unpublished are removed from the
public offer API, while the seller can still see the stale own offer and cannot
silently republish it through the buyer catalog.

## Remaining seller scope

- service-listing write model for SERVICE-only sellers
- deactivation/suspension operator flow
- external bank settlement confirmation
- external logistics

## Non-scope

- fake order or finance data
- fabricated bank payment
- external logistics
- national-scale readiness
