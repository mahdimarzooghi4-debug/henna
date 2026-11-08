# Seller Mobile 001 — native seller access and read-only orders

## Scope change authorized by the owner
On 2026-11-06 the owner explicitly requested separate buyer and seller applications. The previous README architecture has a consumer-only native app and seller web panel. This branch starts an independent Android seller app; the existing buyer app and web seller panel remain untouched. iOS Native remains deferred (ADR-049). No merge or production authorization is implied.

## Source and UI scope
New design reference: Figma file DVExfCo8ziZnf5ULDTOqer, seller mobile dashboard node 259:8, page 260:697.
The older canonical Figma file uREafnhmH5dDRwPraBOmuk remains the historical reference for existing buyer and seller web screens. Full reconciliation of the new copy is pending.

The four order/inventory/incident metrics and inventory warning examples in Figma are dummy values: never show them in runtime. The first Android mobile screen follows the broad RTL dashboard/header/nav hierarchy but explicitly displays unavailable metrics and connects only real, read-only orders. This is NOT a pixel-fidelity/asset-complete implementation of Figma; remaining icons and screen variants require a dedicated visual review.

## Live contracts and security
- Expo workspace: apps/mobile-seller, unique app scheme, independent SecureStore key hana.seller.session.v1.
- Reuse the existing MobileAuthClient for OTP and session validation. Never clone its security logic or share the consumer app's token storage.
- GET /api/v1/seller/access requires SELLER role, submitted and approved registration, activated seller, and no suspension, all validated server-side. The client validates all capability fields and rejects contradictory states.
- GET /api/v1/seller/orders?page=N is scoped to the authenticated seller by the backend. The app uses the existing strict staff commerce parser with exact page, order state, line quantity and price integrity checks.
- Only an HTTPS production API origin is accepted; local HTTP is development-only. No bearer in public Expo config, URLs, logs or UI. 401 invalidates only a matching token; 403 denies seller access without erasing a valid user session. Outage/malformed response never becomes an empty list or authorized state.
- Private content is hidden immediately on foreground before session and seller-role revalidation.
- Orders are read-only. No order transition, settlement, bank, provider dispatch or fabricated financial operation; future mobile mutations need persisted idempotency, ACK-loss recovery, and explicit test coverage.

## Verification and remaining gates
- The mobile job typechecks the new app, exercises transport/guard/DTO tests, and exports the Android JS bundle.
- The Android native job builds separate buyer and seller APKs from their committed Expo configurations. Both are CI-only debug-signed artifacts, not store-ready releases.
- The seller APK is built with `EXPO_PUBLIC_HANA_API_BASE_URL` explicitly unset, installed into the Android Emulator, and checked for a distinct package ID, real native launch, guest-only access gate, local phone validation, and fail-closed OTP behavior when no API/SMS origin exists.
- The buyer APK continues through its independent installed-APK Android intent and native UI smoke test.
- These checks do NOT prove real SMS delivery, an authenticated production seller session, seller activation or suspension against a live environment, real seller/PostgreSQL order data, bank or logistics integration, complete Figma fidelity, Stage or Production readiness.

Future slices: authenticated seller APK smoke against an isolated PostgreSQL-backed API with an explicitly controlled test identity and no external SMS; native seller product/listing read models and prices; order details and separately governed mutations; incident handling; external provider gates. Keep PR Draft/Open and do not merge/deploy without explicit approval.

## Android preview UX remediation (2026-11-08)
- Preview builds show a clear no-SMS entry for buyers, using a local SecureStore flag that persists until explicit logout. Backend identity is **not** fabricated and cart/order/wallet operations remain protected.
- Seller preview is an isolated local shell with **no store identity, order fetch, payout access or fabricated metrics**. It is not seller activation or authorized sign-in; live seller operations still require verified credentials and an active server-side seller role.
- Buyer and seller explicitly request dark status bar text/icons against their light headers.
- Seller launcher assets are regenerated deterministically from the already approved emblem: edge-connected cream canvas is removed, the square is filled teal, and Android adaptive foreground is transparent on a teal background.
- Generated launcher files are prepared before native prebuild; the original approved source icon is retained unchanged for auditability.
- All changes stay in development PR until exact-head CI, Android Emulator checks, and the owner release gate pass. Old downloaded APKs are not updated in-place.

### Historical launcher contract — superseded (2026-11-08)

This replaces the previous **no-lettering** proposal. The owner explicitly requires the visible Persian brand word **«حنا» INSIDE both launcher icons**. Both icons must use the same approved pictorial emblem and the same brand word, with no added slogan, store glyph, outer black stroke or black/cream border. The buyer icon has a full-bleed cream (`#FFF2E3`) background. The seller icon has a full-bleed deep teal (`#055247`) background, with no cream corners.

The deterministic icon generator uses the historical, already committed emblem and crops the existing repository brand wordmark from `hana-cart-logo.png` **above the subtitle**. It regenerates **both** normal 512px square icons and their transparent Android adaptive foregrounds **before Expo prebuild**, ensuring Android launcher masks do not create a black halo. The source assets are not overwritten. Tests assert edge pixels, shared artwork, transparent adaptive corners, and nonempty emblem and Persian word regions.

This does not authorize a public APK or an untested release. CI, installed Android APK visual check, a newly signed build and explicit owner release approval remain mandatory.


### Latest owner decision — pictorial-only launcher icons (2026-11-08)

The owner explicitly **reverses and supersedes** the previous wordmark-inside-icon direction above: buyer and seller launcher icons must contain **only the pictorial Henna emblem**, with no visible written «حنا», English/Persian lettering, slogan, subtitle, or invented badge. The OS label under an icon is separate app metadata and remains unchanged.

The deterministic `tools/mobile/generate-seller-icons.mjs` isolates the original approved pictorial mark and now composites only that emblem, never reading the repository's wordmark source. Both 512px normal launcher icons share the same artwork, centered on their approved full-bleed colors: buyer cream `#FFF2E3`, seller deep teal `#055247`. Both Android adaptive foregrounds contain the same centered emblem with transparent surrounding pixels, independently backed by the Android background colors. Expo now points to `hana-buyer-icon-only.png` and `hana-seller-icon-only.png`. Original historical sources remain unchanged.

The CI generator runs before Expo native prebuild. Regression tests check consistent symbols, center-only placement with no separate text area, exact edge colors, transparency and PNG geometry. Previously installed APKs are not automatically updated; new Android builds, visual QA, and explicit human release approval are required. iOS Native remains out of scope. No merge or deploy is authorized.
