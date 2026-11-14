#!/usr/bin/env python3
"""Owner's actual offline Figma buyer APK: icon -> home -> catalog -> filter.

Tests the INSTALLED Android native APK and real touchscreen/accessibility UI.
No OCR, test API, payment, real authentication, or emulated Figma HTML.
"""
import glob
import os
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APK = ROOT / "apps/mobile-consumer/android/app/build/outputs/apk/release/app-release.apk"


def execute(*args, timeout=55):
    p = subprocess.run(args, text=True, capture_output=True, errors="replace", timeout=timeout)
    if p.returncode:
        raise AssertionError(f"Command failed {args!r}: {p.stdout[-2000:]} {p.stderr[-2000:]}")
    return p.stdout


def nodes():
    execute("adb", "shell", "uiautomator", "dump", "/sdcard/henna-preview-window.xml", timeout=30)
    raw = execute("adb", "exec-out", "cat", "/sdcard/henna-preview-window.xml", timeout=20)
    return ET.fromstring(raw)


def labels(root):
    return " | ".join(v for n in root.iter()
                    for key in ("text", "content-desc")
                    if (v := n.attrib.get(key)))


def inspect(*terms, seconds=80):
    end = time.monotonic() + seconds
    last = "<no hierarchy>"
    while time.monotonic() < end:
        try:
            last = labels(nodes())
            if all(t in last for t in terms):
                print("Native preview visible: " + " / ".join(terms), flush=True)
                return
        except (subprocess.TimeoutExpired, ET.ParseError, AssertionError):
            pass
        time.sleep(2)
    raise AssertionError(f"Missing native preview UI {terms!r}; last={last[-4200:]}")


def tap(name, scroll=True):
    last = "<no hierarchy>"
    for i in range(8 if scroll else 3):
        try:
            root = nodes()
            last = labels(root)
            node = next((n for n in root.iter()
                         if n.attrib.get("content-desc") == name or n.attrib.get("text") == name), None)
            if node is not None:
                coords = list(map(int, re.findall(r"[0-9]+", node.attrib.get("bounds", ""))))
                if len(coords) == 4:
                    x1, y1, x2, y2 = coords
                    execute("adb", "shell", "input", "tap", str((x1+x2)//2), str((y1+y2)//2))
                    return
        except (subprocess.TimeoutExpired, ET.ParseError, AssertionError):
            pass
        if scroll:
            execute("adb", "shell", "input", "swipe", "520", "1550", "520", "510", "380")
        time.sleep(1)
    raise AssertionError(f"Cannot tap native {name!r}; last={last[-4000:]}")


def screenshot(stage):
    path = ROOT / "tests" / f".hana-figma-android-{stage}.png"
    with open(path, "wb") as f:
        subprocess.run(["adb", "exec-out", "screencap", "-p"], stdout=f, timeout=30, check=True)
    assert path.stat().st_size > 10000
    print(f"HANA_FIGMA_NATIVE_SCREENSHOT={path.name}, bytes={path.stat().st_size}", flush=True)


def main():
    assert APK.is_file(), "Buyer APK was not compiled"
    sdk = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT")
    assert sdk, "Android SDK missing"
    aapt = sorted(glob.glob(sdk + "/build-tools/*/aapt"))
    assert aapt, "Android aapt missing"
    badging = execute(aapt[-1], "dump", "badging", str(APK))
    pkg = re.search(r"package: name='([^']+)'", badging)
    assert pkg, "Invalid APK manifest"
    package = pkg.group(1)
    execute("adb", "install", "-r", str(APK), timeout=150)

    # The approved preview must work without an API, OTP, or network services.
    execute("adb", "shell", "svc", "wifi", "disable")
    execute("adb", "shell", "svc", "data", "disable")
    execute("adb", "shell", "monkey", "-p", package, "1", timeout=50)
    inspect("به حنا خوش آمدید", seconds=115)
    home = labels(nodes())
    assert "شماره موبایل خود را وارد کنید" not in home, "Unexpected OTP gate"
    screenshot("home")

    tap("همه پیشنهادها")
    inspect("کالاها و خدمات")
    inspect("نمونه کالا")
    catalog = labels(nodes())
    assert "دریافت کالاها تأیید نشد" not in catalog, "Preview must not request API"
    screenshot("catalog")

    tap("فیلتر پیشرفته", scroll=False)
    inspect("فیلتر کالاها", "نمایش کالاها")
    screenshot("filter")
    tap("بستن پنل فیلتر", scroll=False)
    inspect("کالاها و خدمات")

    tap("بازگشت به خانه", scroll=False)
    inspect("به حنا خوش آمدید")
    print("PASS: real installed offline Android Figma home/catalog/filter navigation; no OTP or API", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        try:
            logs = execute("adb", "logcat", "-d", "-s", "ReactNativeJS:E", "AndroidRuntime:E", timeout=25)
            print("NATIVE_ERROR_LOGS " + logs[-6000:], flush=True)
        except Exception:
            pass
        raise
