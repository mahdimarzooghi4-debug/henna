import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const base = "http://127.0.0.1:3019";
const orgId = "123e4567-e89b-42d3-a456-426614174000";
const programId = "123e4567-e89b-42d3-a456-426614174002";
const provinceId = "123e4567-e89b-42d3-a456-426614174004";
const cityId = "123e4567-e89b-42d3-a456-426614174005";
let next, browser, logs = "", posted = null;
const program = { programId, organizationId: orgId, organizationName: "سازمان آزمون", name: "طرح ارجاع خانوار", allocationMode: "HENNA_NEEDS_BASED", description: "", state: "DRAFT", revision: 1, createdAtUtc: "2026-09-27T12:00:00Z" };

async function main() {
  next = spawn("npm", ["run", "start", "--workspace", "@hana/web-marketplace", "--", "-p", "3019", "-H", "127.0.0.1"], { detached: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } });
  next.stdout.on("data", part => { logs += part.toString(); }); next.stderr.on("data", part => { logs += part.toString(); });
  let ready = false;
  for (let i = 0; i < 45; i++) { if (next.exitCode !== null) throw new Error("Next exited: " + logs); try { if ((await fetch(base + "/organization/programs", { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch { } await new Promise(resolve => setTimeout(resolve, 1000)); }
  assert.ok(ready, "Next did not start: " + logs);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: "fa-IR", viewport: { width: 1280, height: 900 } });
  const referral = () => ({ referralId: "123e4567-e89b-42d3-a456-426614174006", programId, externalReference: posted?.externalReference ?? "", provinceId, cityId, settlementType: "URBAN", revision: 1, submittedAtUtc: "2026-09-27T12:30:00Z", members: (posted?.members ?? []).map((x, i) => ({ memberNumber: i + 1, ...x })) });
  await context.route("**/api/organization/programs", route => route.fulfill({ status: 200, contentType: "application/json", headers: { "Cache-Control": "no-store" }, body: JSON.stringify({ programs: [program] }) }));
  await context.route("**/api/organization/profiles", route => route.fulfill({ status: 200, contentType: "application/json", headers: { "Cache-Control": "no-store" }, body: JSON.stringify({ profiles: [{ organizationId: orgId, organizationName: "سازمان آزمون", memberRole: "ORG_REPRESENTATIVE", membershipId: "123e4567-e89b-42d3-a456-426614174001" }] }) }));
  await context.route("**/api/geography/provinces", route => route.fulfill({ status: 200, contentType: "application/json", headers: { "Cache-Control": "no-store" }, body: JSON.stringify({ items: [{ id: provinceId, name: "استان نمونه", slug: "sample" }] }) }));
  await context.route(`**/api/geography/cities?provinceId=${provinceId}`, route => route.fulfill({ status: 200, contentType: "application/json", headers: { "Cache-Control": "no-store" }, body: JSON.stringify({ items: [{ id: cityId, provinceId, name: "شهر نمونه", slug: "sample-city" }] }) }));
  await context.route(`**/api/organization/programs/${programId}/household-referrals`, async route => {
    if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", headers: { "Cache-Control": "no-store" }, body: JSON.stringify({ referrals: [] }) });
    posted = route.request().postDataJSON();
    return route.fulfill({ status: 201, contentType: "application/json", headers: { "Cache-Control": "no-store" }, body: JSON.stringify(referral()) });
  });
  const page = await context.newPage(); page.setDefaultTimeout(10000); const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto(base + "/organization/programs");
  await page.locator(`a[href="/organization/programs/${programId}/household-referrals"]`).click();
  await page.getByRole("heading", { name: "ارجاع خانوارها" }).waitFor();
  await page.getByLabel("شناسه پرونده در سازمان").fill("CASE-1405-001");
  await page.getByLabel("استان").selectOption(provinceId);
  await page.getByLabel("شهر", { exact: true }).selectOption(cityId);
  await page.getByRole("button", { name: "ثبت ارجاع خانوار" }).click();
  await page.getByText("CASE-1405-001", { exact: true }).waitFor();
  assert.equal(posted.externalReference, "CASE-1405-001");
  assert.equal(posted.members.length, 1);
  assert.equal(posted.members[0].lifeStage, "ADULT");
  assert.equal(await page.getByText("در این صفحه بررسی استحقاق یا تخصیص انجام نمی‌شود.").count(), 1);
  assert.equal(await page.getByText(/[0-9۰-۹٠-٩][0-9۰-۹٠-٩,٬]*\s*(?:تومان|ریال)/).count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "referral page must fit a narrow viewport");
  assert.equal(errors.length, 0, "browser errors: " + errors.join("; "));
  console.log("Organization household referral browser smoke: qualitative intake, canonical geography, no eligibility or financial claims, and mobile layout verified");
}

try { await main(); } finally { if (browser) await browser.close().catch(() => {}); if (next?.pid) { try { process.kill(-next.pid, "SIGTERM"); } catch { } } }
