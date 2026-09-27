import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const base = "http://127.0.0.1:3018";
const orgId = "123e4567-e89b-42d3-a456-426614174000";
const programId = "123e4567-e89b-42d3-a456-426614174002";
const membershipId = "123e4567-e89b-42d3-a456-426614174001";
let next, browser, logs = "", posted = null;
const program = { programId, organizationId: orgId, organizationName: "سازمان آزمون", name: "طرح آزمایشی", allocationMode: "ORGANIZATION_DEFINED", description: "", state: "DRAFT", revision: 1, createdAtUtc: "2026-09-27T12:00:00Z" };

async function main() {
  next = spawn("npm", ["run", "start", "--workspace", "@hana/web-marketplace", "--", "-p", "3018", "-H", "127.0.0.1"], {
    detached: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  });
  next.stdout.on("data", part => { logs += part.toString(); });
  next.stderr.on("data", part => { logs += part.toString(); });
  let ready = false;
  for (let i = 0; i < 45; i++) {
    if (next.exitCode !== null) throw new Error("Next exited: " + logs);
    try { if ((await fetch(base + "/organization/programs", { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch { }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(ready, "Next did not start: " + logs);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: "fa-IR", viewport: { width: 1280, height: 900 } });
  await context.route("**/api/organization/programs", route => route.fulfill({ status: 200, contentType: "application/json", headers: { "Cache-Control": "no-store" }, body: JSON.stringify({ programs: [program] }) }));
  await context.route("**/api/organization/profiles", route => route.fulfill({ status: 200, contentType: "application/json", headers: { "Cache-Control": "no-store" }, body: JSON.stringify({ profiles: [{ organizationId: orgId, organizationName: "سازمان آزمون", memberRole: "ORG_REPRESENTATIVE", membershipId }] }) }));
  await context.route(`**/api/organization/programs/${programId}/funding-instruction`, async route => {
    if (route.request().method() === "GET") return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ message: "برای این طرح هنوز دستور منبع ثبت نشده است." }) });
    posted = route.request().postDataJSON();
    return route.fulfill({ status: 201, contentType: "application/json", headers: { "Cache-Control": "no-store" }, body: JSON.stringify({ instructionId: "123e4567-e89b-42d3-a456-426614174003", programId, programRevision: 1, allocationMode: "ORGANIZATION_DEFINED", sourceInstructionReference: posted.sourceInstructionReference, state: "PENDING_VERIFICATION", revision: 1, submittedAtUtc: "2026-09-27T12:15:00Z" }) });
  });

  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(base + "/organization/programs");
  await page.getByRole("link", { name: "جزئیات و دستور منبع" }).click();
  await page.getByRole("heading", { name: "جزئیات دستور منبع" }).waitFor();
  await page.getByText("مرجع دستور تأمین مالی را ثبت یا پیگیری کنید.").waitFor();
  await page.getByLabel("شماره یا مرجع دستور منبع").fill("نامه سازمانی ۱۴۰۵/الف");
  await page.getByRole("button", { name: "ثبت برای بررسی" }).click();
  await page.getByText("در انتظار بررسی", { exact: true }).first().waitFor();
  await page.getByText("نامه سازمانی ۱۴۰۵/الف", { exact: true }).waitFor();
  assert.deepEqual(posted, { programRevision: 1, sourceInstructionReference: "نامه سازمانی ۱۴۰۵/الف" });
  assert.equal(await page.getByText(/[0-9۰-۹٠-٩][0-9۰-۹٠-٩,٬]*\s*(?:تومان|ریال)/).count(), 0);
  assert.equal(await page.getByRole("button", { name: "ثبت برای بررسی" }).count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "funding instruction page must fit a narrow viewport");
  assert.equal(errors.length, 0, "browser errors: " + errors.join("; "));
  console.log("Organization funding instruction browser smoke: source reference intake, pending verification state, no fabricated financial values, and mobile layout verified");
}

try { await main(); }
finally {
  if (browser) await browser.close().catch(() => {});
  if (next?.pid) { try { process.kill(-next.pid, "SIGTERM"); } catch { } }
}
