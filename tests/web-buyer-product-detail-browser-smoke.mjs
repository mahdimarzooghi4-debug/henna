/**
 * Frontend 018: shipping Next UI in real Chromium, CI-only public BFF doubles.
 * No price, images, offer or seller stock is created in production.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const base = "http://127.0.0.1:3012";
const A = "2fd59aad-5834-4717-9462-c5e520dd7a31";
const ID = "60000000-0000-4000-8000-000000000001";
const OTHER = "60000000-0000-4000-8000-000000000002";
const published = {
  id: ID, categoryId: A, name: "نام تأییدشدهٔ جزئیات CI",
  kind: "SERVICE", description: "شرح منتشرشدهٔ CI",
};
const good = {
  ...published, id: OTHER, name: "کالای قابل خرید آیندهٔ CI", kind: "GOOD",
  unitName: "کیلوگرم", quantityScale: 1,
};
const offers = {
  items: [{
    id: "70000000-0000-4000-8000-000000000001",
    sellerName: "فروشگاه تأییدشدهٔ CI", priceRials: 1250000,
    sellableQuantity: 2.5, unitName: "کیلوگرم", quantityScale: 1,
    updatedAtUtc: "2026-09-28T12:30:00Z",
  }], page: 1, pageSize: 20, total: 1,
};
const json = (body, status = 200) => ({
  status, contentType: "application/json; charset=utf-8",
  headers: { "Cache-Control": "no-store" }, body: JSON.stringify(body),
});
let mode = "published";
let offerMode = "published";
let calls = [];
let cartRequests = [];
let cart = { revision: 0, items: [] };
let web, browser, logs = "";
async function startWeb() {
  web = spawn("npm", ["run", "start", "--workspace",
    "@hana/web-marketplace", "--", "-p", "3012", "-H", "127.0.0.1"],
  { detached: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } });
  web.stdout.on("data", b => { logs += b.toString(); });
  web.stderr.on("data", b => { logs += b.toString(); });
  for (let n = 0; n < 45; n++) {
    if (web.exitCode !== null) throw Error("Next exited: " + logs);
    try {
      if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).ok) return;
    } catch { /* waiting */ }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw Error("Next never ready: " + logs);
}
async function main() {
  await startWeb();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "fa-IR", viewport: { width: 1440, height: 900 },
  });
  await context.addCookies([{ name: "hana_session", value: "hn1_" + "A".repeat(43),
    domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
  await context.route("**/api/catalog/**", async route => {
    const req = route.request();
    const url = new URL(req.url());
    assert.equal(req.method(), "GET");
    assert.equal(req.headers().authorization, undefined);
    assert.equal(req.headers().cookie, undefined);
    assert.equal(req.headers()["cache-control"], "no-store");
    calls.push(url.pathname);
    if (url.pathname.endsWith("/categories"))
      return route.fulfill(json({ items: [] }));
    if (url.pathname === "/api/catalog/products")
      return route.fulfill(json({
        items: [published], total: 1, page: 1, pageSize: 20,
      }));
    if (url.pathname === "/api/catalog/products/" + OTHER)
      return route.fulfill(json(good));
    if (url.pathname === "/api/catalog/products/" + OTHER + "/offers") {
      assert.equal(url.searchParams.get("page"), "1");
      assert.equal(url.searchParams.get("pageSize"), "20");
      if (offerMode === "503") return route.fulfill(json({}, 503));
      if (offerMode === "malformed") return route.fulfill(json({ ...offers, items: [{ ...offers.items[0], sellerAccountId: "SECRET" }] }));
      if (offerMode === "empty") return route.fulfill(json({ items: [], page: 1, pageSize: 20, total: 0 }));
      return route.fulfill(json(offers));
    }
    assert.equal(url.pathname, "/api/catalog/products/" + ID);
    if (mode === "404") return route.fulfill(json({}, 404));
    if (mode === "503") return route.fulfill(json({}, 503));
    if (mode === "malformed") return route.fulfill(json({ kind: "BAD" }));
    if (mode === "wrong-id") return route.fulfill(json({ ...published, id: OTHER }));
    return route.fulfill(json({
      ...published, sellerPhone: "SECRET", price: 1200, stock: 7,
    }));
  });
  const fakeCart = async route => {
    const req = route.request();
    const url = new URL(req.url());
    cartRequests.push({ method: req.method(), pathname: url.pathname });
    if (req.method() === "GET")
      return route.fulfill(json(cart));
    if (req.method() === "PUT") {
      const body = req.postDataJSON();
      assert.equal(body.revision, cart.revision);
      cart = { revision: cart.revision + 1, items: [{
        productId: OTHER, quantity: body.quantity,
        unitName: "کیلوگرم", quantityScale: 1,
      }] };
      return route.fulfill(json(cart));
    }
    if (req.method() === "DELETE") {
      assert.equal(url.searchParams.get("revision"), String(cart.revision));
      cart = { revision: cart.revision + 1, items: [] };
      return route.fulfill(json(cart));
    }
    return route.fulfill(json({ message: "unexpected method" }, 405));
  };
  await context.route("**/api/buyer/cart", fakeCart);
  await context.route("**/api/buyer/cart/items/*", fakeCart);
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(base);
  await page.getByRole("link", { name: published.name, exact: true }).click();
  await page.waitForURL(base + "/products/" + ID);
  await page.getByRole("heading", { name: published.name }).waitFor();
  assert.equal(await page.getByText("شرح منتشرشدهٔ CI").count(), 1);
  assert.equal(await page.getByText(A).count(), 1);
  assert.equal(await page.getByText("SECRET").count(), 0);
  assert.equal(await page.getByText("1200").count(), 0);
  assert.equal(await page.getByRole("button", { name: /سبد|خرید/ }).count(), 0);
  await page.getByRole("link", { name: "بازگشت به فهرست کالاها" }).click();
  await page.getByRole("link", { name: published.name, exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/");

  await page.goto(base + "/products/" + OTHER);
  await page.getByRole("heading", { name: good.name }).waitFor();
  await page.getByText("فروشگاه تأییدشدهٔ CI", { exact: true }).waitFor();
  await page.getByText(/۱٬۲۵۰٬۰۰۰ ریال/).waitFor();
  await page.getByText(/۲٫۵ کیلوگرم/).waitFor();
  await page.getByRole("button", { name: "ذخیره در سبد مرجع" }).waitFor();
  await page.getByLabel("مقدار به کیلوگرم").fill("2.5");
  await page.getByRole("button", { name: "ذخیره در سبد مرجع" }).click();
  try {
    await page.getByText("مقدار در سبد مرجع ذخیره شد.").waitFor();
  } catch (error) {
    const statuses = await page.getByRole("status").allTextContents();
    throw new Error(`reference cart save not confirmed; status=${JSON.stringify(statuses)} requests=${JSON.stringify(cartRequests)}: ${error}`);
  }
  assert.deepEqual(cart, { revision: 1, items: [{ productId: OTHER,
    quantity: 2.5, unitName: "کیلوگرم", quantityScale: 1 }] });
  await page.getByRole("link", { name: "مشاهدهٔ سبد مرجع" }).click();
  await page.waitForURL(base + "/buyer/cart");
  await page.getByRole("heading", { name: good.name }).waitFor();
  await page.getByText("2.5 کیلوگرم · مقدار درخواستی").waitFor();
  await page.getByRole("button", { name: "حذف از سبد" }).click();
  await page.getByRole("heading", { name: "سبد مرجع خالی است" }).waitFor();
  assert.deepEqual(cart, { revision: 2, items: [] });

  await page.goto(base + "/products/" + OTHER);
  offerMode = "503";
  await page.reload();
  await page.getByText(/دریافت پیشنهادها تأیید نشد/).waitFor();
  assert.equal(await page.getByText("فروشگاه تأییدشدهٔ CI", { exact: true }).count(), 0,
    "uncertain offer reads must not keep stale seller or price data visible");
  offerMode = "malformed";
  await page.getByRole("button", { name: "تلاش دوباره" }).click();
  await page.getByText(/دریافت پیشنهادها تأیید نشد/).waitFor();
  assert.equal(await page.getByText(/۱٬۲۵۰٬۰۰۰ ریال/).count(), 0);
  offerMode = "empty";
  await page.getByRole("button", { name: "تلاش دوباره" }).click();
  await page.getByText(/پیشنهاد منتشرشده‌ای برای این کالا ثبت نشده/).waitFor();
  offerMode = "published";

  mode = "404";
  await page.goto(base + "/products/" + ID);
  await page.getByRole("heading", { name: "این کالا یا خدمت پیدا نشد" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "تلاش دوباره برای دریافت جزئیات" }).count(), 0);
  assert.equal(await page.getByText(published.name).count(), 0);

  mode = "503";
  await page.reload();
  await page.getByRole("heading", { name: "دریافت جزئیات تأیید نشد" }).waitFor();
  assert.equal(await page.getByText(published.name).count(), 0);
  mode = "malformed";
  await page.getByRole("button", { name: "تلاش دوباره برای دریافت جزئیات" }).click();
  await page.getByRole("heading", { name: "دریافت جزئیات تأیید نشد" }).waitFor();
  mode = "wrong-id";
  await page.getByRole("button", { name: "تلاش دوباره برای دریافت جزئیات" }).click();
  await page.getByRole("heading", { name: "دریافت جزئیات تأیید نشد" }).waitFor();
  mode = "published";
  await page.getByRole("button", { name: "تلاش دوباره برای دریافت جزئیات" }).click();
  await page.getByRole("heading", { name: published.name }).waitFor();
  const beforeInvalid = calls.filter(x => x.startsWith("/api/catalog/products/")).length;
  await page.goto(base + "/products/not-a-uuid");
  await page.getByRole("heading", { name: "این کالا یا خدمت پیدا نشد" }).waitFor();
  assert.equal(calls.filter(x => x.startsWith("/api/catalog/products/")).length,
    beforeInvalid);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/products/" + ID);
  await page.getByRole("heading", { name: published.name }).waitFor();
  assert.equal(await page.evaluate(() =>
    document.documentElement.scrollWidth <= window.innerWidth), true);

  // Frontend 028: real mobile-width Next UI rechecks published detail when
  // coming back to a frozen browser tab or a persisted bfcache page.
  // All responses below come only from this test's in-memory HTTP fixture.
  const savedDetail = base + "/products/" + ID + "?search=" +
    encodeURIComponent("جست‌وجوی فارسی") + "&page=2";
  await page.goto(savedDetail);
  await page.getByRole("heading", { name: published.name }).waitFor();
  const detailCalls = () => calls.filter(x =>
    x === "/api/catalog/products/" + ID).length;
  const beforeResume = detailCalls();
  mode = "503";
  await page.evaluate(() => {
    document.dispatchEvent(new Event("visibilitychange"));
    // Mobile WebKit may emit both signals for one restore; do not request
    // the same detail twice.
    window.dispatchEvent(new PageTransitionEvent("pageshow", {
      persisted: true,
    }));
  });
  await page.getByRole("heading", {
    name: "دریافت جزئیات تأیید نشد",
  }).waitFor();
  assert.equal(await page.getByText(published.name).count(), 0,
    "a 503 must not leave the previously published detail visible");
  assert.equal(detailCalls(), beforeResume + 1);
  assert.equal(page.url(), savedDetail,
    "an uncertain response must not overwrite the saved browse location");
  const backHref = await page.getByRole("link", {
    name: "بازگشت به فهرست کالاها",
  }).getAttribute("href");
  const backLocation = new URL(backHref, base);
  assert.equal(backLocation.origin, base);
  assert.equal(backLocation.pathname, "/");
  assert.equal(backLocation.searchParams.get("search"), "جست‌وجوی فارسی");
  assert.equal(backLocation.searchParams.get("page"), "2");
  assert.deepEqual([...backLocation.searchParams.keys()].sort(),
    ["page", "search"]);

  mode = "published";
  await page.waitForTimeout(550);
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")));
  await page.getByRole("heading", { name: published.name }).waitFor();
  assert.equal(await page.getByText("شرح منتشرشدهٔ CI").count(), 1);

  // Confirmed 404 means the item is no longer publicly available. Unlike
  // an outage, do not keep showing its previously published name/description.
  mode = "404";
  await page.waitForTimeout(550);
  await page.evaluate(() => window.dispatchEvent(
    new PageTransitionEvent("pageshow", { persisted: true }),
  ));
  await page.getByRole("heading", {
    name: "این کالا یا خدمت پیدا نشد",
  }).waitFor();
  assert.equal(await page.getByText(published.name).count(), 0);
  assert.equal(await page.getByText("شرح منتشرشدهٔ CI").count(), 0);
  assert.equal(page.url(), savedDetail);

  // A previously missing public detail can be republished. Recheck 404 on
  // return too; an ordinary non-persisted pageshow must not double-fetch.
  mode = "published";
  await page.waitForTimeout(550);
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")));
  await page.getByRole("heading", { name: published.name }).waitFor();
  const afterRecovery = detailCalls();
  await page.evaluate(() => window.dispatchEvent(
    new PageTransitionEvent("pageshow", { persisted: false }),
  ));
  await page.waitForTimeout(80);
  assert.equal(detailCalls(), afterRecovery);
  assert.equal(page.url(), savedDetail);
  assert.deepEqual(errors, []);
  await context.close();
  console.log("Web public detail Chromium: link, direct URL, retry, 390px and frozen-tab/bfcache 200/404/503 recovery OK");
}
try { await main(); }
finally {
  if (browser) await browser.close();
  if (web?.pid) {
    try { process.kill(-web.pid, "SIGTERM"); } catch { /* already stopped */ }
  }
}
