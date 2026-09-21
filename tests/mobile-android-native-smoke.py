#!/usr/bin/env python3
"""Android Emulator OS → installed Expo APK → actual React Native buyer UI.

No OCR/screenshot guesses, test seed, SMS token or production HTTP endpoint.
This test deliberately omits EXPO_PUBLIC_HANA_API_BASE_URL: the already
approved 503/unavailable UI must remain truthful without an API server.
"""
import glob
import os
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APK = ROOT / "apps/mobile-consumer/android/app/build/outputs/apk/release/app-release.apk"
BUYER_ID = "60000000-0000-4000-8000-000000000021"
TERM = "کالای پیوند آزمایشی"
BROWSE = "hana://browse?search=" + "%DA%A9%D8%A7%D9%84%D8%A7%DB%8C+%D9%BE%DB%8C%D9%88%D9%86%D8%AF+%D8%A2%D8%B2%D9%85%D8%A7%DB%8C%D8%B4%DB%8C" + "&page=2"
DETAIL = "hana://products/" + BUYER_ID + "?search=" + BROWSE.split("search=", 1)[1]


def execute(*args, timeout=45, check=True):
    result = subprocess.run(
        args, text=True, capture_output=True, errors="replace", timeout=timeout
    )
    if check and result.returncode != 0:
        raise AssertionError(
            f"Command failed: {args!r}\n"
            f"stdout={result.stdout[-3500:]}\nstderr={result.stderr[-3500:]}"
        )
    return result.stdout + result.stderr


def hierarchy():
    execute("adb", "shell", "uiautomator", "dump", "/sdcard/hana-window.xml",
            timeout=45)
    raw = execute("adb", "exec-out", "cat", "/sdcard/hana-window.xml",
                  timeout=20)
    root = ET.fromstring(raw)
    return "\n".join(
        value for node in root.iter() for key in ("text", "content-desc")
        if (value := node.attrib.get(key))
    )


def wait_screen(*phrases, timeout=110):
    end = time.monotonic() + timeout
    last = "<no UI hierarchy yet>"
    while time.monotonic() < end:
        try:
            last = hierarchy()
            if all(phrase in last for phrase in phrases):
                print("Observed native UI: " + " / ".join(phrases), flush=True)
                return last
        except (subprocess.TimeoutExpired, ET.ParseError, AssertionError):
            pass
        time.sleep(2)
    raise AssertionError(
        f"Real Android UI did not contain {phrases!r}. "
        f"Last accessibility hierarchy:\n{last[-7000:]}"
    )


def open_uri(uri, package):
    # DO NOT force an explicit -n component/-p package: that bypasses
    # Android's real URI intent resolution and could falsely pass.
    resolved = execute("adb", "shell", "cmd", "package", "resolve-activity",
                       "--brief", "-a", "android.intent.action.VIEW",
                       "-d", uri)
    assert package in resolved, (
        f"Installed APK did not register URI with Android: {uri}: {resolved}"
    )
    result = execute("adb", "shell", "am", "start", "-W",
                     "-a", "android.intent.action.VIEW", "-d", uri,
                     timeout=60)
    assert package in result, (
        f"OS did not launch app for URI: {uri}; am start={result}"
    )


def main():
    assert APK.is_file(), f"Native release APK not built: {APK}"
    sdk = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT")
    assert sdk, "Android SDK not present"
    tools = sorted(glob.glob(sdk + "/build-tools/*/aapt"))
    assert tools, "Android aapt not installed"
    badging = execute(tools[-1], "dump", "badging", str(APK))
    match = re.search(r"package: name='([^']+)'", badging)
    assert match, "Cannot identify built Android package"
    package = match.group(1)
    print(f"Installed APK package={package}, sha=CI native build", flush=True)
    execute("adb", "install", "-r", str(APK), timeout=150)

    # Actual Android app launch from a COLD-start external detail URI.
    execute("adb", "shell", "am", "force-stop", package)
    open_uri(DETAIL, package)
    ui = wait_screen("جزئیات کالا یا خدمت", "دریافت جزئیات تأیید نشد")
    assert "نشست شما فعال است" not in ui

    # Both native and app back behaviors return to public browse with the
    # genuine URI search, even when offline and no products are published.
    execute("adb", "shell", "input", "keyevent", "4")
    wait_screen("کالاها را در حنا مرور کنید", TERM)

    # A WARM app-link event must replace browse UI with the new detail
    # screen; no app restart, package state or Expo Go test double.
    open_uri("hana://browse?search=" + BROWSE.split("search=", 1)[1], package)
    wait_screen("کالاها را در حنا مرور کنید", TERM)
    open_uri("hana://products/" + BUYER_ID, package)
    wait_screen("جزئیات کالا یا خدمت", "دریافت جزئیات تأیید نشد")

    # Unapproved auth/admin routes must not steal the current buyer screen.
    open_uri("hana://auth", package)
    ui = wait_screen("جزئیات کالا یا خدمت")
    assert "ورود به حنا" not in ui

    # COLD-start browse URI should restore a real input, not just a
    # parsed-but-unused string in Node-only tests.
    execute("adb", "shell", "am", "force-stop", package)
    open_uri(BROWSE, package)
    wait_screen("کالاها را در حنا مرور کنید", TERM)
    print("PASS: installed Android native OS URI dispatch, cold/warm detail,"
          " Back to saved browse, invalid URI isolation and cold browse")


try:
    main()
except Exception as exc:
    print(f"ANDROID NATIVE SMOKE FAILED: {exc}", file=sys.stderr)
    try:
        logs = execute("adb", "logcat", "-d", "-s",
                       "ReactNativeJS:E", "AndroidRuntime:E",
                       timeout=30, check=False)
        print(logs[-11000:], file=sys.stderr)
    except Exception:
        pass
    raise
