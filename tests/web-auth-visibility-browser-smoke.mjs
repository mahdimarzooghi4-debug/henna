/**
 * Real Chromium + production Next.js for cross-tab auth visibility recovery.
 * Route doubles below are CI-only, not product accounts, SMS or stored tokens.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const base = "http://127.0.0.1:3008";
const accountId = "6b2bc828-cf5d-4af7-a026-a653739d8509";
const challengeId = "fbf47579-71b4-4b85-996c-842ac497fb12";
const phone = "09123456789";
let web, browser, serverLogs = "", sessionReads = 0;
let otpRequests = 0, otpVerifies = 0;
let sessionReply = { status: 200,
  body: { authenticated: true, accountId } };

function json(body, status = 200) {
  return { status, contentType: "application/json",
    headers: { "Cache-Control": "no-store" },
    body: JSON.stringify(body) };
}

async function api(route) {
  const req = route.request();
  const url = new URL(req.url());
  if (url.pathname === "/api/auth/session" && req.method() === "GET") {
    sessionReads++;
    assert.equal(req.postData(), null);
    return route.fulfill(
      sessionReply.status === 204
        ? { status: 204 }
        : json(sessionReply.body, sessionReply.status),
    );
  }
  if (url.pathname === "/api/auth/otp/request" && req.method() === "POST") {
    assert.deepEqual(req.postDataJSON(), { phone });
    otpRequests++;
    return route.fulfill(json({ challengeId }, 202));
  }
  if (url.pathname === "/api/auth/otp/verify" && req.method() === "POST") {
    otpVerifies++;
    assert.deepEqual(req.postDataJSON(),
      { phone, code: "123456", challengeId });
    sessionReply = { status: 200,
      body: { authenticated: true, accountId } };
    return route.fulfill(json(
      { authenticated: true, accountId }, 200,
    ));
  }
  if (url.pathname === "/api/auth/session" && req.method() === "DELETE") {
    sessionReply = { status: 401,
      body: { authenticated: false } };
    return route.fulfill({ status: 204 });
  }
  throw Error("unexpected auth network request " +
    req.method() + " " + url.pathname);
}

async function launchNext() {
  web = spawn("npm", ["run", "start", "--workspace",
    "@hana/web-marketplace", "--", "-p", "3008", "-H", "127.0.0.1"],
  { detached: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } });
  web.stdout.on("data", value => { serverLogs += value.toString(); });
  web.stderr.on("data", value => { serverLogs += value.toString(); });
  for (let i = 0; i < 45; i++) {
    if (web.exitCode !== null)
      throw Error("Next stopped: " + serverLogs);
    try {
      if ((await fetch(base + "/auth", {
        signal: AbortSignal.timeout(1000),
      })).ok) return;
    } catch { /* startup */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw Error("Next never started: " + serverLogs);
}

