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


def dismiss_known_emulator_launcher_anr(root):
    """Close only a known Android emulator launcher ANR, never a Henna error.

    A fresh AOSP emulator may show a launcher system dialog above a healthy
    installed APK; asserting the app UI without dismissing it is a false negative.
    """
    observed = set(v for n in root.iter()
                   for key in ("text", "content-desc")
                   if (v := n.attrib.get(key)))
    known = {"Quickstep isn't responding", "Pixel Launcher isn't responding"}
    if not (observed & known):
        return False
    choice = next(
        (n for n in root.iter()
         if n.attrib.get("text") == "Close app" or
         n.attrib.get("content-desc") == "Close app"), None)
    if choice is None:
        choice = next(
            (n for n in root.iter()
             if n.attrib.get("text") == "Wait" or
             n.attrib.get("content-desc") == "Wait"), None)
    if choice is None:
        return False
    coords = list(map(int, re.findall(r"[0-9]+", choice.attrib.get("bounds", ""))))
    if len(coords) != 4:
        return False
    x1,y1,x2,y2 = coords
    execute("adb", "shell", "input", "tap", str((x1+x2)//2), str((y1+y2)//2))
    print("Dismissed known Android emulator launcher ANR (not app under test)",flush=True)
    time.sleep(2)
    return True


def inspect(*terms, seconds=80):
    end = time.monotonic() + seconds
    last = "<no hierarchy>"
    while time.monotonic() < end:
        try:
            root = nodes()
            last = labels(root)
            if dismiss_known_emulator_launcher_anr(root):
                continue
            if all(t in last for t in terms):
                print("Native preview visible: " + " / ".join(terms), flush=True)
                return
        except (subprocess.TimeoutExpired, ET.ParseError, AssertionError):
            pass
        time.sleep(2)
    raise AssertionError(f"Missing native preview UI {terms!r}; last={last[-4200:]}")


def tap(name, scroll=True):
    """Touch only a *visible* target, never the fixed bottom navigation under checkout.

    UiAutomator may report a clipped/barely-visible text row as a node. Earlier
    generic clicks on checkout's lower radio rows hit the underlying 'سبد'
    tab and navigated back to cart, without pressing the requested control.
    This strict geometry gate fails closed if a visible target cannot be found.
    """
    last = "<no hierarchy>"
    screen = execute("adb", "shell", "wm", "size")
    size = re.search(r"([0-9]+)x([0-9]+)", screen)
    if not size:
        raise AssertionError("Android display dimensions unavailable: " + screen)
    width, height = map(int, size.groups())
    for attempt in range(12 if scroll else 3):
        try:
            root = nodes()
            last = labels(root)
            if dismiss_known_emulator_launcher_anr(root):
                continue
            candidates = [n for n in root.iter()
                          if n.attrib.get("content-desc") == name or n.attrib.get("text") == name]
            # Prefer the actual accessibility control rather than a nested text child.
            candidates.sort(key=lambda n: (n.attrib.get("content-desc") != name,
                                           n.attrib.get("clickable") != "true"))
            for node in candidates:
                coords = list(map(int, re.findall(r"[0-9]+", node.attrib.get("bounds", ""))))
                if len(coords) != 4:
                    continue
                x1,y1,x2,y2 = coords
                x,y = (x1+x2)//2,(y1+y2)//2
                # For scrollable checkout/buttons, reserve space for the
                # 84dp fixed bottom tab bar and OS navigation area.
                lower = int(height * .84) if scroll else int(height*.98)
                if not (0 <= x < width and int(height*.07) < y < lower):
                    print(f"Native control {name!r} outside safe viewport at y={y}/{height}; scrolling", flush=True)
                    continue
                print(f"Native preview tapping {name!r} at ({x},{y}) attempt={attempt}", flush=True)
                execute("adb","shell","input","tap",str(x),str(y))
                return
        except (subprocess.TimeoutExpired,ET.ParseError,AssertionError):
            pass
        if scroll:
            execute("adb", "shell", "input", "swipe", str(width//2), str(int(height*.72)),
                    str(width//2), str(int(height*.25)), "450")
        time.sleep(1)
    raise AssertionError(f"Cannot safely tap native {name!r}; last={last[-4000:]}")


def tap_first_prefix(prefix, scroll=True):
    """Tap the first visible genuine native accessibility control with this prefix."""
    last = "<no hierarchy>"
    for _ in range(9 if scroll else 3):
        try:
            root = nodes()
            if dismiss_known_emulator_launcher_anr(root):
                continue
            last = labels(root)
            for node in root.iter():
                label = node.attrib.get("content-desc", "")
                if not label.startswith(prefix):
                    continue
                coords = list(map(int, re.findall(r"[0-9]+", node.attrib.get("bounds", ""))))
                if len(coords) != 4:
                    continue
                x1, y1, x2, y2 = coords
                if x2 <= x1 or y2 <= y1:
                    continue
                execute("adb", "shell", "input", "tap", str((x1+x2)//2), str((y1+y2)//2))
                print("Native preview touched " + label, flush=True)
                return
        except (subprocess.TimeoutExpired, ET.ParseError, AssertionError):
            pass
        if scroll:
            execute("adb", "shell", "input", "swipe", "520", "1550", "520", "510", "380")
        time.sleep(1)
    raise AssertionError(f"Cannot tap prefix {prefix!r}; last={last[-3200:]}")


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
    # Press the actual footer action above the Android system navigation bar,
    # not merely the sheet close button. Applying offline sample filters must
    # dismiss the modal and keep the catalog in the foreground.
    tap("نمایش کالاها", scroll=False)
    inspect("کالاها و خدمات")
    assert "فیلتر کالاها" not in labels(nodes()), "Filter modal did not close after Apply"
    tap("فیلتر پیشرفته", scroll=False)
    inspect("فیلتر کالاها", "نمایش کالاها")
    tap("بستن پنل فیلتر", scroll=False)
    inspect("کالاها و خدمات")

    tap("بازگشت به خانه", scroll=False)
    inspect("به حنا خوش آمدید")

    # Complete the same native Figma journey beyond the previous dead end.
    # Absolutely no provider, bank, real wallet, address or order service is used.
    tap("همه پیشنهادها")
    inspect("کالاها و خدمات")
    tap_first_prefix("افزودن ")
    tap("سبد خرید", scroll=False)
    inspect("مقایسه فروشگاه‌ها")
    screenshot("cart")
    tap("مقایسه فروشگاه‌ها")
    inspect("تمرین ادامه خرید با فروشگاه نمونه")
    tap("تمرین ادامه خرید با فروشگاه نمونه")
    inspect("ادامه ثبت سفارش")
    tap("ادامه ثبت سفارش")
    inspect("آدرس نمونه — فقط برای نمایش طراحی")
    screenshot("checkout")

    # Figma 227:549 has three distinct payment choices, plus a legal invoice toggle.
    # These are visual-only choices, not payment or credit authorizations.
    tap("درگاه آنلاین بانکی")
    inspect("ثبت سفارش", seconds=15)
    tap("اعتبار حمایتی موجود")
    inspect("ثبت سفارش", seconds=15)
    tap("اعتبار شخصی تأمین‌شده توسط کاربر")
    inspect("ثبت سفارش", seconds=15)
    screenshot("payments")
    tap("مشاهده نتیجه سفارش نمونه (بدون پرداخت)")
    inspect("ثبت سفارش", seconds=15)
    inspect("سفارش نمونه در تمرین ثبت شد.", seconds=80)
    screenshot("order-success")
    tap("پیگیری سفارش نمونه")
    inspect("سفارش نمونه محله")
    screenshot("order-tracking")
    assert "شماره موبایل خود را وارد کنید" not in labels(nodes()), "Unexpected OTP"
    print("PASS: installed offline Android Figma home/catalog/filters/cart/checkout/payment choices/sample success/tracking with no OTP, API or payment", flush=True)


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
