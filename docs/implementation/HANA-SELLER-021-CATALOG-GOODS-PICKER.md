# Seller 021 — Catalog Goods Picker Readiness

**Status:** Backlog and design readiness. No runtime code is included.

## Business scope

Henna currently supports supermarket goods only. Services are out of scope for this release.

Seller Offer identity and product media remain Catalog-owned. A seller can link an existing published Catalog good to a seller-owned draft offer. The seller cannot create product identity, edit Catalog content, upload product media, or make a draft buyer-visible.

A draft in this slice does not contain a price, unit, quantity, inventory, delivery promise, or publication state beyond `DRAFT`. Seller listings capability stays disabled until a real end-to-end flow is implemented and reviewed.

## Current design gap

The existing Add/Edit Listing references—desktop `261:184` and mobile `259:338`—show seller-entered name and category, an image upload control, pricing and physical inventory fields, plus service-specific controls. Those affordances do not match the approved Seller 020 API and product boundary.

The Seller list frames—desktop `261:10` and mobile `259:257`—may inform the entry point and list structure, but do not define the Catalog-selection interaction or its states. Implementation must wait for approved desktop and mobile Figma frames that resolve this gap. Do not infer the missing UI from API fields, add service flows, or create Admin UI.

## Target flow contract

The product/design deliverable should cover:

1. Seller enters the listing area from the existing Seller panel.
2. Seller opens the Catalog goods picker.
3. The picker shows only real Catalog `GOOD` records that are `PUBLISHED` and belong to a `PUBLISHED` category. Product title and media come from the Catalog read model; operator-reviewed Catalog media remains authoritative.
4. Seller selects one item and confirms adding it. The app sends only `catalogProductId` to `POST /api/v1/seller/offers` with a fresh UUID `Idempotency-Key`.
5. The result is a seller-owned `DRAFT` reference. Repeated same-key submission returns that same draft; the seller can see only their own drafts.
6. Loading, empty, Catalog unavailable, stale/ineligible item, unauthorized session, duplicate/retry, and successful-create states are specified in Figma and the implementation contract.

The current Seller 020 list response contains draft identity, Catalog product ID, state, revision, and timestamps. Before the seller's draft list can render meaningful Catalog cards, the follow-up technical design must choose a secure server-side way to pair those IDs with current published Catalog title and reviewed media. This enrichment must not create a cross-module database foreign key or copy mutable Catalog identity/media into Seller storage.

## Security and API boundary

- Browser requests use same-origin Next.js BFF routes and the HttpOnly session cookie.
- The bearer token is used only from the BFF to the API.
- Seller account identity is derived server-side from the active session and current Identity role assignment. The seller application must remain approved and activated.
- All seller reads remain account-scoped and use `Cache-Control: no-store`.
- Only product IDs are accepted for creation. Client-supplied title, image URL, kind, category, price, unit, quantity, inventory, account, status, or publication fields cannot influence persisted state.
- Public buyer Catalog responses never include Seller drafts.

## Acceptance criteria for implementation

- Approved desktop and mobile Figma frames cover entry point, picker, list/draft cards, and loading, empty, error, retry, stale-item, and success states.
- The browser interaction matches those approved frames and works with keyboard and mobile touch input.
- Only eligible published supermarket goods can be selected. Services, unpublished identities, unpublished categories, and non-Catalog products are absent or safely rejected.
- Create and list use the Seller 020 API through the strict same-origin BFF; no browser bearer token or arbitrary upstream URL is introduced.
- Same-key retries do not duplicate a draft; different-key submissions create independent drafts only when the seller explicitly selects and confirms again.
- Seller list/read behavior is account-scoped; no public buyer response exposes draft data.
- No price, unit, quantity, inventory, delivery, upload, service, edit, delete, publication, order, or payment behavior ships before its business contract is approved.
- PostgreSQL/API, web BFF, and browser interaction coverage exercise the relevant paths.
- Only backend, web, mobile, and Android are CI gates; iOS stays out of scope.

## Delivery sequence

1. Product/design approves desktop and mobile Figma selection frames.
2. Technical review specifies Catalog identity/media enrichment for Seller draft reads and the BFF route allowlist.
3. Scrum schedules the design-approved web/mobile implementation on top of Seller 020.
4. Code review, Stage verification, QA, release approval, production, monitoring, and improvement follow the project delivery process.

## Dependencies

- Seller 020 draft API: PR #94
- Catalog 006 reviewed media foundation: PR #91
- Product/design approval for the changed Seller selection experience

No runtime, schema, Seller capability flag, sample Catalog item, fake offer, or Figma design mutation is included in this readiness slice.
