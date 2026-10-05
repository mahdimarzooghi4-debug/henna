import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const base = "http://127.0.0.1:3017";
const ORDER = "60000000-0000-4000-8000-000000000021";
const INCIDENT = "60000000-0000-4000-8000-000000000022";
const ITEM = "60000000-0000-4000-8000-000000000023";
const PRODUCT = "60000000-0000-4000-8000-000000000024";
const EVIDENCE = "60000000-0000-4000-8000-000000000025";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
  "base64");

let web, browser, logs = "";
let orderState = "PAID", orderVersion = 1, contactAt = null;
let supportState = "UNDER_REVIEW", supportRefund = 0;
let firstDecision = null, decisionAttempts = 0;

function json(data, status = 200) {
  return { status, contentType: "application/json; charset=utf-8",
    headers: { "Cache-Control": "no-store" }, body: JSON.stringify(data) };
}
function order() {
  return {
    id: ORDER, state: orderState, refundState: "NONE",
    version: orderVersion, totalRial: 1800,
    createdAtUtc: "2026-10-05T03:00:00Z",
    items: [{ productId: PRODUCT, productName: "کالای مرورگر",
      quantity: 1, unitPriceRial: 1800, refundedQuantity: 0 }],
  };
}
function incident(state = supportState) {
  return {
    id: INCIDENT, orderId: ORDER, orderItemId: ITEM,
    type: "DAMAGED_ITEM", quantity: 1, evidenceId: EVIDENCE,
    state, reportedAtUtc: "2026-10-05T03:05:00Z",
    approvedAtUtc: state === "AWAITING_RETURN" ? "2026-10-05T03:20:00Z" : null,
    returnDueAtUtc: state === "AWAITING_RETURN" ? "2026-10-05T04:20:00Z" : null,
    firstContactAtUtc: contactAt, doorVisitAtUtc: null,
    collectedAtUtc: null, penaltyApplied: false,
    refundRial: state === "AWAITING_RETURN" ? supportRefund : 0,
  };
}

