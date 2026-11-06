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
