import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const base = "http://127.0.0.1:3013";
const PRODUCT_A = "60000000-0000-4000-8000-000000000001";
const PRODUCT_B = "60000000-0000-4000-8000-000000000002";
const SELLER_A = "70000000-0000-4000-8000-000000000001";
const SELLER_B = "70000000-0000-4000-8000-000000000002";
const cart = { revision: 7, items: [
  { productId: PRODUCT_A, quantity: 2.5, unitName: "کیلوگرم", quantityScale: 1 },
  { productId: PRODUCT_B, quantity: 4, unitName: "عدد", quantityScale: 0 },
] };
const comparison = {
  cartRevision: 7,
  items: cart.items.map(item => ({ ...item, status: "HAS_PUBLISHED_OFFERS" })),
  sellers: [
    { sellerPublicId: SELLER_A, sellerName: "فروشگاه هم‌نام", offers: [
      { productId: PRODUCT_A, offerId: "71000000-0000-4000-8000-000000000001", priceRials: 1250000, sellableQuantity: 2.5, requestedQuantity: 2.5, unitName: "کیلوگرم", quantityScale: 1, coversRequestedQuantity: true, updatedAtUtc: "2026-09-28T12:30:00Z" },
      { productId: PRODUCT_B, offerId: "71000000-0000-4000-8000-000000000002", priceRials: 850000, sellableQuantity: 4, requestedQuantity: 4, unitName: "عدد", quantityScale: 0, coversRequestedQuantity: true, updatedAtUtc: "2026-09-28T12:30:00Z" },
    ] },
    { sellerPublicId: SELLER_B, sellerName: "فروشگاه هم‌نام", offers: [
      { productId: PRODUCT_A, offerId: "71000000-0000-4000-8000-000000000003", priceRials: 1300000, sellableQuantity: 5, requestedQuantity: 2.5, unitName: "کیلوگرم", quantityScale: 1, coversRequestedQuantity: true, updatedAtUtc: "2026-09-28T12:30:00Z" },
      { productId: PRODUCT_B, offerId: "71000000-0000-4000-8000-000000000004", priceRials: 850000, sellableQuantity: 3, requestedQuantity: 4, unitName: "عدد", quantityScale: 0, coversRequestedQuantity: false, updatedAtUtc: "2026-09-28T12:30:00Z" },
    ] },
  ],
};
const payload = (body, status = 200) => ({ status, contentType: "application/json; charset=utf-8", headers: { "Cache-Control": "no-store" }, body: JSON.stringify(body) });
let web, browser, logs = "";
async function startWeb() {
  web = spawn("npm", ["run", "start", "--workspace", "@hana/web-marketplace", "--", "-p", "3013", "-H", "127.0.0.1"], { detached: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } });
  web.stdout.on("data", b => { logs += b.toString(); });
  web.stderr.on("data", b => { logs += b.toString(); });
  for (let n = 0; n < 45; n++) {
    if (web.exitCode !== null) throw Error("Next exited: " + logs);
    try { if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).ok) return; } catch { }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw Error("Next never ready: " + logs);
}

async function main() {
  await startWeb();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: "fa-IR", viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const mutations = [];
  page.on("pageerror", error => consoleErrors.push(error.message));
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.route("**/api/buyer/cart", route => route.fulfill(payload(cart)));
  await page.route("**/api/buyer/cart/offers", route => route.fulfill(payload(comparison)));
  await page.route("**/api/buyer/cart/items/**", route => { mutations.push(route.request().method()); return route.fulfill(payload(cart)); });
  await page.route("**/api/catalog/products/**", route => {
    const id = new URL(route.request().url()).pathname.split("/").at(-1);
    const product = id === PRODUCT_A
      ? { id, categoryId: SELLER_A, name: "کالای اول", kind: "GOOD", description: null, unitName: "کیلوگرم", quantityScale: 1 }
      : { id, categoryId: SELLER_A, name: "کالای دوم", kind: "GOOD", description: null, unitName: "عدد", quantityScale: 0 };
    return route.fulfill(payload(product));
  });
  await page.goto(base + "/buyer/cart");
  await page.getByRole("heading", { name: "مقایسهٔ پیشنهادهای فروشندگان" }).waitFor();
  await page.getByText("قیمت هر کیلوگرم: ۱٬۲۵۰٬۰۰۰ ریال").waitFor();
  assert.equal(await page.getByRole("heading", { name: "فروشگاه هم‌نام" }).count(), 2, "separate opaque seller IDs must remain separate even with the same display name");
  assert.equal(await page.getByText("پوشش کامل مقدار درخواستی").count(), 1);
  assert.equal(await page.getByText("پوشش کامل ندارد").count(), 1);
  await page.getByText(/برای مقدار درخواستی \(۴ عدد\) کافی نیست/).waitFor();
  await page.getByText(/موجودی زنده/).waitFor();
  assert.equal(mutations.length, 0, "comparison must not mutate the reference cart");

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert.equal(overflow, false, "mobile comparison must not overflow horizontally");
  assert.equal(await page.locator(".buyer-cart-comparison__sellers").evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").length), 1);
  assert.equal(consoleErrors.length, 0, "browser errors: " + consoleErrors.join("; "));
  console.log("Buyer cart offer comparison browser smoke: opaque seller grouping, complete/insufficient declared quantity, no cart mutation, and mobile layout verified");
}

try { await main(); } finally { if (browser) await browser.close(); if (web?.pid) { try { process.kill(-web.pid, "SIGTERM"); } catch { } } }
