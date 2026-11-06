#!/usr/bin/env python3
"""Install and exercise the separate Henna seller APK on a real Android Emulator.

The APK is CI-only debug-signed and built without an API origin or credentials.
This verifies native packaging, app separation, guest access gate, OTP form
validation and fail-closed behavior when SMS/API infrastructure is absent. It
does not claim real OTP delivery, seller activation or authenticated data.
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
BUYER_APK = ROOT / "apps/mobile-consumer/android/app/build/outputs/apk/release/app-release.apk"
SELLER_APK = ROOT / "apps/mobile-seller/android/app/build/outputs/apk/release/app-release.apk"


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


def package_name(apk: Path, aapt: str) -> str:
    output = execute(aapt, "dump", "badging", str(apk))
    match = re.search(r"package: name='([^']+)'", output)
    assert match, f"Cannot identify Android package in {apk}"
    return match.group(1)


def hierarchy():
    execute("adb", "shell", "uiautomator", "dump",
            "/sdcard/hana-seller-window.xml", timeout=45)
    raw = execute("adb", "exec-out", "cat",
                  "/sdcard/hana-seller-window.xml", timeout=20)
    root = ET.fromstring(raw)
    return root, "\n".join(
        value for node in root.iter() for key in ("text", "content-desc")
        if (value := node.attrib.get(key))
    )


def wait_screen(*phrases, timeout=110):
    end = time.monotonic() + timeout
    last = "<no UI hierarchy yet>"
    while time.monotonic() < end:
        try:
            _, last = hierarchy()
            if all(phrase in last for phrase in phrases):
                print("Observed seller UI: " + " / ".join(phrases), flush=True)
                return last
        except (subprocess.TimeoutExpired, ET.ParseError, AssertionError):
            pass
        time.sleep(2)
    raise AssertionError(
        f"Seller Android UI did not contain {phrases!r}. "
        f"Last accessibility hierarchy:\n{last[-7000:]}"
    )


def tap_text(label: str):
    root, _ = hierarchy()
    node = next(
        (item for item in root.iter() if item.attrib.get("text") == label),
        None,
    )
    assert node is not None, f"Seller UI control not found: {label}"
    coords = list(map(int, re.findall(r"\d+", node.attrib.get("bounds", ""))))
    assert len(coords) == 4, f"Seller UI control has no bounds: {label}"
    x1, y1, x2, y2 = coords
    execute("adb", "shell", "input", "tap",
            str((x1 + x2) // 2), str((y1 + y2) // 2))


def tap_phone_input():
    root, _ = hierarchy()
    node = next(
        (item for item in root.iter()
         if "EditText" in item.attrib.get("class", "")),
        None,
    )
    assert node is not None, "Seller phone input is not exposed as a native EditText"
    coords = list(map(int, re.findall(r"\d+", node.attrib.get("bounds", ""))))
    assert len(coords) == 4, "Seller phone input has no screen bounds"
    x1, y1, x2, y2 = coords
    execute("adb", "shell", "input", "tap",
            str((x1 + x2) // 2), str((y1 + y2) // 2))


def main():
    assert BUYER_APK.is_file(), f"Buyer APK not built: {BUYER_APK}"
    assert SELLER_APK.is_file(), f"Seller APK not built: {SELLER_APK}"
    sdk = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT")
    assert sdk, "Android SDK not present"
    tools = glob.glob(sdk + "/build-tools/*/aapt")
    assert tools, "Android aapt not installed"
    aapt = max(tools, key=lambda path: tuple(
        int(part) for part in Path(path).parent.name.split(".")
    ))

    buyer_package = package_name(BUYER_APK, aapt)
    seller_package = package_name(SELLER_APK, aapt)
    assert buyer_package != seller_package, (
        f"Buyer and seller APKs must be separate apps, both use {buyer_package}"
    )
    print(
        f"Buyer package={buyer_package}; seller package={seller_package}",
        flush=True,
    )

    execute("adb", "install", "-r", str(SELLER_APK), timeout=150)
    assert f"package:{seller_package}" in execute(
        "adb", "shell", "pm", "path", seller_package
    ), "Seller APK is not installed in Android package manager"
    execute("adb", "shell", "monkey", "-p", seller_package, "1", timeout=60)

    ui = wait_screen(
        "پیشخوان فروشنده حنا",
        "ورود به حساب فروشنده",
        "دریافت کد تأیید",
    )
    for forbidden in ("پیشخوان کسب‌وکار", "فروشنده فعال", "آمار عملیاتی",
                      "فروشگاه واقعی"):
        assert forbidden not in ui, (
            f"Guest seller session unexpectedly exposed private data: {forbidden}"
        )

    # Blank input is rejected locally before any network request.
    tap_text("دریافت کد تأیید")
    ui = wait_screen("شماره تلفن معتبر نیست.")
    assert "فروشگاه واقعی" not in ui

    # A syntactically valid number cannot produce an OTP when no API/SMS
    # origin is configured in this CI APK; the app must report unavailable.
    tap_phone_input()
    execute("adb", "shell", "input", "text", "09123456789")
    execute("adb", "shell", "input", "keyevent", "4")
    tap_text("دریافت کد تأیید")
    ui = wait_screen("سرویس پیامک یا ورود در دسترس نیست.")
    assert "ورود موفق" not in ui
    assert "پیشخوان کسب‌وکار" not in ui

    print(
        "PASS: separate seller APK installed and launched; guest gate, "
        "local OTP validation and no-API fail-closed UI verified",
        flush=True,
    )


try:
    main()
except Exception as exc:
    print(f"SELLER ANDROID SMOKE FAILED: {exc}", file=sys.stderr)
    try:
        logs = execute("adb", "logcat", "-d", "-s",
                       "ReactNativeJS:E", "AndroidRuntime:E",
                       timeout=30, check=False)
        print(logs[-11000:], file=sys.stderr)
    except Exception:
        pass
    raise
