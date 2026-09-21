/**
 * Frontend 011: real browser/keyboard UX for approved web buyer login.
 * All challenge IDs, phone numbers and OTP replies are in-memory CI ONLY.
 * This never sends a real SMS or writes a token to localStorage.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const base = "http://127.0.0.1:3007";
const phone = "09123456789";
const ids = [
  "6b2bc828-cf5d-4af7-a026-a653739d8509",
  "6b2bc828-cf5d-4af7-a026-a653739d8510",
  "6b2bc828-cf5d-4af7-a026-a653739d8511",
  "6b2bc828-cf5d-4af7-a026-a653739d8512",
];
let next;
let browser;
let nextLogs = "";
let sessionReads = 0;
let otpRequests = 0;
let verifyCalls = 0;
let loggedIn = false;

function json(body, status = 200) {
  return {
    status, contentType: "application/json",
    headers: { "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}

async function fakeApi(route) {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  if (path === "/api/auth/session" && request.method() === "GET") {
    sessionReads++;
    assert.equal(request.postData(), null);
    if (sessionReads === 1) return route.fulfill(json({}, 503));
    return route.fulfill(json(
      loggedIn ? { authenticated: true, accountId: ids[0] } : {},
      loggedIn ? 200 : 401,
    ));
  }
  if (path === "/api/auth/session" && request.method() === "DELETE") {
    loggedIn = false;
    return route.fulfill({ status: 204 });
  }
  if (path === "/api/auth/otp/request" && request.method() === "POST") {
    assert.deepEqual(request.postDataJSON(), { phone },
      "OTP request must not contain previous challenge or UI PII");
    otpRequests++;
    switch (otpRequests) {
      case 1: return route.fulfill(json({ challengeId: ids[0] }, 202));
      case 2: return route.fulfill(json({}, 429));
      case 3: return route.fulfill(json({ challengeId: ids[1] }, 202));
      case 4: return route.fulfill(json({}, 503));
      case 5: return route.fulfill(json({ challengeId: ids[2] }, 202));
      case 6: return route.fulfill(json({}, 202));
      case 7: return route.fulfill(json({ challengeId: ids[3] }, 202));
      default: throw Error("Unexpected extra OTP request " + otpRequests);
    }
  }
  if (path === "/api/auth/otp/verify" && request.method() === "POST") {
    const data = request.postDataJSON();
    assert.deepEqual(
      { phone: data.phone, challengeId: data.challengeId },
      { phone, challengeId: ids[3] },
      "Old challenge must never verify after an uncertain resend");
    verifyCalls++;
    if (data.code === "999999")
      return route.fulfill(json({}, 400));
    if (data.code === "888888")
      return route.fulfill(json({}, 429));
    assert.equal(data.code, "123456");
    loggedIn = true;
    return route.fulfill(json({ authenticated: true, accountId: ids[0] }));
  }
  throw Error("Unexpected intercepted API route: " +
    request.method() + " " + path);
}

async function startNext() {
  next = spawn("npm", ["run", "start", "--workspace",
    "@hana/web-marketplace", "--", "-p", "3007", "-H", "127.0.0.1"],
  { detached: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } });
  next.stdout.on("data", value => { nextLogs += value.toString(); });
  next.stderr.on("data", value => { nextLogs += value.toString(); });
  for (let i = 0; i < 45; i++) {
    if (next.exitCode !== null)
      throw Error("Next stopped before ready: " + nextLogs);
    try {
      if ((await fetch(base + "/auth", {
        signal: AbortSignal.timeout(1000),
      })).ok) return;
    } catch { /* startup */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw Error("Next never started: " + nextLogs);
}

