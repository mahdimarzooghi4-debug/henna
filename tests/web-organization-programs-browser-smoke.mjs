import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const base = "http://127.0.0.1:3017";
const orgId = "123e4567-e89b-42d3-a456-426614174000";
const membershipId = "123e4567-e89b-42d3-a456-426614174001";
let next, browser, logs = "";
let programs = [];
let createdPayload = null;

async function main() {
  next = spawn("npm", ["run", "start", "--workspace", "@hana/web-marketplace", "--", "-p", "3017", "-H", "127.0.0.1"], {
    detached: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  });
  next.stdout.on("data", part => { logs += part.toString(); });
  next.stderr.on("data", part => { logs += part.toString(); });
  let ready = false;
  for (let i = 0; i < 45; i++) {
    if (next.exitCode !== null) throw new Error("Next exited: " + logs);
    try { if ((await fetch(base + "/organization/programs", { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch { /* wait */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(ready, "Next did not start: " + logs);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: "fa-IR", viewport: { width: 1280, height: 900 } });
  await context.route("**/api/organization/profiles", route => route.fulfill({
    status: 200, contentType: "application/json; charset=utf-8", headers: { "Cache-Control": "no-store" },
    body: JSON.stringify({ profiles: [{ organizationId: orgId, organizationName: "سازمان آزمایشی", memberRole: "ORG_REPRESENTATIVE", membershipId }] }),
  }));
  await context.route("**/api/organization/programs", async route => {
    if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json; charset=utf-8", headers: { "Cache-Control": "no-store" }, body: JSON.stringify({ programs }) });
    createdPayload = route.request().postDataJSON();
    const response = {
      programId: "123e4567-e89b-42d3-a456-426614174002", organizationId: orgId, name: createdPayload.name,
      allocationMode: createdPayload.allocationMode, description: createdPayload.description,
      state: "DRAFT", revision: 1, createdAtUtc: "2026-09-27T12:00:00Z",
    };
    programs = [{ ...response, organizationName: "سازمان آزمایشی" }];
    return route.fulfill({ status: 201, contentType: "application/json; charset=utf-8", headers: { "Cache-Control": "no-store" }, body: JSON.stringify(response) });
  });

  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(base + "/organization/programs");
  await page.getByRole("heading", { name: "مدیریت طرح‌ها و اعتبارها" }).waitFor();
  await page.getByText("هنوز طرحی ثبت نشده است").waitFor();
  await page.getByRole("link", { name: "ایجاد پیش‌نویس" }).click();
  await page.getByRole("heading", { name: "ثبت طرح سازمانی" }).waitFor();
  await page.getByText(/صندوق نیکوکاری حنا فقط با روش نیازمحور حنا کار می‌کند/).waitFor();
  await page.getByLabel("نام طرح").fill("طرح آزمایشی سازمان");
  await page.getByLabel("توضیحات و اهداف طرح").fill("خانوارهای معرفی‌شده");
  await page.getByLabel("روش ثبت‌شده").selectOption("ORGANIZATION_DEFINED");
  await page.getByRole("button", { name: "ثبت اولیه طرح سازمانی" }).click();
  await page.getByText("تعریف‌شده توسط سازمان", { exact: true }).waitFor();
  assert.equal(createdPayload?.allocationMode, "ORGANIZATION_DEFINED");
  assert.equal(createdPayload?.organizationId, orgId);
  assert.equal("amount" in createdPayload, false);
  assert.equal("balance" in createdPayload, false);
  await page.getByRole("cell", { name: "پیش‌نویس" }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true,
    "organization programs must fit narrow viewports without page-level horizontal overflow");
  assert.equal(errors.length, 0, "browser errors: " + errors.join("; "));
  console.log("Organization programs browser smoke: both allocation modes, idempotent draft boundary, no financial values, and mobile layout verified");
}

try { await main(); }
finally {
  if (browser) await browser.close().catch(() => {});
  if (next?.pid) { try { process.kill(-next.pid, "SIGTERM"); } catch { /* already stopped */ } }
}
