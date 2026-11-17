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
let comparison = {
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
let draftPayload = { revision: 0, sellerPublicId: null, updatedAtUtc: null, lines: [] };
const draftWrites = [];
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
  await page.route("**/api/buyer/cart/purchase-draft", async route => {
    const method = route.request().method();
    if (method === "GET") return route.fulfill(payload(draftPayload));
    const body = route.request().postDataJSON(); draftWrites.push({ method, body, key: route.request().headers()["idempotency-key"] });
    if (method === "DELETE") { draftPayload = { revision: body.revision + 1, sellerPublicId: null, updatedAtUtc: null, lines: [] }; return route.fulfill(payload(draftPayload)); }
    const seller = comparison.sellers.find(x => x.sellerPublicId === body.sellerPublicId);
    draftPayload = { revision: body.revision + 1, sellerPublicId: body.sellerPublicId, updatedAtUtc: "2026-09-28T12:30:00Z", lines: body.lines.map(line => {
      const offer = seller.offers.find(x => x.offerId === line.offerId);
      return { productId: line.productId, offerId: line.offerId, quantity: offer.requestedQuantity, unitName: offer.unitName, quantityScale: offer.quantityScale, expectedPriceRials: line.expectedPriceRials, currentPriceRials: offer.priceRials, currentSellableQuantity: offer.sellableQuantity, priceChanged: false, offerAvailable: true, coversRequestedQuantity: true };
    }) };
    return route.fulfill(payload(draftPayload));
  });
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

  await page.getByRole("button", { name: "انتخاب این فروشنده برای پیش‌نویس" }).first().click();
  await page.getByLabel("افزودن مقدار کامل این قلم به پیش‌نویس").first().check();
  await page.getByRole("button", { name: "ذخیرهٔ پیش‌نویس" }).click();
  await page.getByRole("region", { name: "پیش‌نویس انتخاب فروشنده" }).waitFor();
  assert.equal(draftWrites.length, 1, "draft is only written after explicit save");
  assert.equal(draftWrites[0].method, "PUT");
  assert.equal(draftWrites[0].body.lines.length, 1, "only the explicitly selected covered line is saved");
  assert.equal(draftWrites[0].body.sellerPublicId, SELLER_A);
  assert.equal(draftWrites[0].body.confirmCurrentPriceChanges, false);
  assert.ok(draftWrites[0].key, "writes include an idempotency key");
  assert.equal(mutations.length, 0, "saving a selection draft leaves the reference cart unchanged");

  comparison = { ...comparison, sellers: comparison.sellers.map(seller => seller.sellerPublicId === SELLER_A
    ? { ...seller, offers: seller.offers.map(offer => offer.offerId === "71000000-0000-4000-8000-000000000001" ? { ...offer, priceRials: 1_300_000 } : offer) }
    : seller) };
  draftPayload = { ...draftPayload, lines: draftPayload.lines.map(line => ({ ...line, currentPriceRials: 1_300_000, priceChanged: true })) };
  await page.reload();
  await page.getByText(/قیمت فعلی ۱٬۳۰۰٬۰۰۰ ریال — نیازمند تأیید/).waitFor();
  await page.getByRole("button", { name: "ذخیرهٔ پیش‌نویس" }).click();
  assert.equal(draftWrites.length, 1, "changed prices cannot be silently accepted");
  await page.getByLabel("قیمت جدیدِ نمایش‌داده‌شده را بررسی و برای این پیش‌نویس تأیید می‌کنم.").check();
  await page.getByRole("button", { name: "ذخیرهٔ پیش‌نویس" }).click();
  assert.equal(draftWrites.length, 2);
  assert.equal(draftWrites[1].body.lines[0].expectedPriceRials, 1_300_000, "explicit reconfirmation sends the displayed current price");
  assert.equal(draftWrites[1].body.confirmCurrentPriceChanges, true, "the explicit confirmation reaches the server contract");

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert.equal(overflow, false, "mobile comparison must not overflow horizontally");
  assert.equal(await page.locator(".buyer-cart-comparison__sellers").evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").length), 1);
  assert.equal(consoleErrors.length, 0, "browser errors: " + consoleErrors.join("; "));
  console.log("Buyer cart comparison and purchase draft browser smoke: explicit one-seller draft, uncovered cart preserved, price reconfirmation, no cart mutation, and mobile layout verified");
}

try { await main(); } finally { if (browser) await browser.close(); if (web?.pid) { try { process.kill(-web.pid, "SIGTERM"); } catch { } } }
