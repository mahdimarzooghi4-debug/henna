# Henna native Android review on Render (Appetize embed)

This page is a standalone **Android APK review shell**, not an Expo Web conversion or a Production application. It is bound to the historical CI-only debug APK release `hana-mobile-preview-1666-1` (commit `df4c68b690082252f85e9da2d6ddd1140d0e3864`), with separate buyer and seller APKs. It contains no real seller data, OTP integration, payment capability or login credentials.

The owner requested that the **actual Android binary** be run in a browser for interactive page-by-page Figma review. Appetize must stream a real Android emulator; Render only hosts this front-end embed page. First upload the buyer and seller APKs through `https://appetize.io/upload` under the owner's separate Appetize account. Appetize account API permissions or secret keys are not available to this project; no upload is made from GitHub CI, no credentials are committed, and no app/build identifier is invented.

Once each APK upload completes, copy its Appetize Share URL (`https://appetize.io/app/<buildId>` or `https://appetize.io/embed/<buildId>`) into the corresponding tab on this review page. The link is validated against the exact `appetize.io` HTTPS origin and format, then stored **only in that browser's localStorage** for convenience. No build IDs are stored on Render or in GitHub. The iframe loads `https://appetize.io/embed/<buildId>`, and the direct session URL is available as a fallback. Other browsers/users must separately supply their own authorized links.

**Security:** by default Appetize Build Identifier URLs are accessible to anyone holding the link. The owner should restrict `run` permission to signed-in organization members under Appetize Organization Session Defaults or build-level App Permissions before using any non-demo data. This review uses a debug/preview APK and must never include production credentials or real commerce. A Render public URL is not access control. A launch is not equivalent to Stage, QA acceptance, release approval or Production. iOS Native remains out of scope.

**Static Render configuration** (for user-approved review only):
- repo: `mahdimarzooghi4-debug/henna`
- branch: `feat/seller-mobile-001-access-orders`
- build command: `test -s tools/native-app-review/index.html && echo 'Native review shell ready'`
- publish directory: `tools/native-app-review`
- autoDeploy: off

**Review procedure:** open the review page on a desktop browser, choose buyer/seller, enter Appetize Share URL, navigate through the actual APK, compare against the exact approved Figma frame and state, report deviations, amend native source in a Draft PR with tests, generate a *new* APK and update its Appetize build link for recheck. Do not conflate the different device font/layout behavior with Expo web. Existing staged preview web services are not replaced by this review shell.
