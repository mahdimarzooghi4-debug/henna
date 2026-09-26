import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const base = "http://127.0.0.1:3016";
const orgId = "123e4567-e89b-42d3-a456-426614174000";
const membershipId = "123e4567-e89b-42d3-a456-426614174001";
let next, browser, logs = "";

async function main() {
  next = spawn("npm", ["run", "start", "--workspace", "@hana/web-marketplace", "--", "-p", "3016", "-H", "127.0.0.1"], {
    detached: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  });
  next.stdout.on("data", part => { logs += part.toString(); });
  next.stderr.on("data", part => { logs += part.toString(); });
  let ready = false;
  for (let i = 0; i < 45; i++) {
    if (next.exitCode !== null) throw new Error("Next exited: " + logs);
    try { if ((await fetch(base + "/organization", { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch { /* wait */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(ready, "Next did not start: " + logs);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: "fa-IR", viewport: { width: 1280, height: 900 } });
  await context.route("**/api/organization/profiles", route => route.fulfill({
    status: 200, contentType: "application/json; charset=utf-8",
    headers: { "Cache-Control": "no-store" },
    body: JSON.stringify({ profiles: [{ organizationId: orgId, organizationName: "سازمان پایدار", memberRole: "ORG_REPRESENTATIVE", membershipId }] }),
  }));
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(base + "/organization");
  await page.getByRole("heading", { name: "اطلاعات و پروفایل سازمان" }).waitFor();
  await page.getByRole("heading", { name: "سازمان پایدار" }).waitFor();
  await page.locator(".organization-card-title span").getByText("نماینده سازمان", { exact: true }).waitFor();
  await page.getByText("در این برش هنوز ثبت نشده است.", { exact: true }).waitFor();
  assert.equal(await page.getByText("info@org-domain.ir").count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true,
    "organization profile must fit narrow viewports without page-level horizontal overflow");

  await page.route("**/api/organization/profiles", route => route.fulfill({
    status: 403, contentType: "application/json; charset=utf-8", headers: { "Cache-Control": "no-store" },
    body: JSON.stringify({ message: "برای این حساب عضویت فعال سازمانی ثبت نشده است." }),
  }));
  await page.reload();
  await page.getByText("برای این حساب عضویت فعال سازمانی ثبت نشده است.").waitFor();
  assert.equal(errors.length, 0, "browser errors: " + errors.join("; "));
  console.log("Organization profile browser smoke: persisted membership data, honest missing fields, no sample values, and mobile layout verified");
}

try { await main(); }
finally {
  if (browser) await browser.close().catch(() => {});
  if (next?.pid) { try { process.kill(-next.pid, "SIGTERM"); } catch { /* already stopped */ } }
}