async function main() {
  await launchNext();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    locale: "fa-IR",
  });
  await context.route("**/api/**", api);
  const page = await context.newPage();
  page.setDefaultTimeout(11000);
  const errors = [];
  page.on("pageerror", error => { errors.push(error.message); });

  // On mount only a real 200+valid body may render "authenticated".
  await page.goto(base + "/auth");
  await page.getByText("ورود انجام شده است", {
    exact: false,
  }).waitFor();
  assert.equal(sessionReads, 1);

  // A second real tab exercises the same page and browser state; deterministic
  // visibilitychange dispatch after bringToFront covers headless runners.
  const otherTab = await context.newPage();
  otherTab.setDefaultTimeout(11000);
  otherTab.on("pageerror", error => { errors.push(error.message); });
  await otherTab.goto(base + "/auth");
  await otherTab.getByText("ورود انجام شده است", {
    exact: false,
  }).waitFor();
  sessionReply = { status: 503,
    body: { message: "CI-only outage" } };
  await page.bringToFront();
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")));
  await page.getByText("بررسی وضعیت حساب فعلاً در دسترس نیست", {
    exact: false,
  }).waitFor();
  assert.equal(await page.getByText("ورود انجام شده است", {
    exact: false,
  }).count(), 0, "do not show stale authenticated success after 503");

  // 500 and a malformed 200 must not be treated as a confirmed sign-out or
  // confirmed login. Neither result may show editable phone/OTP or success.
  for (const failure of [
    { status: 500, body: { message: "CI-only error" } },
    { status: 200, body: { authenticated: true,
      accountId: "not-a-real-identity" } },
    { status: 200, body: { authenticated: false,
      accountId } },
    { status: 204 },
  ]) {
    sessionReply = failure;
    await page.getByRole("button", {
      name: "بررسی دوباره بدون ترک صفحه",
    }).click();
    await page.getByText("بررسی وضعیت حساب فعلاً در دسترس نیست", {
      exact: false,
    }).waitFor();
    assert.equal(await page.locator("#auth-phone").count(), 0);
    assert.equal(await page.getByText("ورود انجام شده است", {
      exact: false,
    }).count(), 0);
  }

  // Recover within the same document: HttpOnly cookie is validated again.
  sessionReply = { status: 200,
    body: { authenticated: true, accountId } };
  await page.getByRole("button", {
    name: "بررسی دوباره بدون ترک صفحه",
  }).click();
  await page.getByText("ورود انجام شده است", {
    exact: false,
  }).waitFor();
  const beforeManual = sessionReads;
  await page.getByRole("button", {
    name: "بررسی دوباره اعتبار نشست",
  }).click();
  await page.getByText("ورود انجام شده است", {
    exact: false,
  }).waitFor();
  assert.equal(sessionReads, beforeManual + 1);

  // Another tab revokes the cookie server-side. Returning to the old tab
  // must discard its stale session message and show a blank phone input.
  await otherTab.bringToFront();
  sessionReply = { status: 401,
    body: { authenticated: false } };
  const before401 = sessionReads;
  await page.bringToFront();
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")));
  await page.locator("#auth-phone").waitFor();
  assert.ok(sessionReads > before401);
  assert.equal(await page.getByText("ورود انجام شده است", {
    exact: false,
  }).count(), 0);
  assert.equal(await page.locator("#auth-phone").inputValue(), "");
  await page.waitForFunction(() =>
    document.activeElement?.id === "auth-phone");

  // Switching tabs MUST NOT wipe a partly entered OTP. A different tab can
  // only invalidate it at server verification, not by a visibility event.
  await page.locator("#auth-phone").fill("۰۹۱۲۳۴۵۶۷۸۹");
  await page.getByRole("button", {
    name: "دریافت کد تأیید",
  }).click();
  await page.locator("#auth-code").waitFor();
  await page.locator("#auth-code").fill("۱۲۳۴۵۶");
  const beforeOtpVisibility = sessionReads;
  await otherTab.bringToFront();
  await page.bringToFront();
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")));
  assert.equal(sessionReads, beforeOtpVisibility);
  assert.equal(await page.locator("#auth-code").inputValue(), "۱۲۳۴۵۶");
  assert.equal(await page.locator("#auth-phone").count(), 0);
  assert.equal(otpRequests, 1);

  await page.getByRole("button", {
    name: "تأیید کد و ورود",
  }).click();
  await page.getByText("ورود انجام شده است", {
    exact: false,
  }).waitFor();
  assert.equal(otpVerifies, 1);
  assert.equal(await page.evaluate(() => localStorage.length), 0);
  assert.deepEqual(errors, []);
  await context.close();
  console.log("Chromium web auth: real two-tab visible revalidation, fail-closed 503/500/malformed 200, 401 sign-out, untouched OTP, manual retry OK");
}

try {
  await main();
} finally {
  if (browser) await browser.close();
  if (web?.pid) {
    try { process.kill(-web.pid, "SIGTERM"); } catch { /* already exited */ }
  }
}
