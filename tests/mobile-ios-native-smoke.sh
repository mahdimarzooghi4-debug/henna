#!/usr/bin/env bash
# Installed iOS Simulator app, actual OS custom scheme, native accessibility via
# Maestro (no screenshot OCR or direct calls into JavaScript route functions).
set -euo pipefail

: "${HANA_IOS_SIM_ID:?booted iOS simulator required}"
APP="/tmp/hana-ios-derived/Build/Products/Release-iphonesimulator"
app_bundle=$(find "$APP" -maxdepth 1 -name '*.app' -type d -print -quit)
test -n "$app_bundle"
bundle=$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$app_bundle/Info.plist")
test -n "$bundle"

# Verify the generated native Info.plist registers the scheme; testing a
# simctl launch by bundle identifier alone would bypass this OS-level gate.
python3 - "$app_bundle/Info.plist" <<'PY'
import plistlib
import sys
with open(sys.argv[1], 'rb') as file:
    metadata = plistlib.load(file)
schemes = [
    scheme
    for item in metadata.get("CFBundleURLTypes", [])
    for scheme in item.get("CFBundleURLSchemes", [])
]
assert "hana" in schemes, "Generated iOS application does not register hana: " + str(schemes)
print("Native iOS Info.plist confirms URL scheme hana")
PY

xcrun simctl install "$HANA_IOS_SIM_ID" "$app_bundle"
xcrun simctl get_app_container "$HANA_IOS_SIM_ID" "$bundle" app >/dev/null
echo "Installed actual simulator .app: $bundle"
TERM='%DA%A9%D8%A7%D9%84%D8%A7%DB%8C+%D9%BE%DB%8C%D9%88%D9%86%D8%AF+%D8%A2%D8%B2%D9%85%D8%A7%DB%8C%D8%B4%DB%8C'
ID='60000000-0000-4000-8000-000000000021'

# Cold launch via the OS; not simctl launch <bundle> or Expo Go.
xcrun simctl terminate "$HANA_IOS_SIM_ID" "$bundle" 2>/dev/null || true
# Maestro starts its iOS XCTest driver before executing its flow. Opening
# before driver bootstrap is unreliable: XCTest can foreground SpringBoard
# and discard the initial scene. The first flow step invokes openLink only
# after the driver is ready, while the app remains terminated (cold).
echo "Cold detail link will be delivered by native Maestro openLink after XCTest boot"
maestro --device "$HANA_IOS_SIM_ID" test -e "APP_ID=$bundle" \
  tests/ios-buyer-detail-native.yaml

xcrun simctl terminate "$HANA_IOS_SIM_ID" "$bundle" 2>/dev/null || true
echo "Cold browse link will be delivered by native Maestro openLink after XCTest boot"
maestro --device "$HANA_IOS_SIM_ID" test -e "APP_ID=$bundle" \
  tests/ios-buyer-browse-native.yaml

echo "PASS: installed iOS simulator native scheme, cold/warm detail, UI back, invalid route and cold browse"
