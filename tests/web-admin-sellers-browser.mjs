import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { parseAdminSellerDetail } from "../apps/web-marketplace/lib/admin-sellers.ts";

const base = "http://127.0.0.1:3018";
const ID = "60000000-0000-4000-8000-000000000041";
let web, browser, logs = "";
let revision = 7, reviewStatus = "UNDER_REVIEW", activatedAtUtc = null;
let sellerSuspended = false, suspendedAtUtc = null, suspensionReason = null;
let reviewAttempts = 0, firstReview = null, detailReads = 0;

function json(data, status = 200) {
  return {
    status,
    contentType: "application/json; charset=utf-8",
    headers: { "Cache-Control": "no-store" },
    body: JSON.stringify(data),
  };
}
function listItem() {
  return {
    id: ID,
    storeName: "فروشگاه مرورگر",
    businessName: "کسب‌وکار مرورگر",
    applicantType: "NATURAL",
    identityStatus: "VERIFIED",
    offeringType: "GOOD",
    revision,
    trackingCode: "HNA-A1B2C3D4E5F60718",
    reviewStatus,
    reviewedAtUtc: reviewStatus === "UNDER_REVIEW"
      ? null : "2026-10-05T03:20:00Z",
    activatedAtUtc,
    submittedAtUtc: "2026-10-05T03:00:00Z",
  };
}
function detail() {
  return {
    ...listItem(),
    applicationId: ID,
    ownerName: "مالک مرورگر",
    nationalCodeMasked: "******1234",
    legalNationalId: null,
    legalName: null,
    legalRepresentativeName: null,
    legalRepresentativePhoneMasked: null,
    businessDescription: "شرح کسب‌وکار مرورگر",
    businessPhone: "02112345678",
    activityAddress: "نشانی فعالیت مرورگر",
    activityLatitude: null,
    activityLongitude: null,
    activityHours: "شنبه تا پنجشنبه",
    sellerDelivery: false,
    pickup: true,
    serviceArea: "شهر مرورگر",
    registrationContactName: "تماس مرورگر",
    registrationContactRole: "مالک",
    backupPhoneMasked: null,
    websiteOrSocial: null,
    businessEmail: null,
    responseHours: "۹ تا ۱۸",
    phoneMasked: "0912*******",
    city: "شهر مرورگر",
    address: "نشانی مرورگر",
    postalCode: "1234567890",
    reviewReason: reviewStatus === "UNDER_REVIEW" ? null : "بررسی مستند مرورگر",
    sellerSuspended,
    suspendedAtUtc,
    suspensionReason,
  };
}

