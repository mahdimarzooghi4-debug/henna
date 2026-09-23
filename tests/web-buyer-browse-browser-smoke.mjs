/**
 * Frontend 015: real production Next + Chromium buyer-home UI.
 * Only this test intercepts the browser's public BFF routes: all identities
 * and products are CI-memory fixtures, never production/catalog seed.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const base = "http://127.0.0.1:3011";
const categoryA = "2fd59aad-5834-4717-9462-c5e520dd7a31";
const categoryB = "4ef06bf5-32f3-4b10-a41e-5bd69f6bb442";
const categories = [
  { id: categoryA, name: "دستهٔ منتشرشدهٔ یک", slug: "published-one" },
  { id: categoryB, name: "دستهٔ منتشرشدهٔ دو", slug: "published-two" },
];
const goods = Array.from({ length: 21 }, (_, n) => ({
  id: "60000000-0000-4000-8000-" + String(n + 1).padStart(12, "0"),
  categoryId: n === 0 ? categoryA : categoryB,
  name: "عنوان واقعی API در تست " + String(n + 1),
  kind: n === 0 ? "SERVICE" : "GOOD",
  description: n === 0 ? "توضیح تأییدشدهٔ API" : null,
}));
let mode = "empty";
let publishedCategories = categories;
let calls = [];
let web, browser;
let logs = "";
const json = (body, status = 200) => ({
  status, contentType: "application/json; charset=utf-8",
  headers: { "Cache-Control": "no-store" }, body: JSON.stringify(body),
});

async function fakePublicCatalog(route) {
  const request = route.request();
  const url = new URL(request.url());
  assert.equal(request.method(), "GET");
  assert.equal(request.headers().authorization, undefined);
  assert.equal(request.headers().cookie, undefined);
  assert.equal(request.headers()["cache-control"], "no-store");
  calls.push({ pathname: url.pathname, params: Object.fromEntries(url.searchParams) });
  if (mode === "outage") return route.fulfill(json({ message: "outage" }, 503));
  if (mode === "malformed") return route.fulfill(json({ items: "invalid" }));
  if (url.pathname === "/api/catalog/categories") {
    return route.fulfill(json({
      items: mode === "empty" ? [] : publishedCategories,
    }));
  }
  assert.equal(url.pathname, "/api/catalog/products");
  assert.deepEqual([...url.searchParams.keys()].sort(),
    [
      "page", "pageSize",
      ...(url.searchParams.has("categoryId") ? ["categoryId"] : []),
      ...(url.searchParams.has("search") ? ["search"] : []),
    ].sort());
  const page = Number(url.searchParams.get("page"));
  assert.equal(url.searchParams.get("pageSize"), "20");
  let entries = mode === "empty" ? [] : goods;
  const id = url.searchParams.get("categoryId");
  if (id) entries = entries.filter((item) => item.categoryId === id);
  const search = url.searchParams.get("search");
  if (search) entries = entries.filter((item) =>
    item.name.includes(search) || item.description?.includes(search));
  return route.fulfill(json({
    page, pageSize: 20, total: entries.length,
    items: entries.slice((page - 1) * 20, page * 20)
      .map(item => ({ ...item, price: 1234, privateNote: "SECRET" })),
  }));
}

async function startWeb() {
  web = spawn("npm", ["run", "start", "--workspace",
    "@hana/web-marketplace", "--", "-p", "3011", "-H", "127.0.0.1"],
  { detached: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } });
  web.stdout.on("data", b => { logs += b.toString(); });
  web.stderr.on("data", b => { logs += b.toString(); });
  for (let n = 0; n < 45; n++) {
    if (web.exitCode !== null) throw Error("Next exited: " + logs);
    try {
      if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).ok) return;
    } catch { /* waiting */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw Error("Next never ready: " + logs);
}