async function main() {
  await startNext();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 }, locale: "fa-IR",
  });
  await context.route("**/api/**", fakeApi);
  const page = await context.newPage();
  page.setDefaultTimeout(11000);
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto(base + "/auth");
  await page.getByText("بررسی وضعیت حساب فعلاً در دسترس نیست", {
    exact: false,
  }).waitFor();
  assert.equal(await page.locator("#auth-phone").count(), 0,
    "503 session must not imply signed-out");
  await page.evaluate(() => {
    window.__authRetrySameDocument = true;
  });
  await page.getByRole("button", {
    name: "بررسی دوباره بدون ترک صفحه",
  }).click();
  await page.locator("#auth-phone").waitFor();
  assert.equal(await page.evaluate(() =>
    window.__authRetrySameDocument), true,
  "a retry must not reload and discard auth form memory");
  assert.equal(sessionReads, 2);
  await page.waitForFunction(() =>
    document.activeElement?.id === "auth-phone");
  assert.equal(
    await page.evaluate(() =>
      document.documentElement.scrollWidth <= window.innerWidth),
    true, "existing approved auth card must fit a 375px mobile browser");

  await page.locator("#auth-phone").fill("۰۹۱۲۳۴۵۶۷۸۹");
  await page.getByRole("button", { name: "دریافت کد تأیید" }).click();
  await page.locator("#auth-code").waitFor();
  await page.waitForFunction(() =>
    document.activeElement?.id === "auth-code");
  assert.equal(otpRequests, 1);
  await page.locator("#auth-code").fill("۱۲۳۴۵۶");
  await page.getByRole("button", { name: "درخواست کد جدید" }).click();
  await page.getByText("درخواست مجدد زود است", {
    exact: false,
  }).waitFor();
  assert.equal(await page.locator("#auth-code").inputValue(),
    "۱۲۳۴۵۶", "429 must keep old user-entered code");
  assert.equal(await page.locator("#auth-code").count(), 1);
  assert.equal(otpRequests, 2);

  await page.getByRole("button", { name: "درخواست کد جدید" }).click();
  await page.getByText("کد قبلی دیگر معتبر نیست", {
    exact: false,
  }).waitFor();
  await page.waitForFunction(() =>
    document.activeElement?.id === "auth-code");
  assert.equal(await page.locator("#auth-code").inputValue(), "");
  assert.equal(otpRequests, 3);

  await page.locator("#auth-code").fill("۹۹۹۹۹۹");
  await page.getByRole("button", { name: "درخواست کد جدید" }).click();
  await page.getByText("کد قبلی ممکن است باطل شده باشد", {
    exact: false,
  }).waitFor();
  await page.locator("#auth-phone").waitFor();
  await page.waitForFunction(() =>
    document.activeElement?.id === "auth-phone");
  assert.equal(await page.locator("#auth-code").count(), 0);
  assert.equal(await page.locator("#auth-phone").inputValue(), phone);
  assert.equal(otpRequests, 4);
  assert.equal(verifyCalls, 0);

  await page.getByRole("button", { name: "دریافت کد تأیید" }).click();
  await page.locator("#auth-code").waitFor();
  assert.equal(otpRequests, 5);
  await page.locator("#auth-code").fill("۱۲۳۴۵۶");
  await page.getByRole("button", { name: "درخواست کد جدید" }).click();
  await page.getByText("کد قبلی ممکن است باطل شده باشد", {
    exact: false,
  }).waitFor();
  assert.equal(await page.locator("#auth-code").count(), 0,
    "malformed 202 does NOT mean the OTP is usable");
  assert.equal(otpRequests, 6);
  assert.equal(verifyCalls, 0);

  await page.getByRole("button", { name: "دریافت کد تأیید" }).click();
  await page.locator("#auth-code").waitFor();
  await page.locator("#auth-code").fill("123");
  await page.getByRole("button", { name: "تأیید کد و ورود" }).click();
  await page.getByText("کد تأیید باید شش رقم باشد.").waitFor();
  assert.equal(verifyCalls, 0);
  assert.equal(await page.locator("#auth-code").getAttribute(
    "aria-invalid"), "true");
  assert.match(await page.locator("#auth-code").getAttribute(
    "aria-describedby"), /auth-feedback/);
  assert.equal(await page.locator("#auth-feedback").getAttribute(
    "role"), "alert");

  await page.locator("#auth-code").fill("999999");
  await page.getByRole("button", { name: "تأیید کد و ورود" }).click();
  await page.getByText("کد یا اطلاعات تأیید معتبر نیست.").waitFor();
  assert.equal(verifyCalls, 1);
  await page.locator("#auth-code").fill("888888");
  await page.getByRole("button", { name: "تأیید کد و ورود" }).click();
  await page.getByText("تعداد تلاش‌ها زیاد است", {
    exact: false,
  }).waitFor();
  assert.equal(verifyCalls, 2);
  assert.equal(await page.locator("#auth-code").inputValue(),
    "888888");
  await page.locator("#auth-code").fill("۱۲۳۴۵۶");
  await page.getByRole("button", { name: "تأیید کد و ورود" }).click();
  await page.getByText("ورود انجام شده است", {
    exact: false,
  }).waitFor();
  assert.equal(verifyCalls, 3);
  assert.equal(await page.locator("#auth-code").count(), 0);
  assert.equal(await page.locator("#auth-phone").count(), 0);
  assert.equal(await page.evaluate(() => localStorage.length), 0,
    "never persist account/OTP data in localStorage");
  await page.getByRole("button", { name: "خروج از حساب" }).click();
  await page.locator("#auth-phone").waitFor();
  await page.waitForFunction(() =>
    document.activeElement?.id === "auth-phone");
  assert.equal(await page.locator("#auth-phone").inputValue(), "");
  assert.equal(loggedIn, false);
  assert.deepEqual(pageErrors, []);
  await context.close();
  console.log("Chromium web auth: 503 retry without reload → focused 202 → 429 → new 202 → unknown send → malformed 202 → six-digit/errors → sign-in/out OK");
}

try {
  await main();
} finally {
  if (browser) await browser.close();
  if (next?.pid) {
    try { process.kill(-next.pid, "SIGTERM"); } catch { /* stopped */ }
  }
}
