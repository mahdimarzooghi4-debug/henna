# Frontend 022 — iOS Simulator native custom-scheme buyer links

## Scope / previously approved UI

No new screen or product contract: the already owner-approved browse frames (Frontend 010/015/016) and public product detail 200/404/unavailable frames (Frontend 017/018) are tested on a **native installed iOS Simulator app**, extending Android Emulator CI in Frontend 021. `hana://` was already registered in Expo app.json by the previous work. No HTTPS App/Universal Link domain, iOS App Store bundle identity or production signing material is invented.

## Reproducible CI flow

A distinct `ios-native-links` job on GitHub-hosted `macos-26` (Expo SDK 57 requires Xcode 26.4+):

1. Node 22, Java 17, monorepo dependencies, `npx expo prebuild --platform ios --no-install`, and CocoaPods installation. Generated `ios/` remains ignored and ephemeral.
2. `xcodebuild` creates an **unsigned Release configuration for iOS Simulator with JS embedded**, with `CODE_SIGNING_ALLOWED=NO`. This is not a downloadable App Store/release-signed IPA.
3. Boot an available iOS 26 iPhone simulator. Inspect the generated `Info.plist` for `CFBundleURLSchemes=hana`, install the actual `.app` via `xcrun simctl install`, and open custom links with `xcrun simctl openurl` rather than forcing a bundle identifier launch.
4. Pinned Maestro CLI (2.7.0) observes real native **accessibility UI** via tests `ios-buyer-detail-native.yaml` / `ios-buyer-browse-native.yaml`. On first OS custom-link launch, iOS can show an `Open in “حنا”?` security confirmation; the test explicitly accepts it, then asserts actual detail title and honest unavailable status (no public API config), back to preserved Persian search, warm detail/browse navigation, invalid auth path isolation, and cold-start browse state.

CI only uses a no-API, no-secrets simulator install. It does not inject a fictitious product into shipping, alter SMS state or claim 200 production inventory/price. On failed native tests, 2-day CI diagnostics are available to debug actual hierarchy (not OCR guesses).

## Limits

No actual Apple/iOS hardware, production push/notification permissions, device signing, IPA publishing, full gestures/visual snapshot review, domain-backed Universal Links, seller offers, checkout or payment. Existing CI client/backend tests cover 200/404/503 and publication boundaries separately.