async function main() {
  await startWeb();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }, locale: "fa-IR",
  });
  await context.route("**/api/catalog/**", fakePublicCatalog);
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", e => { errors.push(e.message); });

  await page.goto(base);
  await page.getByText("هنوز دسته‌بندی قابل نمایش در حنا ثبت نشده است.").waitFor();
  await page.getByRole("heading", { name: "فعلاً کالایی برای نمایش نداریم" }).waitFor();
  assert.equal(await page.getByRole("link", { name: "ورود / ثبت‌نام" }).count(), 1);
  assert.equal(await page.getByText("عنوان واقعی API در تست 1").count(), 0);

  mode = "rich";
  await page.reload();
  await page.getByRole("button", { name: "دستهٔ منتشرشدهٔ یک" }).waitFor();
  await page.getByRole("heading", { name: "عنوان واقعی API در تست 1", exact: true }).waitFor();
  assert.equal(await page.locator(".buyer-product").count(), 20);
  assert.equal(await page.getByText("SECRET").count(), 0);
  assert.equal(await page.getByText("1234").count(), 0);
  assert.equal(await page.getByRole("button", { name: /خرید|سبد/ }).count(), 0);
  await page.getByRole("button", { name: "صفحهٔ بعد" }).click();
  await page.getByRole("heading", { name: "عنوان واقعی API در تست 21", exact: true }).waitFor();
  assert.equal(await page.locator(".buyer-product").count(), 1);
  assert.equal(calls.at(-1).params.page, "2");

  await page.getByRole("button", { name: "دستهٔ منتشرشدهٔ یک" }).click();
  await page.getByRole("heading", { name: "عنوان واقعی API در تست 1", exact: true }).waitFor();
  assert.equal(calls.at(-1).params.page, "1");
  assert.equal(calls.at(-1).params.categoryId, categoryA);
  assert.equal(await page.getByRole("button", {
    name: "دستهٔ منتشرشدهٔ یک",
  }).getAttribute("aria-pressed"), "true");
  assert.equal(await page.getByRole("button", { name: "صفحهٔ بعد" }).isDisabled(), true);
  await page.getByRole("button", { name: "همه دسته‌ها" }).click();
  await page.getByRole("heading", { name: "عنوان واقعی API در تست 2", exact: true }).waitFor();
  assert.equal(calls.at(-1).params.categoryId, undefined);

  await page.locator("#buyer-search").fill("عنوان واقعی API در تست 21");
  await page.getByRole("button", { name: "جست‌وجو", exact: true }).click();
  await page.getByRole("heading", { name: "عنوان واقعی API در تست 21", exact: true }).waitFor();
  assert.equal(calls.at(-1).params.search, "عنوان واقعی API در تست 21");
  assert.equal(calls.at(-1).params.page, "1");
  assert.equal(await page.locator(".buyer-product").count(), 1);

  mode = "outage";
  await page.locator("#buyer-search").fill("قطعی کاتالوگ");
  await page.getByRole("button", { name: "جست‌وجو", exact: true }).click();
  await page.getByRole("heading", { name: "دریافت کالاها تأیید نشد" }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "فعلاً کالایی برای نمایش نداریم" }).count(), 0);
  mode = "malformed";
  await page.getByRole("button", { name: "تلاش دوباره برای کالاها" }).click();
  await page.getByRole("heading", { name: "دریافت کالاها تأیید نشد" }).waitFor();
  mode = "rich";
  await page.getByRole("button", { name: "تلاش دوباره برای کالاها" }).click();
  await page.getByRole("heading", { name: "فعلاً کالایی برای نمایش نداریم" }).waitFor();

  // A bookmarked filter can later become unpublished. Only a CONFIRMED
  // published category list can remove it; 503 must preserve the URL.
  const oldBookmark = "/?categoryId=" + categoryB +
    "&search=" + encodeURIComponent("عنوان") + "&page=2";
  mode = "outage";
  publishedCategories = categories;
  await page.goto(base + oldBookmark);
  await page.getByText("دریافت دسته‌بندی‌ها از سرور تأیید نشد.").waitFor();
  assert.equal(new URL(page.url()).searchParams.get("categoryId"),
    categoryB, "outage is not proof that a category was unpublished");
  assert.equal(new URL(page.url()).searchParams.get("page"), "2");

  // On a later confirmed GET, the selected category has truly disappeared.
  // The SAME history entry is repaired and search survives; do not show an
  // empty page two or fake published chip for a vanished category.
  mode = "rich";
  publishedCategories = [categories[0]];
  await page.reload();
  await page.getByText(
    "دسته‌بندی انتخاب‌شده دیگر منتشر نیست؛ همهٔ دسته‌ها نمایش داده می‌شوند.",
  ).waitFor();
  await page.waitForURL(base + "/?search=" + encodeURIComponent("عنوان"));
  await page.getByRole("heading", {
    name: "عنوان واقعی API در تست 1", exact: true,
  }).waitFor();
  assert.equal(await page.getByRole("button", {
    name: "دستهٔ منتشرشدهٔ دو",
  }).count(), 0);
  assert.equal(await page.getByRole("button", {
    name: "همه دسته‌ها",
  }).getAttribute("aria-pressed"), "true");
  assert.equal(calls.at(-1).params.categoryId, undefined);
  assert.equal(calls.at(-1).params.page, "1");
  assert.equal(calls.at(-1).params.search, "عنوان");

  // On the approved 390px design, real content reflows and stays in viewport.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#buyer-search").fill("");
  await page.getByRole("button", { name: "جست‌وجو", exact: true }).click();
  await page.getByRole("heading", { name: "عنوان واقعی API در تست 1", exact: true }).waitFor();
  assert.equal(await page.evaluate(() =>
    document.documentElement.scrollWidth <= window.innerWidth), true);
  assert.deepEqual(errors, []);
  assert.ok(calls.length >= 10);
  await context.close();
  console.log("Buyer browse real Chromium: empty, genuine API, filter, search, paging, 503, malformed and mobile reflow OK");
}

try { await main(); }
finally {
  if (browser) await browser.close();
  if (web?.pid) {
    try { process.kill(-web.pid, "SIGTERM"); } catch { /* already stopped */ }
  }
}