async function main() {
  web = spawn("npm", ["run","start","--workspace","@hana/web-marketplace",
    "--","-p","3018","-H","127.0.0.1"], {
      detached: true,
      stdio: ["ignore","pipe","pipe"],
      env: {...process.env, NEXT_TELEMETRY_DISABLED:"1"},
    });
  web.stdout.on("data", value => logs += value);
  web.stderr.on("data", value => logs += value);
  for (let i = 0; i < 45; i++) {
    if (web.exitCode !== null) throw Error(logs);
    try { if ((await fetch(base + "/auth")).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(String(error)));

  await page.route(/\/api\/admin\/seller-applications(?:\/[^?]*)?(?:\?.*)?$/, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === "/api/admin/seller-applications" &&
        request.method() === "GET") {
      assert.equal(url.searchParams.get("page"), "1");
      return route.fulfill(json({ items: [listItem()], total: 1 }));
    }
    if (path === "/api/admin/seller-applications/" + ID &&
        request.method() === "GET") {
      detailReads++;
      return route.fulfill(json(detail()));
    }

    if (path === "/api/admin/seller-applications/" + ID + "/review" &&
        request.method() === "POST") {
      reviewAttempts++;
      const current = {
        key: request.headers()["idempotency-key"],
        body: request.postData(),
      };
      if (reviewAttempts === 1) {
        firstReview = current;
        return route.fulfill(json({ message: "unknown outcome" }, 503));
      }
      assert.deepEqual(current, firstReview,
        "review retry must preserve exact key and body");
      assert.deepEqual(request.postDataJSON(), {
        revision: 7,
        decision: "APPROVED",
        reason: "بررسی مستند مرورگر",
      });
      revision = 8;
      reviewStatus = "APPROVED";
      return route.fulfill(json({
        applicationId: ID,
        revision,
        reviewStatus,
        reviewReason: "بررسی مستند مرورگر",
        reviewedAtUtc: "2026-10-05T03:20:00Z",
        activatedAtUtc: null,
        sellerActivated: false,
      }));
    }

    if (path === "/api/admin/seller-applications/" + ID + "/activate" &&
        request.method() === "POST") {
      assert.deepEqual(request.postDataJSON(), { revision: 8 });
      assert.match(request.headers()["idempotency-key"],
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      revision = 9;
      activatedAtUtc = "2026-10-05T03:30:00Z";
      return route.fulfill(json({
        applicationId: ID,
        revision,
        reviewStatus,
        reviewReason: "بررسی مستند مرورگر",
        activatedAtUtc,
        sellerRoleGranted: true,
        sellerAccessEnabled: true,
        sellerPanelEnabled: true,
      }));
    }

    if (path === "/api/admin/seller-applications/" + ID + "/suspend" &&
        request.method() === "POST") {
      assert.deepEqual(request.postDataJSON(), {
        revision: 9,
        reason: "تعلیق انطباق مرورگر",
      });
      revision = 10;
      sellerSuspended = true;
      suspendedAtUtc = "2026-10-05T03:40:00Z";
      suspensionReason = "تعلیق انطباق مرورگر";
      return route.fulfill(json({
        applicationId: ID, revision, reviewStatus,
        reviewReason: "بررسی مستند مرورگر", activatedAtUtc,
        sellerActivated: true, sellerSuspended,
        suspendedAtUtc, suspensionReason,
        sellerRoleGranted: false, sellerAccessEnabled: false,
        sellerPanelEnabled: false,
      }));
    }

    if (path === "/api/admin/seller-applications/" + ID + "/restore" &&
        request.method() === "POST") {
      assert.deepEqual(request.postDataJSON(), { revision: 10 });
      revision = 11;
      sellerSuspended = false;
      suspendedAtUtc = null;
      suspensionReason = null;
      return route.fulfill(json({
        applicationId: ID, revision, reviewStatus,
        reviewReason: "بررسی مستند مرورگر", activatedAtUtc,
        sellerActivated: true, sellerSuspended,
        suspendedAtUtc, suspensionReason,
        sellerRoleGranted: true, sellerAccessEnabled: true,
        sellerPanelEnabled: true,
      }));
    }

    throw Error("Unexpected admin seller request: " +
      request.method() + " " + request.url());
  });

  assert.ok(parseAdminSellerDetail(detail(), ID),
    "browser detail fixture must satisfy the production DTO before rendering");

  await page.goto(base + "/admin/sellers");
  await page.getByRole("heading", {
    name: "بررسی و فعال‌سازی فروشندگان",
  }).waitFor();
  await page.locator(`[data-application-id="${ID}"]`).click();
  await page.locator(".admin-sellers__facts")
    .getByText("مالک مرورگر", { exact: true }).waitFor();
  assert.ok(detailReads >= 1,
    "selected application must request detail before rendering.");
  await page.getByPlaceholder(
    "نتیجه بررسی هویت و اطلاعات کسب‌وکار را ثبت کنید.").waitFor();

  const reason = page.getByPlaceholder(
    "نتیجه بررسی هویت و اطلاعات کسب‌وکار را ثبت کنید.");
  await reason.fill("بررسی مستند مرورگر");
  await page.getByRole("button", { name: "تأیید پرونده" }).click();
  await page.getByText("نتیجه این عملیات هنوز قطعی نیست", {
    exact: false,
  }).waitFor();
  assert.equal(await reason.isDisabled(), true);
  assert.equal(await page.getByRole("button", {
    name: "نیاز به اطلاعات",
  }).isDisabled(), true);

  await page.reload();
  await page.getByRole("heading", {
    name: "بررسی و فعال‌سازی فروشندگان",
  }).waitFor();
  const restoredReason = page.getByPlaceholder(
    "نتیجه بررسی هویت و اطلاعات کسب‌وکار را ثبت کنید.");
  await restoredReason.waitFor();
  assert.equal(await restoredReason.inputValue(), "بررسی مستند مرورگر");
  assert.equal(await restoredReason.isDisabled(), true);
  await page.getByRole("button", {
    name: "تکرار امن عملیات فروشنده قبلی",
  }).click();

  await page.getByRole("button", {
    name: "فعال‌سازی فروشنده",
  }).waitFor();
  await page.getByRole("button", {
    name: "فعال‌سازی فروشنده",
  }).click();
  await page.getByText("فروشنده فعال است", { exact: true }).waitFor();

  const suspension = page.getByPlaceholder(
    "دلیل عملیاتی یا انطباقی تعلیق را ثبت کنید.");
  await suspension.fill("تعلیق انطباق مرورگر");
  await page.getByRole("button", { name: "تعلیق فروشنده" }).click();
  await page.getByText("دسترسی فروشنده معلق است", { exact: true }).waitFor();
  await page.getByText("تعلیق انطباق مرورگر", { exact: false }).waitFor();
  await page.getByRole("button", {
    name: "بازگردانی دسترسی فروشنده",
  }).click();
  await page.getByText("فروشنده فعال است", { exact: true }).waitFor();

  assert.equal(reviewAttempts, 2);
  assert.deepEqual(pageErrors, []);

  await context.close();
  console.log("Admin seller browser: frozen review retry, activation, suspension and restore OK");
}

try { await main(); } finally {
  if (browser) await browser.close();
  if (web?.pid) { try { process.kill(-web.pid, "SIGTERM"); } catch {} }
}