async function startWeb() {
  web = spawn("npm", ["run","start","--workspace","@hana/web-marketplace",
    "--","-p","3017","-H","127.0.0.1"], {
      detached: true, stdio: ["ignore","pipe","pipe"],
      env: {...process.env, NEXT_TELEMETRY_DISABLED:"1"},
    });
  web.stdout.on("data", value => logs += value);
  web.stderr.on("data", value => logs += value);
  for (let i = 0; i < 45; i++) {
    if (web.exitCode !== null) throw Error(logs);
    try { if ((await fetch(base + "/auth")).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw Error(logs);
}

async function main() {
  await startWeb();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(String(error)));

  await page.route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === "/api/seller/access" && request.method() === "GET")
      return route.fulfill(json({
        sellerAccess: true, sellerPanelEnabled: true,
        trackingCode: "HNA-A1B2C3D4E5F60718",
        activatedAtUtc: "2026-10-05T02:00:00Z",
        storeName: "فروشگاه مرورگر", businessName: "کسب‌وکار مرورگر",
        offeringType: "GOOD",
        capabilities: { dashboard:true, orders:true, listings:false,
          inventory:false, pricing:false, settlements:false, reports:false },
      }));

    if (path === "/api/seller/commerce/orders" && request.method() === "GET") {
      assert.equal(url.searchParams.get("page"), "1");
      return route.fulfill(json([order()]));
    }
    if (path === "/api/seller/commerce/returns" && request.method() === "GET") {
      assert.equal(url.searchParams.get("page"), "1");
      return route.fulfill(json([{
        ...incident("AWAITING_RETURN"),
        refundRial: 1800,
        approvedAtUtc: "2026-10-05T03:10:00Z",
        returnDueAtUtc: "2026-10-05T04:10:00Z",
      }]));
    }
    if (path === "/api/seller/commerce/orders/" + ORDER + "/state" &&
        request.method() === "POST") {
      assert.deepEqual(request.postDataJSON(),
        { expectedVersion: 1, state: "PREPARING" });
      assert.match(request.headers()["idempotency-key"],
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      orderState = "PREPARING";
      orderVersion = 2;
      return route.fulfill(json(order()));
    }
    if (path === "/api/seller/commerce/returns/" + INCIDENT + "/contact" &&
        request.method() === "POST") {
      assert.deepEqual(request.postDataJSON(),
        { evidenceReference: "CI-call-log" });
      contactAt = "2026-10-05T03:30:00Z";
      return route.fulfill(json({
        incident: {...incident("AWAITING_RETURN"), refundRial: 1800},
        evidence: "CI-call-log",
      }));
    }

    if (path === "/api/support/commerce/incidents" && request.method() === "GET")
      return route.fulfill(json([incident()]));
    if (path === "/api/support/commerce/evidence/" + EVIDENCE &&
        request.method() === "GET")
      return route.fulfill({
        status: 200, contentType: "image/png",
        headers: { "Cache-Control": "no-store" }, body: png,
      });
    if (path === "/api/support/commerce/incidents/" + INCIDENT + "/decision" &&
        request.method() === "POST") {
      decisionAttempts++;
      const current = {
        key: request.headers()["idempotency-key"],
        body: request.postData(),
      };
      if (decisionAttempts === 1) {
        firstDecision = current;
        return route.fulfill(json({ message: "unknown outcome" }, 503));
      }
      assert.deepEqual(current, firstDecision,
        "ambiguous retry must retain exact key and body");
      assert.deepEqual(request.postDataJSON(),
        { decision: "APPROVE", reason: "مدرک تصویری بررسی شد" });
      supportState = "AWAITING_RETURN";
      supportRefund = 1800;
      return route.fulfill(json({
        incident: incident(),
        reason: "مدرک تصویری بررسی شد",
      }));
    }

    throw Error("Unexpected API request: " + request.method() + " " + path);
  });

  await page.goto(base + "/seller");
  await page.getByRole("heading", {
    name: "پیشخوان مدیریت کسب‌وکار",
  }).waitFor();
  await page.getByRole("button", { name: "بارگیری عملیات" }).click();
  await page.getByText("کالای مرورگر", { exact: true }).waitFor();
  await page.getByRole("button", { name: "شروع آماده‌سازی" }).click();
  await page.getByText("در حال آماده‌سازی", { exact: true }).first().waitFor();
  await page.getByRole("button", { name: "اعلام آماده دریافت" }).waitFor();

  const reference = page.getByPlaceholder(
    "مثلاً شماره ثبت داخلی یا یادداشت قابل پیگیری");
  await reference.fill("CI-call-log");
  await page.getByRole("button", { name: "ثبت تماس اول" }).click();
  await page.getByRole("button", { name: "ثبت مراجعه حضوری" }).waitFor();

  await page.goto(base + "/support");
  await page.getByRole("heading", {
    name: "بررسی گزارش آسیب و کسری",
  }).waitFor();
  const evidence = page.getByAltText("تصویر خصوصی پیوست گزارش خریدار");
  await evidence.waitFor();
  await evidence.evaluate(image => new Promise((resolve, reject) => {
    if (image.complete && image.naturalWidth > 0) return resolve(true);
    image.addEventListener("load", () => resolve(true), { once: true });
    image.addEventListener("error", () => reject(new Error("evidence failed")),
      { once: true });
  }));
  const reason = page.getByPlaceholder(
    "دلیل مستند تأیید یا رد را وارد کنید.");
  await reason.fill("مدرک تصویری بررسی شد");
  await page.getByRole("button", { name: "تأیید گزارش" }).click();
  await page.getByText("نتیجه تصمیم هنوز قطعی نیست.", {
    exact: false,
  }).waitFor();
  assert.equal(await reason.isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "رد گزارش" })
    .isDisabled(), true);
  await page.getByRole("button", {
    name: "تکرار امن همان تأیید",
  }).click();
  await page.getByText("آخرین پاسخ واقعی سرور", { exact: true }).waitFor();
  await page.getByText("تأیید و در انتظار مرجوعی", {
    exact: true,
  }).first().waitFor();
  assert.equal(decisionAttempts, 2);
  assert.deepEqual(pageErrors, []);

  await context.close();
  console.log("Chromium staff commerce: seller lifecycle, private evidence and frozen support retry OK");
}

try { await main(); } finally {
  if (browser) await browser.close();
  if (web?.pid) { try { process.kill(-web.pid, "SIGTERM"); } catch {} }
}
