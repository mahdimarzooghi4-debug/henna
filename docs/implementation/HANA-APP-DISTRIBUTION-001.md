# HANA-APP-DISTRIBUTION-001 — Website buyer download and seller handoff

## Product contract — owner direction (2026-11-06)
- Buyer app: a visible, public, first-party download section on the marketplace home page and an accessible `/download` route. Site navigation and footer also link to it.
- Seller app: share the stable website route `/seller/app` with a seller after **review APPROVED + explicit activation + current SELLER role + no suspension**. Link navigation is not a credential or implicit approval. Seller signs in and the BFF rechecks authoritative status on each attempt.
- A human may send the website route to the seller through an authorized channel after activation. This scope implements **no automatic SMS, email, notification delivery, account-to-phone dispatch or provider integration**.
- The 2026-11-06 seller app build is still a Draft PR #194; neither app's Android APK is hereby released.

## Real release assets (not supplied)
Two independent, server-only environment inputs will be set **only after** explicit release approval, verification of the signed official artifact or trusted store listing, and registration of a real HTTPS URL:
- `HANA_BUYER_ANDROID_APPROVED_URL`
- `HANA_SELLER_ANDROID_APPROVED_URL`

No APK binary, domain, download URL, signing key, Play Store application identifier, CI artifact or release approval is invented. Missing/invalid URL => no download action, never a placeholder link. Each link must be checked by deployment owner against exact approved artifact/digest and destination before configuration. Website must never expose a debug-signed/CI-only APK as a consumer release.

## Authorization and lifecycle
Seller registration APPROVED is only review; activation is a separate admin action. Existing authoritative `GET /api/v1/seller/registration/status` computes `sellerAccessEnabled` by checking live RoleAuthorization and no active suspension. Server BFF `GET /api/seller/mobile-download` passes only session-cookie bearer, confirms APPROVED, activation timestamp, role-derived access booleans and reviewed status before returning the configured release URL; no-store and fail-closed on error/unauthorized/partial payload. A suspended seller immediately loses BFF access, even if they saved the route.

The URL itself is **not** a DRM-protected or one-time private object. If a seller forwards an approved artifact URL, another person may be able to download the bytes; that does not grant seller account access, since the mobile app checks server-side role and activation. True private per-seller delivery/expiring links would need a separately specified signed-distribution contract and storage provider.

## Verification
- Pure policy tests cover HTTPS-only URL acceptance and rejected incomplete seller approvals.
- Next HTTPS upstream gateway smoke tests anonymous rejection, approval-only denial, active release availability, suspension revocation, invalid payload denial, and public buyer page visibility.
- Android native APK/emulator tests remain in PR #194 and are a separate readiness gate.
- No merge, Stage, Release Approval or Production deployment without explicit owner direction.
