// CI-only browser fixtures; never use these applicant records in production.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const base = "http://127.0.0.1:3015";
const id1 = "123e4567-e89b-42d3-a456-426614174000";
const id2 = "123e4567-e89b-42d3-a456-426614174001";
const id3 = "123e4567-e89b-42d3-a456-426614174002";
const at = "2026-09-26T10:00:00+00:00";
const app = (id, name, status = "UNDER_REVIEW", revision = 3) => ({
  applicationId: id, storeName: name, ownerName: `مسئول ${name}`,
  applicantType: "NATURAL", identityStatus: "VERIFIED",
  businessCategoryId: null, businessName: `کسب‌وکار ${name}`,
  offeringType: "GOOD", status: "SUBMITTED", revision,
  trackingCode: id === id1 ? "HNA-A1B2C3D4E5F60718" : "HNA-1234567890ABCDEF",
  reviewStatus: status, reviewedAtUtc: status === "UNDER_REVIEW" ? null : at,
  submittedAtUtc: at,
});
const details = new Map([[id1, {
  ...app(id1, "فروشگاه آفتاب"), nationalCodeMasked: "******5948",
  legalNationalIdMasked: null, legalName: null, legalRepresentativeName: null,
  legalRepresentativePhoneMasked: null, businessDescription: "شرح واقعی پرونده",
  businessPhone: "02112345678", activityProvinceId: null, activityCityId: null,
  activityAddress: "نشانی ثبت‌شدهٔ فعالیت", activityHours: "۸ تا ۲۲",
  sellerDelivery: true, pickup: true, serviceArea: "تهران",
  registrationContactName: "مسئول ثبت‌نام", registrationContactRole: null,
  backupPhoneMasked: null, websiteOrSocial: null, businessEmail: null,
  responseHours: "۸ تا ۲۲", documentsRequired: false,
  phoneMasked: "0912*******", city: "تهران", address: "نشانی ثبت‌شده",
  postalCode: "1234567890", reviewReason: null,
  reviewHistory: [],
}], [id2, {
  ...app(id2, "فروشگاه بهار"), nationalCodeMasked: "******3210",
  legalNationalIdMasked: null, legalName: null, legalRepresentativeName: null,
  legalRepresentativePhoneMasked: null, businessDescription: null,
  businessPhone: null, activityProvinceId: null, activityCityId: null,
  activityAddress: "نشانی دیگر", activityHours: "۹ تا ۲۱",
  sellerDelivery: false, pickup: true, serviceArea: null,
  registrationContactName: "مسئول دیگر", registrationContactRole: null,
  backupPhoneMasked: null, websiteOrSocial: null, businessEmail: null,
  responseHours: "۹ تا ۲۱", documentsRequired: false,
  phoneMasked: "0911*******", city: "اصفهان", address: "نشانی دیگر",
  postalCode: "1111111111", reviewReason: null,
  reviewHistory: [],
}]]);
details.set(id3, {
  ...details.get(id2),
  ...app(id3, "فروشگاه سوم"),
  trackingCode: "HNA-FEDCBA0987654321",
});
const json = (body, status = 200) => ({
  status, contentType: "application/json; charset=utf-8",
  headers: { "Cache-Control": "no-store" }, body: JSON.stringify(body),
});
let next, browser, logs = "", staleOnce = true;
const listRequests = [], reviewRequests = [];

