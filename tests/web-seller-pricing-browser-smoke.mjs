/**
 * Actual Chromium against CI-only seller pricing PREVIEW.
 * This test never modifies offers, quotes, actual pricing or discount APIs.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const base = "http://127.0.0.1:3012";
let web;
let browser;
let logs = "";

async function startWeb() {
  web = spawn("npm", ["run", "start", "--workspace", "@hana/web-marketplace",
    "--", "-p", "3012", "-H", "127.0.0.1"], {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, HANA_AUTH_UI_PREVIEW: "1", NEXT_TELEMETRY_DISABLED: "1" },
  });
  web.stdout.on("data", (chunk) => { logs += chunk.toString(); });
  web.stderr.on("data", (chunk) => { logs += chunk.toString(); });
  for (let i = 0; i < 45; i++) {
    if (web.exitCode !== null) throw Error("Next server exited: " + logs);
    try {
      const result = await fetch(base + "/seller/panel/pricing", {
        signal: AbortSignal.timeout(1000), redirect: "manual",
      });
      if (result.status === 200) return;
    } catch { /* retry */ }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw Error("Seller pricing preview unavailable: " + logs);
}

try {
  await startWeb();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "fa-IR" });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const pageErrors = [];
  const apiMutations = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (req) => {
    if (new URL(req.url()).pathname.startsWith("/api/") && !["GET", "HEAD"].includes(req.method())) {
      apiMutations.push(req.method() + " " + req.url());
    }
  });

  await page.goto(base + "/seller/panel/pricing");
  await page.getByRole("heading", { name: "قیمت‌گذاری اقلام" }).waitFor();
  await page.getByText("پیش‌نمایش طراحی").waitFor();
  const header = page.getByRole("columnheader", { name: "عملیات قیمت‌گذاری" });
  const firstRow = page.getByRole("row", { name: /نان بربری سنتی سبوس‌دار/ });
  const actionCell = firstRow.getByRole("cell").last();
  const headingBox = await header.boundingBox();
  const cellBox = await actionCell.boundingBox();
  assert.ok(headingBox && cellBox);
  assert.ok(Math.abs((headingBox.x + headingBox.width / 2) -
    (cellBox.x + cellBox.width / 2)) < 3,
  "actions header and buttons must share the same horizontally centered column");
  assert.equal(await firstRow.getByRole("button", { name: "ویرایش قیمت" }).count(), 1);
  assert.equal(await firstRow.getByRole("button", { name: "اعمال تخفیف" }).count(), 1);

  // Validation must reject equal/higher than base prices.
  await firstRow.getByRole("button", { name: "اعمال تخفیف" }).click();
  const dialog = page.getByRole("dialog", { name: "اعمال تخفیف" });
  await dialog.getByLabel("قیمت فروش با تخفیف (تومان)").fill("۸۵۰۰");
  await dialog.getByRole("button", { name: "نمایش تخفیف" }).click();
  await dialog.getByRole("alert").getByText(/کمتر از قیمت اصلی/).waitFor();
  await dialog.getByLabel("قیمت فروش با تخفیف (تومان)").fill("۷۰۰۰");
  await dialog.getByText("تخفیف:").count(); // savings appears as a computed preview
  await dialog.getByRole("button", { name: "نمایش تخفیف" }).click();
  await firstRow.getByText("۷٬۰۰۰ تومان").waitFor();
  await firstRow.getByText("تخفیف ۱٬۵۰۰ تومان").waitFor();
  assert.equal(await firstRow.getByRole("button", { name: "ویرایش تخفیف" }).count(), 1);
  assert.equal(await page.getByRole("status").getByText(/قیمت واقعی فروشگاه تغییر نکرده/).count(), 1);

  // Seller can undo a preview discount without editing the original price.
  await firstRow.getByRole("button", { name: "حذف تخفیف" }).click();
  await firstRow.getByText("۸٬۵۰۰ تومان").waitFor();
  assert.equal(await firstRow.getByRole("button", { name: "اعمال تخفیف" }).count(), 1);
  await firstRow.getByRole("button", { name: "ویرایش قیمت" }).click();
  const priceDialog = page.getByRole("dialog", { name: "ویرایش قیمت" });
  await priceDialog.getByLabel("قیمت جدید (تومان)").fill("۹۰۰۰");
  await priceDialog.getByRole("button", { name: "ثبت قیمت نمایشی" }).click();
  await firstRow.getByText("۹٬۰۰۰ تومان").waitFor();

  await page.setViewportSize({ width: 390, height: 844 });
  const table = page.getByRole("table");
  assert.ok(await table.evaluate((element) => {
    const wrapper = element.parentElement;
    return wrapper && wrapper.scrollWidth > wrapper.clientWidth;
  }), "narrow viewports must scroll the table instead of overlapping its columns");

  assert.deepEqual(apiMutations, [], "preview must not mutate real seller pricing, discounts or offers");
  assert.deepEqual(pageErrors, []);
  await context.close();
  console.log("Seller pricing preview: aligned columns, discounted price, validity, removal, base edit, responsive layout OK");
} finally {
  if (browser) await browser.close();
  if (web?.pid) {
    try { process.kill(-web.pid, "SIGTERM"); } catch { /* already exited */ }
  }
}
