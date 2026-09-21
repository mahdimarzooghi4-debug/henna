/**
 * Frontend 009 — REAL Chromium interaction test for Figma-approved
 * buyer login and seller step one, against the production Next build.
 *
 * All identities, OTP challenges, locations and drafts below are CI-only
 * in-memory browser-route doubles. They are NEVER shipped or seeded into
 * Hana's production services. Existing separate smoke tests exercise the
 * real Next BFF against isolated HTTPS upstreams and real PostgreSQL.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const base = "http://127.0.0.1:3006";
const phone = "09123456789";
const challengeId = "6b2bc828-cf5d-4af7-a026-a653739d8509";
const provinceId = "4ef06bf5-32f3-4b10-a41e-5bd69f6bb442";
const cityId = "fbf47579-71b4-4b85-996c-842ac497fb12";
const province = { id: provinceId, name: "استان مرورگر CI", slug: "ci-province" };
const city = { id: cityId, provinceId,
  name: "شهر مرورگر CI", slug: "ci-city" };

let web;
let browser;
let webLogs = "";
let signedIn = false;
let draft = null;
let writes = 0;
let provinceReads = 0;
let cityReads = 0;
let apiRequests = 0;

function json(data, status = 200) {
  return { status, contentType: "application/json; charset=utf-8",
    headers: { "Cache-Control": "no-store" }, body: JSON.stringify(data) };
}

async function fakeApi(route) {
  const req = route.request();
  const url = new URL(req.url());
  const path = url.pathname;
  apiRequests++;
  if (path === "/api/auth/session" && req.method() === "GET")
    return route.fulfill(json(
      signedIn ? { authenticated: true, accountId: cityId } : {},
      signedIn ? 200 : 401));
  if (path === "/api/auth/otp/request" && req.method() === "POST") {
    const body = req.postDataJSON();
    assert.deepEqual(body, { phone });
    return route.fulfill(json({ challengeId }, 202));
  }
  if (path === "/api/auth/otp/verify" && req.method() === "POST") {
    const body = req.postDataJSON();
    assert.deepEqual(body, { phone, challengeId, code: "123456" });
    signedIn = true;
    return route.fulfill(json({ authenticated: true, accountId: cityId }));
  }
  if (path === "/api/seller/registration" && req.method() === "GET")
    return route.fulfill(json(
      signedIn ? draft ?? {} : {},
      !signedIn ? 401 : draft ? 200 : 404));
  if (path === "/api/seller/registration" && req.method() === "PUT") {
    assert.ok(signedIn, "anonymous form must never PUT seller PII");
    writes++;
    const body = req.postDataJSON();
    assert.equal(body.phone, phone);
    if ((draft?.revision ?? 0) !== body.revision)
      return route.fulfill(json({ message: "stale" }, 409));
    draft = { ...body, revision: body.revision + 1, status: "DRAFT" };
    return route.fulfill(json({
      status: "DRAFT", revision: draft.revision,
    }));
  }
  if (path === "/api/geography/provinces" && req.method() === "GET") {
    provinceReads++;
    return route.fulfill(json({ items: [province] }));
  }
  if (path === "/api/geography/cities" && req.method() === "GET") {
    assert.equal(url.searchParams.get("provinceId"), provinceId);
    assert.equal([...url.searchParams].length, 1);
    cityReads++;
    return route.fulfill(json({ items: [city] }));
  }
  throw Error("Unexpected browser API request: " + req.method() + " " +
    url.pathname);
}

async function startWeb() {
  web = spawn("npm", ["run", "start", "--workspace",
    "@hana/web-marketplace", "--", "-p", "3006", "-H", "127.0.0.1"],
  { detached: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } });
  web.stdout.on("data", b => { webLogs += b.toString(); });
  web.stderr.on("data", b => { webLogs += b.toString(); });

  for (let n = 0; n < 45; n++) {
    if (web.exitCode !== null)
      throw Error("Next exited before ready: " + webLogs);
    try {
      if ((await fetch(base + "/seller/register", {
        signal: AbortSignal.timeout(1000),
      })).ok) return;
    } catch { /* wait */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw Error("Next never started: " + webLogs);
}