async function main() {
  next = spawn("npm", ["run", "start", "--workspace", "@hana/web-marketplace",
    "--", "-p", "3015", "-H", "127.0.0.1"], { detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } });
  next.stdout.on("data", part => { logs += part.toString(); });
  next.stderr.on("data", part => { logs += part.toString(); });
  let ready = false;
  for (let attempt = 0; attempt < 45; attempt++) {
    if (next.exitCode !== null) throw new Error("Next exited: " + logs);
    try {
      if ((await fetch(base + "/auth", { signal: AbortSignal.timeout(1000) })).ok) {
        ready = true; break;
      }
    } catch { /* wait for the production server */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(ready, "Next did not start: " + logs);

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: "fa-IR", viewport: { width: 1440, height: 1024 } });
  await context.route(new RegExp(String.raw`/api/admin/seller-applications(?:/|\?|$)`), async route => {
    const request = route.request();
    const url = new URL(request.url());
    assert.equal(request.headers().authorization, undefined,
      "browser must never receive or send a bearer token");
    if (request.method() === "GET" && url.pathname === "/api/admin/seller-applications") {
      listRequests.push({ page: url.searchParams.get("page"), status: url.searchParams.get("reviewStatus") });
      const item = url.searchParams.get("page") === "2" ? app(id2, "فروشگاه بهار") : app(id1, "فروشگاه آفتاب");
      return route.fulfill(json({ items: [item], page: Number(url.searchParams.get("page")), pageSize: 20, total: 21 }));
    }
    const match = url.pathname.match(/^\/api\/admin\/seller-applications\/([^/]+)(?:\/review)?$/);
    assert.ok(match, "unexpected Admin endpoint " + url.pathname);
    const applicationId = match[1];
    if (request.method() === "GET") {
      const detail = details.get(applicationId);
      return route.fulfill(detail ? json(detail) : json({ message: "not found" }, 404));
    }
    assert.equal(request.method(), "POST");
    assert.equal(url.pathname.endsWith("/review"), true);
    assert.equal(request.headers().origin, base);
    assert.equal(request.headers()["idempotency-key"], undefined,
      "idempotency keys must stay inside the server-to-server BFF call");
    const body = request.postDataJSON();
    reviewRequests.push({ applicationId, body });
    assert.equal(body.revision, details.get(applicationId).revision,
      "mutation must use the currently rendered revision");
    if (applicationId === id1 && staleOnce) {
      staleOnce = false;
      return route.fulfill(json({ message: "پرونده تغییر کرده است." }, 409));
    }
    const prior = details.get(applicationId);
    const updated = {
      ...prior, revision: prior.revision + 1, reviewStatus: body.decision,
      reviewReason: body.decision === "APPROVED" ? null : body.reason,
      reviewedAtUtc: at,
      reviewHistory: [...prior.reviewHistory, {
        expectedRevision: prior.revision, decision: body.decision,
        reason: body.reason ?? null, createdAtUtc: at,
      }],
    };
    details.set(applicationId, updated);
    return route.fulfill(json({
      applicationId, status: "SUBMITTED", revision: updated.revision,
      trackingCode: updated.trackingCode, reviewStatus: updated.reviewStatus,
      reviewReason: updated.reviewReason, reviewedAtUtc: updated.reviewedAtUtc,
    }));
  });

  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(base + "/admin/seller-applications");
  await page.getByRole("heading", { name: "درخواست‌های ثبت‌نام فروشنده" }).waitFor();
  await page.getByText("کسب‌وکار فروشگاه آفتاب", { exact: true }).waitFor();
  assert.equal(await page.getByText("متقاضی نمونه ۱").count(), 0);
  assert.equal(await page.getByText("تاریخ نمونه").count(), 0);
  assert.deepEqual(listRequests.at(-1), { page: "1", status: "ALL" });

  await page.getByRole("button", { name: "در حال بررسی", exact: true }).click();
  await page.getByText("کسب‌وکار فروشگاه آفتاب", { exact: true }).waitFor();
  assert.deepEqual(listRequests.at(-1), { page: "1", status: "UNDER_REVIEW" });
  await page.getByRole("button", { name: "بعدی" }).click();
  await page.getByText("کسب‌وکار فروشگاه بهار", { exact: true }).waitFor();
  assert.deepEqual(listRequests.at(-1), { page: "2", status: "UNDER_REVIEW" });

  await page.goto(base + "/admin/seller-applications/" + id1);
  await page.getByRole("heading", { name: "جزئیات درخواست ثبت‌نام فروشنده" }).waitFor();
  await page.waitForTimeout(1500);
  const pageText = await page.locator("body").innerText();
  assert.match(pageText, /نشانی ثبت/,
    "the activity address must render from the live detail response; page text: " +
      pageText.slice(0, 2400));
  await page.getByText("******5948").waitFor();
  await page.getByText("برای این مرحله از ثبت‌نام مدرکی لازم نیست.").waitFor();
  assert.equal(await page.getByText("0084575948").count(), 0);

  await page.getByRole("button", { name: "ثبت نتیجه نهایی بررسی" }).click();
  await page.getByRole("heading", { name: "تأیید درخواست" }).waitFor();
  await page.getByRole("button", { name: "ثبت نتیجه", exact: true }).click();
  await page.getByText(/هم‌زمان تغییر کرده/).waitFor();
  await page.getByRole("button", { name: "دریافت وضعیت تازه" }).click();
  await page.getByRole("button", { name: "ثبت نتیجه نهایی بررسی" }).waitFor();
  await page.getByRole("button", { name: "ثبت نتیجه نهایی بررسی" }).click();
  await page.getByRole("button", { name: "ثبت نتیجه", exact: true }).click();
  await page.getByText(/نتیجه بررسی ثبت شد/).waitFor();
  await page.locator(".admin-detail-card--status .admin-badge--approved").waitFor();
  assert.equal(await page.getByRole("button", { name: /فعال‌سازی/ }).count(), 0);
  assert.equal(reviewRequests[0].body.decision, "APPROVED");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/admin/seller-applications");
  await page.getByText("کسب‌وکار فروشگاه آفتاب", { exact: true }).waitFor();
  assert.equal(await page.evaluate(() =>
    document.documentElement.scrollWidth <= window.innerWidth), true,
  "the list must fit a narrow viewport without page-level horizontal overflow");

  await page.goto(base + "/admin/seller-applications/" + id2);
  await page.getByRole("heading", { name: "جزئیات درخواست ثبت‌نام فروشنده" }).waitFor();
  assert.equal(await page.evaluate(() =>
    document.documentElement.scrollWidth <= window.innerWidth), true,
  "the detail view must fit a narrow viewport without page-level horizontal overflow");
  await page.getByRole("button", { name: "درخواست تکمیل اطلاعات" }).click();
  const submit = page.getByRole("button", { name: "ثبت نتیجه", exact: true });
  await page.getByRole("heading", { name: "درخواست تکمیل اطلاعات" }).waitFor();
  assert.equal(await submit.isDisabled(), true, "reason is required before mutation");
  await page.locator("textarea").fill("لطفاً نشانی فعالیت را تکمیل کنید.");
  await submit.click();
  await page.getByText("درخواست تکمیل اطلاعات ثبت شد.").waitFor();
  await page.getByText("لطفاً نشانی فعالیت را تکمیل کنید.").waitFor();
  const needsInfo = reviewRequests.findLast(x => x.applicationId === id2);
  assert.equal(needsInfo.body.revision, 3);
  assert.equal(needsInfo.body.decision, "NEEDS_INFORMATION");
  assert.equal(needsInfo.body.reason, "لطفاً نشانی فعالیت را تکمیل کنید.");

  await page.goto(base + "/admin/seller-applications/" + id3);
  await page.getByRole("button", { name: "رد درخواست" }).click();
  const rejectDialog = page.getByRole("dialog", { name: "رد درخواست فروشندگی" });
  await rejectDialog.waitFor();
  const rejectSubmit = rejectDialog.getByRole("button", { name: "تأیید رد درخواست" });
  assert.equal(await rejectSubmit.isDisabled(), true, "rejection reason is required");
  await rejectDialog.locator("textarea").fill("مدارک و اطلاعات ارائه‌شده با شرایط ثبت‌نام مطابقت ندارد.");
  await rejectSubmit.click();
  await page.getByText("رد درخواست ثبت شد.").waitFor();
  await page.locator(".admin-detail-card--status .admin-badge--rejected").waitFor();
  const rejected = reviewRequests.findLast(x => x.applicationId === id3);
  assert.equal(rejected.body.revision, 3);
  assert.equal(rejected.body.decision, "REJECTED");
  assert.equal(rejected.body.reason, "مدارک و اطلاعات ارائه‌شده با شرایط ثبت‌نام مطابقت ندارد.");
  assert.ok(errors.length === 0, "browser errors: " + errors.join("; "));
  console.log("Admin seller application UI CI: live filters, pagination, detail allowlist, no-documents state, revision conflicts, and approve/request-info/reject decisions verified");
  await browser.close();
}

try { await main(); }
finally {
  if (browser) await browser.close().catch(() => {});
  if (next?.pid) { try { process.kill(-next.pid, "SIGTERM"); } catch { /* already exited */ } }
}
