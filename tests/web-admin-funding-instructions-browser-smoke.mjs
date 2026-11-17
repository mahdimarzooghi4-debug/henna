// CI-only browser fixtures; never use these organizations or references in production.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const base = "http://127.0.0.1:3021";
const id1 = "123e4567-e89b-42d3-a456-426614174000";
const id2 = "123e4567-e89b-42d3-a456-426614174001";
const at = "2026-09-27T10:00:00+00:00";
const item = (id, organizationName, programName, reference) => ({
  instructionId: id, organizationName, programName,
  allocationMode: "HENNA_NEEDS_BASED", sourceInstructionReference: reference,
  state: "PENDING_VERIFICATION", revision: 1, submittedAtUtc: at,
  reviewReason: null, reviewedAtUtc: null,
});
const records = new Map([[id1, {
  ...item(id1, "سازمان آفتاب", "حمایت نمونه اول", "REF-1405-01"),
  programId: "123e4567-e89b-42d3-a456-426614174010", programRevision: 1, events: [],
}], [id2, {
  ...item(id2, "سازمان بهار", "حمایت نمونه دوم", "REF-1405-02"),
  programId: "123e4567-e89b-42d3-a456-426614174011", programRevision: 1, events: [],
}]]);
const json = (body, status = 200) => ({ status, contentType: "application/json; charset=utf-8",
  headers: { "Cache-Control": "no-store" }, body: JSON.stringify(body) });
let next, browser, logs = "";
const reviewRequests = [];

async function main() {
  next = spawn("npm", ["run", "start", "--workspace", "@hana/web-marketplace",
    "--", "-p", "3021", "-H", "127.0.0.1"], { detached: true,
    stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } });
  next.stdout.on("data", part => { logs += part.toString(); });
  next.stderr.on("data", part => { logs += part.toString(); });
  let ready = false;
  for (let attempt = 0; attempt < 45; attempt++) {
    if (next.exitCode !== null) throw new Error("Next exited: " + logs);
    try { if ((await fetch(base + "/auth", { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch { }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(ready, "Next did not start: " + logs);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: "fa-IR", viewport: { width: 1440, height: 1024 } });
  await context.route(/\/api\/admin\/organization-funding-instructions(?:\/|\?|$)/, async route => {
    const request = route.request();
    const url = new URL(request.url());
    assert.equal(request.headers().authorization, undefined,
      "browser must not receive or send a bearer token");
    if (request.method() === "GET" && url.pathname === "/api/admin/organization-funding-instructions") {
      assert.equal(url.searchParams.get("state"), "PENDING_VERIFICATION");
      return route.fulfill(json({ items: [
        item(id1, "سازمان آفتاب", "حمایت نمونه اول", "REF-1405-01"),
        item(id2, "سازمان بهار", "حمایت نمونه دوم", "REF-1405-02"),
      ], page: 1, pageSize: 20, total: 2 }));
    }
    const match = url.pathname.match(/^\/api\/admin\/organization-funding-instructions\/([^/]+)(?:\/review)?$/);
    assert.ok(match, "unexpected Admin endpoint " + url.pathname);
    const instructionId = match[1];
    if (request.method() === "GET") {
      const detail = records.get(instructionId);
      return route.fulfill(detail ? json(detail) : json({ message: "not found" }, 404));
    }
    assert.equal(request.method(), "POST");
    assert.equal(url.pathname.endsWith("/review"), true);
    assert.equal(request.headers().origin, base);
    assert.equal(request.headers()["idempotency-key"], undefined,
      "idempotency keys must stay inside the server-to-server BFF call");
    const body = request.postDataJSON();
    reviewRequests.push({ instructionId, body });
    const prior = records.get(instructionId);
    assert.equal(body.revision, prior.revision, "review must use the visible revision");
    assert.ok(body.decision === "VERIFIED" || body.decision === "REJECTED");
    if (body.decision === "REJECTED") assert.ok(body.reason?.trim());
    const event = {
      eventId: instructionId === id1 ? "123e4567-e89b-42d3-a456-426614174020" : "123e4567-e89b-42d3-a456-426614174021",
      instructionId, revision: prior.revision + 1, decision: body.decision,
      reference: prior.sourceInstructionReference, reason: body.reason ?? null, occurredAtUtc: at,
    };
    records.set(instructionId, {
      ...prior, revision: prior.revision + 1, state: body.decision,
      reviewReason: body.reason ?? null, reviewedAtUtc: at,
      events: [...prior.events, event],
    });
    return route.fulfill(json(event));
  });

  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(base + "/admin/organization-funding-instructions");
  await page.getByRole("heading", { name: "بررسی دستور منبع سازمان" }).waitFor();
  await page.getByText("سازمان آفتاب", { exact: true }).waitFor();
  assert.equal(await page.getByText("نمونه سازمان ۱", { exact: true }).count(), 0);
  await page.getByRole("link", { name: "بررسی مرجع" }).first().click();
  await page.getByText("REF-1405-01", { exact: true }).waitFor();
  await page.getByText(/این صفحه موجودی، دریافت وجه/).waitFor();
  await page.getByRole("button", { name: "رد و درخواست اصلاح" }).click();
  const rejectDialog = page.getByRole("dialog");
  const rejectButton = rejectDialog.getByRole("button", { name: "ثبت تصمیم" });
  assert.equal(await rejectButton.isDisabled(), true,
    "rejection must require a reason");
  await rejectDialog.locator("textarea").fill("مرجع برای بررسی خوانا نیست.");
  await rejectButton.click();
  await page.getByText("درخواست اصلاح ثبت شد و در سابقهٔ بررسی باقی می‌ماند.").waitFor();
  await page.getByText("درخواست اصلاح مرجع", { exact: true }).waitFor();
  await page.getByText("مرجع برای بررسی خوانا نیست.", { exact: true }).waitFor();
  assert.equal(reviewRequests[0].body.revision, 1);
  assert.equal(reviewRequests[0].body.decision, "REJECTED");

  await page.goto(base + "/admin/organization-funding-instructions/" + id2);
  await page.getByText("REF-1405-02", { exact: true }).waitFor();
  await page.getByRole("button", { name: "تأیید مرجع ثبت‌شده" }).click();
  const verifyDialog = page.getByRole("dialog");
  await verifyDialog.getByRole("button", { name: "ثبت تصمیم" }).click();
  await page.getByText(/این نتیجه به معنی دریافت وجه یا فعال‌شدن تخصیص نیست/).waitFor();
  assert.equal(reviewRequests[1].body.decision, "VERIFIED");
  assert.equal(reviewRequests[1].body.reason, null);
  assert.deepEqual(errors, []);
}

try { await main(); console.log("Admin funding instruction browser smoke passed"); }
finally {
  if (browser) await browser.close();
  if (next?.pid) { try { process.kill(-next.pid, "SIGTERM"); } catch { } }
}