async function main() {
  await startWeb();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1365, height: 900 },
    locale: "fa-IR",
  });
  await context.route("**/api/**", fakeApi);
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const pageErrors = [];
  page.on("pageerror", err => { pageErrors.push(err.message); });

  // Signed-out seller must redirect to the EXACT approved web auth flow;
  // it cannot edit a draft, guess revision zero or invent an authenticated UI.
  await page.goto(base + "/seller/register");
  await page.getByText("برای ذخیره پیش‌نویس ابتدا").waitFor();
  assert.equal(await page.locator("#store-name").isDisabled(), true);
  assert.equal(writes, 0);
  await page.getByRole("link", { name: "وارد حساب حنا شوید" }).click();
  await page.waitForURL("**/auth?returnTo=%2Fseller%2Fregister");
  await page.locator("#auth-phone").fill("۰۹۱۲۳۴۵۶۷۸۹");
  await page.getByRole("button", { name: "دریافت کد تأیید" }).click();
  await page.locator("#auth-code").fill("۱۲۳۴۵۶");
  await page.getByRole("button", { name: "تأیید کد و ورود" }).click();
  await page.waitForURL("**/seller/register");
  await page.locator("#store-name").waitFor({ state: "visible" });
  await page.locator("#store-name").waitFor({ state: "attached" });
  await page.waitForFunction(() =>
    !document.querySelector("#store-name")?.hasAttribute("disabled"));
  assert.equal(writes, 0);

  // Real form DOM: all six errors simultaneously, with accessible input
  // associations, and focus moved to the first invalid field.
  await page.getByRole("button", { name: "ثبت اطلاعات و ادامه" }).click();
  for (const field of [
    "store-name", "owner-name", "seller-phone", "city",
    "store-address", "postal-code",
  ]) {
    assert.equal(await page.locator("#" + field)
      .getAttribute("aria-invalid"), "true", field);
    assert.equal(await page.locator("#" + field + "-error")
      .count(), 1, field);
    assert.match(await page.locator("#" + field)
      .getAttribute("aria-describedby"), new RegExp(field + "-error"));
  }
  assert.equal(await page.locator(":focus").getAttribute("id"),
    "store-name");
  assert.equal(writes, 0, "invalid form must not submit a PUT");

  await page.locator("#store-name").fill("فروشگاه مرورگر");
  await page.locator("#owner-name").fill("مسئول مرورگر");
  await page.locator("#seller-phone").fill(phone);
  await page.locator("#store-address").fill("نشانی مرورگر");
  await page.locator("#postal-code").fill("۱۲۳۴۵۶۷۸۹۰");

  // Real public reference is lazy, explicit and does NOT auto-save.
  assert.equal(provinceReads, 0);
  await page.getByRole("button", {
    name: "راهنمای اختیاری استان و شهر",
  }).click();
  await page.getByLabel("استان مرجع").selectOption(provinceId);
  await page.getByLabel("شهر مرجع").selectOption(cityId);
  assert.equal(provinceReads, 1);
  assert.equal(cityReads, 1);
  assert.equal(writes, 0);
  await page.getByRole("button", {
    name: "نوشتن شهر و استان در فرم",
  }).click();
  assert.equal(await page.locator("#city").inputValue(),
    "شهر مرورگر CI، استان مرورگر CI");
  assert.equal(writes, 0);
  assert.equal(await page.locator(".seller-unsaved-note").count(), 1);
  await page.getByRole("button", { name: "ثبت اطلاعات و ادامه" }).click();
  await page.getByText("اطلاعات اولیه به‌عنوان پیش‌نویس ذخیره شد", {
    exact: false,
  }).waitFor();
  assert.equal(writes, 1);
  assert.equal(draft.revision, 1);
  assert.equal(draft.postalCode, "1234567890");
  assert.equal(draft.city, "شهر مرورگر CI، استان مرورگر CI");
  assert.equal(await page.locator(".seller-unsaved-note").count(), 0);

  // Real concurrent Chromium tabs share a CI-only revisioned seller draft.
  // Tab B edits a different field AND the same city field. Tab A must be
  // able to retain independent edits while explicitly deciding city conflict.
  const otherTab = await context.newPage();
  otherTab.setDefaultTimeout(10000);
  otherTab.on("pageerror", err => { pageErrors.push(err.message); });
  await otherTab.goto(base + "/seller/register");
  await otherTab.waitForFunction(() =>
    document.querySelector("#store-name")?.value === "فروشگاه مرورگر");
  await page.locator("#store-name").fill("فروشگاه پنجره اول");
  await page.locator("#city").fill("شهر پنجره اول");
  await otherTab.locator("#owner-name").fill("مسئول پنجره دوم");
  await otherTab.locator("#city").fill("شهر پنجره دوم");
  await otherTab.getByRole("button", {
    name: "ذخیره تغییرات پیش‌نویس",
  }).click();
  await otherTab.getByText("اطلاعات اولیه به‌عنوان پیش‌نویس ذخیره شد",
    { exact: false }).waitFor();
  assert.equal(draft.revision, 2);
  await page.getByRole("button", {
    name: "ذخیره تغییرات پیش‌نویس",
  }).click();
  await page.getByRole("heading", {
    name: "تعارض نسخهٔ پیش‌نویس",
  }).waitFor();
  assert.equal(await page.locator("#store-name").isDisabled(), true);
  assert.equal(await page.getByRole("button", {
    name: "ترکیب انتخاب‌های هر فیلد در فرم",
  }).isDisabled(), true);
  assert.equal(await page.getByText("برای ترکیب فیلدها باید", {
    exact: false,
  }).count(), 1);

  await page.getByRole("group", {
    name: /انتخاب نسخه برای شهر \/ منطقه/,
  }).getByRole("radio", { name: "متن این پنجره" }).check();
  await page.getByRole("button", {
    name: "ترکیب انتخاب‌های هر فیلد در فرم",
  }).click();
  assert.equal(writes, 3, "reconciliation must not auto-POST a draft");
  assert.equal(await page.locator("#store-name").inputValue(),
    "فروشگاه پنجره اول");
  assert.equal(await page.locator("#owner-name").inputValue(),
    "مسئول پنجره دوم");
  assert.equal(await page.locator("#city").inputValue(),
    "شهر پنجره اول");
  await page.getByRole("button", {
    name: "ذخیره تغییرات پیش‌نویس",
  }).click();
  await page.getByText("اطلاعات اولیه به‌عنوان پیش‌نویس ذخیره شد",
    { exact: false }).waitFor();
  assert.equal(draft.revision, 3);
  assert.equal(draft.storeName, "فروشگاه پنجره اول");
  assert.equal(draft.ownerName, "مسئول پنجره دوم");
  assert.equal(draft.city, "شهر پنجره اول");

  // A normal Next link must ask before losing text. Declining stays put.
  await page.locator("#store-address").fill("نشانی ذخیره نشده");
  assert.equal(await page.locator(".seller-unsaved-note").count(), 1);
  let confirmCount = 0;
  page.once("dialog", async dialog => {
    assert.equal(dialog.type(), "confirm");
    confirmCount++;
    await dialog.dismiss();
  });
  await page.getByRole("link", {
    name: "ورود / ثبت‌نام", exact: true,
  }).click();
  assert.equal(confirmCount, 1);
  assert.equal(new URL(page.url()).pathname, "/seller/register");
  assert.equal(await page.locator("#store-address").inputValue(),
    "نشانی ذخیره نشده");
  assert.deepEqual(pageErrors, []);
  assert.ok(apiRequests > 10, "browser must exercise actual client UI");
  await context.close();
  console.log("Chromium CI frontend: OTP → seller draft → 6 field errors → real geography helper → two-tab 409/merge → unsaved guard OK");
}

try {
  await main();
} catch (error) {
  console.error("Chromium frontend journey failed:", error);
  if (browser) {
    for (const context of browser.contexts()) {
      for (const page of context.pages()) {
        try {
          await page.screenshot({
            path: "/tmp/hana-frontend-browser-failure.png",
            fullPage: true,
          });
          break;
        } catch { /* preserve original error */ }
      }
    }
  }
  throw error;
} finally {
  if (browser) await browser.close();
  if (web?.pid) {
    try { process.kill(-web.pid, "SIGTERM"); } catch { /* exited */ }
  }
}
