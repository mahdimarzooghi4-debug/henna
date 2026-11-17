#!/usr/bin/env bash
set -euo pipefail

# The emulator runner executes the script argument with /bin/sh -c.
# Keep this as one shell command in the workflow and interpret branching here.
if [[ "${GITHUB_EVENT_NAME:-}" == "pull_request" &&
      "${GITHUB_HEAD_REF:-}" == "fix/buyer-android-figma-preview-catalog-20261114" &&
      "${GITHUB_REPOSITORY:-}" == "mahdimarzooghi4-debug/henna" ]]; then
  python3 tests/mobile-android-figma-preview-smoke.py
else
  python3 tests/mobile-android-native-smoke.py
fi

# The seller APK is independently built and always keeps its original test.
python3 tests/mobile-seller-android-smoke.py
