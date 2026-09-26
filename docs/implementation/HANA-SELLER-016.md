# Seller 016 — Activated Seller Panel Shell

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
- orders = false
- listings = false
- inventory = false
- pricing = false
- settlements = false
- reports = false

## Dashboard UI

The shell follows the Seller Dashboard Figma structure:

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
- orders capability remains disabled

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
- six unsupported operational modules are marked «هنوز متصل نشده»
- no Figma sample metrics are required for the dashboard shell

## Platform scope

Seller panel is a responsive Web experience.

Release gates remain:

- backend
- web
- mobile typecheck
- Android native-link checks

iOS remains out of scope.

## Next slices

The shell intentionally leaves operational modules disabled until each obtains a real backend contract.

Likely next vertical slice:

- Seller Orders read model and list/detail flow

## Non-scope

- fake order data
- catalog write operations
- inventory mutation
- pricing mutation
- settlement data
- reports
- deactivation/suspension
