/**
 * Frontend 019: real built Next.js/Chromium browser history and share links.
 * Browser network doubles serve ephemeral published CI content only.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const base = "http://127.0.0.1:3013";
const A = "2fd59aad-5834-4717-9462-c5e520dd7a31";
const B = "4ef06bf5-32f3-4b10-a41e-5bd69f6bb442";
const good = Array.from({ length: 25 }, (_, n) => ({
  id: "60000000-0000-4000-8000-" + String(n + 1).padStart(12, "0"),
  categoryId: n < 21 ? A : B, name: "کالای مرور واقعی CI " + (n + 1),
  kind: "GOOD", description: n === 20 ? "جزئیات بیست و یکم" : null,
}));
const q = state => {
  const params = new URLSearchParams(state);
  return params.toString();
};
let web, browser, logs = "";
const calls = [];
function json(data, status = 200) {
  return { status, contentType: "application/json; charset=utf-8",
    headers: { "Cache-Control": "no-store" }, body: JSON.stringify(data) };
}
async function start() {
  web = spawn("npm", ["run", "start", "--workspace",
    "@hana/web-marketplace", "--", "-p", "3013", "-H", "127.0.0.1"],
  { detached: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } });
  web.stdout.on("data", b => { logs += b.toString(); });
  web.stderr.on("data", b => { logs += b.toString(); });
  for (let i = 0; i < 45; i++) {
    if (web.exitCode !== null) throw Error("Next exited: " + logs);
    try {
      if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).ok)
        return;
    } catch { /* not ready */ }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw Error("Next unavailable: " + logs);
}
async function main() {
  await start();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "fa-IR", viewport: { width: 1440, height: 900 },
  });
  await context.route("**/api/catalog/**", async route => {
    const req = route.request();
    const u = new URL(req.url());
    assert.equal(req.method(), "GET");
    assert.equal(req.headers().cookie, undefined);
    assert.equal(req.headers().authorization, undefined);
    assert.equal(req.headers()["cache-control"], "no-store");
    calls.push({ path: u.pathname, search: u.searchParams });
    if (u.pathname.endsWith("/categories")) return route.fulfill(json({
      items: [
        { id: A, name: "دستهٔ یک CI", slug: "ci-a" },
        { id: B, name: "دستهٔ دو CI", slug: "ci-b" },
      ],
    }));
    if (u.pathname === "/api/catalog/products") {
      const page = Number(u.searchParams.get("page"));
      assert.equal(u.searchParams.get("pageSize"), "20");
      let items = good;
      const cat = u.searchParams.get("categoryId");
      const term = u.searchParams.get("search");
      if (cat) items = items.filter(x => x.categoryId === cat);
      if (term) items = items.filter(x => x.name.includes(term));
      return route.fulfill(json({
        items: items.slice((page - 1) * 20, page * 20),
        page, pageSize: 20, total: items.length,
      }));
    }
    const id = u.pathname.split("/").at(-1);
    const product = good.find(x => x.id === id);
    return route.fulfill(product ? json(product) : json({}, 404));
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  const shared = "/?" + q({ categoryId: A, search: "کالای مرور", page: "2" });
  const detail = "/products/" + good[20].id + "?" + shared.slice(2);

  // A direct, shared URL must load page 2 from the first real catalog
  // response: not first page then a UI-only claim of page 2.
  await page.goto(base + shared);
  await page.getByRole("heading", { name: good[20].name, exact: true }).waitFor();
  assert.equal(await page.locator(".buyer-product").count(), 1);
  assert.equal(await page.locator("#buyer-search").inputValue(), "کالای مرور");
  assert.equal(await page.getByRole("button", {
    name: "دستهٔ یک CI",
  }).getAttribute("aria-pressed"), "true");
  assert.equal(new URL(page.url()).search, shared.slice(1));
  assert.equal(calls.find(x => x.path === "/api/catalog/products")
    .search.get("page"), "2");

  // The real product link and both detail back links are same-origin and
  // retain the exact validated browse state through the Next route.
  const productLink = page.getByRole("link", {
    name: good[20].name, exact: true,
  });
  assert.equal(new URL(await productLink.getAttribute("href"), base).pathname,
    "/products/" + good[20].id);
  await productLink.click();
  await page.waitForURL(base + detail);
  await page.getByRole("heading", { name: good[20].name, exact: true }).waitFor();
  assert.equal(await page.getByRole("link", {
    name: "بازگشت به فهرست کالاها",
  }).getAttribute("href"), shared);
  assert.equal(await page.getByRole("link", {
    name: "بازگشت به فهرست", exact: true,
  }).getAttribute("href"), shared);
  await page.getByRole("link", {
    name: "بازگشت به فهرست کالاها",
  }).click();
  await page.waitForURL(base + shared);
  await page.getByRole("heading", { name: good[20].name, exact: true }).waitFor();
  assert.equal(await page.locator(".buyer-product").count(), 1);

  // Refresh, Back and Forward are controlled by the URL, not lost React
  // state from a prior page; filter/search page resets update URL as well.
  await page.reload();
  await page.getByRole("heading", { name: good[20].name, exact: true }).waitFor();
  await page.getByRole("button", { name: "همه دسته‌ها" }).click();
  await page.waitForURL(base + "/?" + q({ search: "کالای مرور" }));
  await page.getByRole("heading", { name: good[0].name, exact: true }).waitFor();
  assert.equal(await page.locator(".buyer-product").count(), 20);
  await page.getByRole("button", { name: "صفحهٔ بعد" }).click();
  await page.waitForURL(base + "/?" + q({ search: "کالای مرور", page: "2" }));
  await page.getByRole("heading", { name: good[20].name, exact: true }).waitFor();
  assert.equal(await page.locator(".buyer-product").count(), 5);
  await page.goBack();
  await page.waitForURL(base + "/?" + q({ search: "کالای مرور" }));
  await page.getByRole("heading", { name: good[0].name, exact: true }).waitFor();
  assert.equal(await page.locator(".buyer-product").count(), 20);
  await page.goForward();
  await page.waitForURL(base + "/?" + q({ search: "کالای مرور", page: "2" }));
  await page.getByRole("heading", { name: good[20].name, exact: true }).waitFor();

  // Search submission resets page to one, encoded safely, and previous
  // category filter does not reappear by accident.
  await page.locator("#buyer-search").fill("کالای مرور واقعی CI 1");
  await page.getByRole("button", { name: "جست‌وجو", exact: true }).click();
  await page.waitForURL(base + "/?" + q({ search: "کالای مرور واقعی CI 1" }));
  await page.getByRole("heading", { name: good[0].name, exact: true }).waitFor();
  assert.equal(await page.getByRole("button", {
    name: "همه دسته‌ها",
  }).getAttribute("aria-pressed"), "true");

  // Unknown keys, oversized search, non-UUID category and out-of-range page
  // cannot sneak into a public request or be reused as external back href.
  const before = calls.length;
  await page.goto(base + "/?returnTo=https%3A%2F%2Fevil.test" +
    "&categoryId=bad&page=10001&search=" + "x".repeat(81));
  await page.getByRole("heading", { name: good[0].name, exact: true }).waitFor();
  assert.equal(new URL(page.url()).search, "");
  const list = calls.slice(before).filter(x => x.path === "/api/catalog/products");
  assert.ok(list.length >= 1);
  assert.deepEqual(
    [...list[0].search],
    [["page", "1"], ["pageSize", "20"]],
  );

  await page.goto(base + "/products/" + good[0].id +
    "?returnTo=https%3A%2F%2Fevil.test&categoryId=bad&page=-1");
  await page.getByRole("heading", { name: good[0].name, exact: true }).waitFor();
  assert.equal(await page.getByRole("link", {
    name: "بازگشت به فهرست کالاها",
  }).getAttribute("href"), "/");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + shared);
  await page.getByRole("heading", { name: good[20].name, exact: true }).waitFor();
  assert.equal(await page.evaluate(() =>
    document.documentElement.scrollWidth <= window.innerWidth), true);
  assert.deepEqual(errors, []);
  await context.close();
  console.log("Buyer URL state real Chromium: deep links, filtered paging, detail/back, reload, history and invalid input OK");
}
try { await main(); }
finally {
  if (browser) await browser.close();
  if (web?.pid) {
    try { process.kill(-web.pid, "SIGTERM"); } catch { /* stopped */ }
  }
}
