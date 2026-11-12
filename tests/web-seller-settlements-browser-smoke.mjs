/**
 * Real Chromium on an isolated CI-only preview. No actual settlement,
 * financial API, or operational data is read or mutated by this test.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const base = "http://127.0.0.1:3013";
let web;
let browser;
let logs = "";
async function startWeb() {
  web = spawn("npm", ["run", "start", "--workspace", "@hana/web-marketplace",
    "--", "-p", "3013", "-H", "127.0.0.1"], {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, HANA_AUTH_UI_PREVIEW: "1", NEXT_TELEMETRY_DISABLED: "1" },
  });
  web.stdout.on("data", (chunk) => { logs += chunk.toString(); });
  web.stderr.on("data", (chunk) => { logs += chunk.toString(); });
  for (let attempt = 0; attempt < 45; attempt++) {
    if (web.exitCode !== null) throw Error("Next exited: " + logs);
    try {
      const response = await fetch(base + "/seller/panel/settlements", {
        redirect: "manual", signal: AbortSignal.timeout(1000),
      });
      if (response.status === 200) return;
    } catch { /* retry */ }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw Error("Settlement preview unavailable: " + logs);
}

try {
  await startWeb();
  const oldRoute = await fetch(base + "/seller/panel/programs", { redirect: "manual" });
  assert.ok([307, 308].includes(oldRoute.status), "retired programs preview must redirect");
  assert.equal(new URL(oldRoute.headers.get("location"), base).pathname, "/seller/panel/settlements");

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }, locale: "fa-IR", acceptDownloads: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [], apiMutations = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (req) => {
    if (new URL(req.url()).pathname.startsWith("/api/") && !["GET", "HEAD"].includes(req.method())) {
      apiMutations.push(req.method() + " " + req.url());
    }
  });

  await page.goto(base + "/seller/panel/settlements");
  await page.getByRole("heading", { name: "تسویه‌حساب‌ها" }).waitFor();
  await page.getByRole("note").getByText(/همه مبالغ/).waitFor();
  const nav = page.getByRole("navigation", { name: "ناوبری پنل فروشنده" });
  assert.equal(await nav.getByText("طرح‌ها و اعتبارها").count(), 0);
  const table = page.getByRole("table", { name: "تراکنش‌های نمونه تسویه" });
  assert.equal(await table.locator("tbody tr").count(), 4);
  await page.getByText("۱٬۸۹۰٬۰۰۰ تومان").waitFor();
  await page.getByRole("region", { name: "خلاصه نمونه تسویه" })
    .getByText("۶۴۰٬۰۰۰ تومان").waitFor();
  await page.getByText("۴ سفارش", { exact: true }).waitFor();

  const column = table.getByRole("columnheader", { name: "وضعیت تسویه" });
  const headerBox = await column.boundingBox();
  assert.ok(headerBox);
  for (const statusCell of await table.locator("tbody td[data-settlement-status]").all()) {
    const cellBox = await statusCell.boundingBox();
    assert.ok(cellBox);
    assert.ok(Math.abs((headerBox.x + headerBox.width / 2) -
      (cellBox.x + cellBox.width / 2)) < 3,
    "settlement status header and every badge must share the same centered column");
  }

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "خروجی CSV نمونه (اکسل)" }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "henna-settlements-demo.csv");

  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await table.evaluate((el) => el.parentElement.scrollWidth > el.parentElement.clientWidth),
    "small viewports scroll the settlement table without clipping columns");
  assert.deepEqual(apiMutations, []);
  assert.deepEqual(errors, []);
  await context.close();
  console.log("Seller settlement preview: sample totals, aligned statuses, redirect, CSV and mobile scroll OK");
} finally {
  if (browser) await browser.close();
  if (web?.pid) {
    try { process.kill(-web.pid, "SIGTERM"); } catch { /* already exited */ }
  }
}
