import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const base = "http://127.0.0.1:3007";
const productId = "4ef06bf5-32f3-4b10-a41e-5bd69f6bb442";
const categoryId = "fbf47579-71b4-4b85-996c-842ac497fb12";
const offerId = "7f4b4df8-69c1-4c11-8eef-0d8e2ae6a851";
const at = "2026-09-28T10:00:00Z";
let web;
let browser;
let errors = [];
let operations = [];
let published = false;

const json = (body, status = 200) => ({ status,
  contentType: "application/json; charset=utf-8",
  headers: { "Cache-Control": "no-store" }, body: JSON.stringify(body) });

async function mockApi(route) {
  const req = route.request();
  const url = new URL(req.url());
  if (url.pathname === "/api/seller/offers" && req.method() === "GET")
    return route.fulfill(json({ items: published ? [{
      id: offerId, catalogProductId: productId, status: "PUBLISHED",
      revision: 3, priceRials: 1250000, sellableQuantity: 2.125,
      createdAtUtc: at, updatedAtUtc: at, catalogProduct: {
        id: productId, name: "کالای آزمون", categoryName: "دسته آزمون",
        description: null, primaryMediaRoute: null, unitName: "کیلوگرم",
        quantityScale: 3,
      },
    }] : [] }));
  if (url.pathname === "/api/seller/catalog/goods" && req.method() === "GET")
    return route.fulfill(json({ items: [{ id: productId, categoryId,
      name: "کالای آزمون", categoryName: "دسته آزمون", description: null,
      unitName: "کیلوگرم", quantityScale: 3, imageUrl: null }],
      categories: [{ id: categoryId, name: "دسته آزمون", slug: "test" }],
      page: 1, pageSize: 50, total: 1 }));
  if (url.pathname === "/api/seller/offers" && req.method() === "POST") {
    assert.deepEqual(req.postDataJSON(), { catalogProductId: productId });
    assert.ok(req.headers()["idempotency-key"]);
    operations.push("create");
    return route.fulfill(json({ id: offerId, catalogProductId: productId,
      status: "DRAFT", revision: 1, priceRials: null, sellableQuantity: null,
      createdAtUtc: at, updatedAtUtc: at, catalogProduct: null }, 201));
  }
  if (url.pathname === `/api/seller/offers/${offerId}` && req.method() === "PUT") {
    assert.deepEqual(req.postDataJSON(), { expectedRevision: 1,
      priceRials: 1250000, sellableQuantity: 2.125 });
    operations.push("update");
    return route.fulfill(json({ id: offerId, catalogProductId: productId,
      status: "DRAFT", revision: 2, priceRials: 1250000,
      sellableQuantity: 2.125, createdAtUtc: at, updatedAtUtc: at }));
  }
  if (url.pathname === `/api/seller/offers/${offerId}/publish` && req.method() === "POST") {
    assert.deepEqual(req.postDataJSON(), { expectedRevision: 2 });
    operations.push("publish"); published = true;
    return route.fulfill(json({ id: offerId, catalogProductId: productId,
      status: "PUBLISHED", revision: 3, priceRials: 1250000,
      sellableQuantity: 2.125, createdAtUtc: at, updatedAtUtc: at }));
  }
  throw new Error(`Unexpected request ${req.method()} ${url.pathname}`);
}

async function startWeb() {
  web = spawn("npm", ["run", "start", "--workspace", "@hana/web-marketplace",
    "--", "-p", "3007", "-H", "127.0.0.1"], { detached: true,
    stdio: ["ignore", "pipe", "pipe"], env: { ...process.env,
      NEXT_TELEMETRY_DISABLED: "1" } });
  let output = "";
  web.stdout.on("data", chunk => { output += chunk.toString(); });
  web.stderr.on("data", chunk => { output += chunk.toString(); });
  for (let i = 0; i < 45; i++) {
    if (web.exitCode !== null) throw new Error(`Next exited: ${output}`);
    try { if ((await fetch(base + "/seller/offers")).ok) return; } catch { /* wait */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`Next did not start: ${output}`);
}

try {
  await startWeb();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "fa-IR" });
  await context.route("**/api/**", mockApi);
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(base + "/seller/offers");
  await page.getByRole("heading", { name: "کالاهای فروشگاه" }).waitFor();
  await page.getByRole("button", { name: "افزودن کالای فروشگاه" }).first().click();
  await page.getByRole("heading", { name: "افزودن کالای فروشگاه" }).waitFor();
  await page.getByLabel("کالای کاتالوگ").selectOption(productId);
  await page.getByLabel("قیمت هر واحد (ریال)").fill("1250000");
  await page.getByLabel("موجودی قابل عرضه").fill("2.125");
  await page.getByRole("button", { name: "ثبت و انتشار" }).click();
  await page.getByRole("heading", { name: "کالاهای فروشگاه" }).waitFor();
  await page.getByText("منتشرشده", { exact: true }).waitFor();
  assert.deepEqual(operations, ["create", "update", "publish"]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(100);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    "seller offer page must not overflow a mobile viewport");
  assert.deepEqual(errors, []);
  console.log("Chromium seller offer flow: Catalog selection → revision update → publish → mobile layout OK");
} finally {
  if (browser) await browser.close();
  if (web?.pid) { try { process.kill(-web.pid, "SIGTERM"); } catch { /* already exited */ } }
}
