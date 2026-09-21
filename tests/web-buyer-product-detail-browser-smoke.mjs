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
const json = (body, status = 200) => ({
  status, contentType: "application/json; charset=utf-8",
  headers: { "Cache-Control": "no-store" }, body: JSON.stringify(body),
});
let mode = "published";
let calls = [];
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
      return route.fulfill(json({
        ...published, id: OTHER, name: "کالای دیگر", description: null,
      }));
    assert.equal(url.pathname, "/api/catalog/products/" + ID);
    if (mode === "404") return route.fulfill(json({}, 404));
    if (mode === "503") return route.fulfill(json({}, 503));
    if (mode === "malformed") return route.fulfill(json({ kind: "BAD" }));
    if (mode === "wrong-id") return route.fulfill(json({ ...published, id: OTHER }));
    return route.fulfill(json({
      ...published, sellerPhone: "SECRET", price: 1200, stock: 7,
    }));
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(base);
  await page.getByRole("link", { name: published.name, exact: true }).click();
  await page.getByRole("heading", { name: published.name }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/products/" + ID);
  assert.equal(await page.getByText("شرح منتشرشدهٔ CI").count(), 1);
  assert.equal(await page.getByText(A).count(), 1);
  assert.equal(await page.getByText("SECRET").count(), 0);
  assert.equal(await page.getByText("1200").count(), 0);
  assert.equal(await page.getByRole("button", { name: /سبد|خرید/ }).count(), 0);
  await page.getByRole("link", { name: "بازگشت به فهرست کالاها" }).click();
  await page.getByRole("link", { name: published.name, exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/");

  await page.goto(base + "/products/" + OTHER);
  await page.getByRole("heading", { name: "کالای دیگر" }).waitFor();
  assert.equal(await page.getByText("شرح منتشرشدهٔ CI").count(), 0);

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
  assert.deepEqual(errors, []);
  await context.close();
  console.log("Web public detail Chromium: link, direct URL, 200/404/503, invalid/mismatched, retry and 390px OK");
}
try { await main(); }
finally {
  if (browser) await browser.close();
  if (web?.pid) {
    try { process.kill(-web.pid, "SIGTERM"); } catch { /* already stopped */ }
  }
}
