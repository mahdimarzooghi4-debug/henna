/**
 * Frontend 016: shipping BuyerBrowseController + MobileCatalogClient, using
 * CI-only programmable public HTTP responses. No products enter Expo assets.
 * This is a transport/state integration test, NOT an on-device UI E2E test.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { MobileCatalogClient } from
  "../apps/mobile-consumer/src/mobile-catalog.ts";
import {
  BROWSE_PAGE_SIZE, BuyerBrowseController, validBrowseSearch,
} from "../apps/mobile-consumer/src/buyer-browse-controller.ts";

const A = "2fd59aad-5834-4717-9462-c5e520dd7a31";
const B = "4ef06bf5-32f3-4b10-a41e-5bd69f6bb442";
const categoryA = { id: A, name: "دستهٔ CI یک", slug: "ci-one" };
const categoryB = { id: B, name: "دستهٔ CI دو", slug: "ci-two" };
const product = (number, id = B) => ({
  id: "60000000-0000-4000-8000-" + String(number).padStart(12, "0"),
  categoryId: id, name: "کالای CI " + number,
  kind: number === 1 ? "SERVICE" : "GOOD",
  description: number === 1 ? "توضیح منتشرشده" : null,
});
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json" },
});

function scenario(handler = (url) => {
  if (url.pathname.endsWith("/categories"))
    return json({ items: [categoryA, categoryB] });
  const page = Number(url.searchParams.get("page"));
  const categoryId = url.searchParams.get("categoryId");
  const search = url.searchParams.get("search");
  const available = Array.from({ length: 21 }, (_, index) =>
    product(index + 1, index === 0 ? A : B));
  let entries = categoryId
    ? available.filter(x => x.categoryId === categoryId)
    : available;
  if (search) entries = entries.filter(x => x.name.includes(search));
  return json({
    items: entries.slice((page - 1) * 20, page * 20)
      .map(x => ({ ...x, price: 999, stock: 88, admin: "SECRET" })),
    total: entries.length, page, pageSize: BROWSE_PAGE_SIZE,
  });
}) {
  const calls = [], states = [];
  const fetchFn = async (raw, options) => {
    const url = new URL(raw);
    calls.push({ url, options });
    assert.equal(options.method, "GET");
    assert.equal(options.cache, "no-store");
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "error");
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.headers.Cookie, undefined);
    assert.equal(options.headers["Cache-Control"], "no-store");
    assert.ok(options.signal instanceof AbortSignal);
    return handler(url, options);
  };
  const client = new MobileCatalogClient(
    "https://api.hana.test", fetchFn);
  const controller = new BuyerBrowseController(client, s => states.push(s));
  return { controller, calls, states };
}
async function until(check) {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await new Promise(r => setTimeout(r, 3));
  }
  throw Error("catalog state did not settle");
}

test("public Expo browse is initially empty-to-loading and independent of OTP", async () => {
  const { controller: c, calls, states } = scenario();
  assert.equal(c.snapshot().categories.status, "loading");
  assert.equal(c.snapshot().products.status, "loading");
  assert.equal(c.snapshot().page, 1);
  assert.equal(c.snapshot().categoryId, null);
  c.start();
  await until(() => c.snapshot().categories.status === "ok" &&
    c.snapshot().products.status === "ok");
  assert.equal(c.snapshot().categories.data.length, 2);
  assert.equal(c.snapshot().products.data.items.length, 20);
  assert.deepEqual(Object.keys(c.snapshot().products.data.items[0]).sort(),
    ["categoryId", "description", "id", "kind", "name"].sort());
  assert.equal(c.snapshot().products.data.items[0].kind, "SERVICE");
  assert.equal(JSON.stringify(states).includes("SECRET"), false);
  assert.equal(JSON.stringify(states).includes('"price"'), false);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url.pathname, "/api/v1/catalog/categories");
  assert.equal(calls[1].url.pathname, "/api/v1/catalog/products");
  assert.equal(c.nextPage(), true);
  assert.equal(c.snapshot().products.status, "loading");
  await until(() => c.snapshot().products.status === "ok");
  assert.equal(c.snapshot().page, 2);
  assert.equal(c.snapshot().products.data.items.length, 1);
  assert.equal(c.nextPage(), false);
  assert.equal(c.chooseCategory("not-a-real-category"), false);
  assert.equal(c.chooseCategory(A), true);
  assert.equal(c.snapshot().page, 1);
  assert.equal(c.snapshot().products.status, "loading");
  await until(() => c.snapshot().products.status === "ok");
  assert.equal(c.snapshot().products.data.items.length, 1);
  assert.equal(calls.at(-1).url.searchParams.get("categoryId"), A);
  assert.equal(c.chooseCategory(null), true);
  await until(() => c.snapshot().products.status === "ok");
  assert.equal(calls.at(-1).url.searchParams.has("categoryId"), false);
  assert.equal(c.submitSearch(" کالای CI 21 "), true);
  await until(() => c.snapshot().products.status === "ok");
  assert.equal(c.snapshot().search, "کالای CI 21");
  assert.equal(c.snapshot().products.data.total, 1);
  assert.equal(calls.at(-1).url.searchParams.get("search"), "کالای CI 21");
  assert.equal(calls.at(-1).url.searchParams.get("page"), "1");
  assert.equal(validBrowseSearch("x".repeat(81)), false);
  assert.equal(validBrowseSearch("a\u0000b"), false);
  assert.equal(c.submitSearch("x".repeat(81)), false);
  assert.equal(c.snapshot().search, "کالای CI 21");
  c.stop();
});

test("genuine 200 empty is distinct from 503, network and malformed 200", async () => {
  let mode = "empty";
  const { controller: c } = scenario(url => {
    if (mode === "network") throw Error("offline");
    if (mode === "503") return json({ message: "unavailable" }, 503);
    if (mode === "malformed") return json({ items: "not-an-array" });
    if (url.pathname.endsWith("/categories"))
      return json({ items: [] });
    return json({ items: [], page: 1, pageSize: 20, total: 0 });
  });
  c.start();
  await until(() => c.snapshot().products.status === "ok" &&
    c.snapshot().categories.status === "ok");
  assert.deepEqual(c.snapshot().products.data.items, []);
  assert.deepEqual(c.snapshot().categories.data, []);
  for (mode of ["503", "malformed", "network"]) {
    await Promise.all([c.refreshProducts(), c.refreshCategories()]);
    assert.equal(c.snapshot().products.status, "unavailable", mode);
    assert.equal(c.snapshot().categories.status, "unavailable", mode);
    assert.notEqual(c.snapshot().products.status, "ok");
  }
  mode = "empty";
  await Promise.all([c.refreshProducts(), c.refreshCategories()]);
  assert.equal(c.snapshot().products.status, "ok");
  assert.equal(c.snapshot().categories.status, "ok");
  c.stop();
});

test("query supersession and unmount abort pending transport and hide old results", async () => {
  let resolveFirst;
  let originalSignal;
  const deferred = new Promise(resolve => { resolveFirst = resolve; });
  const { controller: c, calls, states } = scenario((url, options) => {
    if (url.pathname.endsWith("/categories"))
      return json({ items: [categoryA] });
    if (url.searchParams.has("search")) return json({
      items: [product(1, A)], page: 1, pageSize: 20, total: 1,
    });
    originalSignal = options.signal;
    return deferred; // Simulates a broken upstream that ignores abort.
  });
  c.start();
  await until(() => c.snapshot().categories.status === "ok");
  assert.equal(c.snapshot().products.status, "loading");
  assert.equal(c.submitSearch("کالای CI 1"), true);
  assert.equal(originalSignal.aborted, true);
  await until(() => c.snapshot().products.status === "ok");
  assert.equal(c.snapshot().products.data.items.length, 1);
  resolveFirst(json({ items: [], page: 1, pageSize: 20, total: 0 }));
  await new Promise(r => setTimeout(r, 10));
  assert.equal(c.snapshot().products.data.items.length, 1,
    "late response must not overwrite new search results");
  assert.equal(c.snapshot().search, "کالای CI 1");
  assert.equal(states.some(s => s.search === "کالای CI 1" &&
    s.products.status === "loading"), true);
  c.stop();
  // Completed transport removes its upstream abort listener; a closed screen
  // must make no NEW calls. Superseded in-flight transport was aborted above.
  const total = calls.length;
  await c.refreshProducts();
  assert.equal(calls.length, total, "unmounted browse makes no HTTP calls");
});

test("category publication changes invalidate a removed selected filter", async () => {
  let published = [categoryA, categoryB];
  const { controller: c, calls } = scenario(url => {
    if (url.pathname.endsWith("/categories"))
      return json({ items: published });
    const p = url.searchParams.get("categoryId");
    const items = p === B ? [product(2)] : [product(1, A)];
    return json({ items, total: 1, page: 1, pageSize: 20 });
  });
  c.start();
  await until(() => c.snapshot().categories.status === "ok" &&
    c.snapshot().products.status === "ok");
  assert.equal(c.chooseCategory(B), true);
  await until(() => c.snapshot().products.status === "ok");
  assert.equal(c.snapshot().categoryId, B);
  published = [categoryA];
  await c.refreshCategories();
  await until(() => c.snapshot().products.status === "ok");
  assert.equal(c.snapshot().categoryId, null);
  assert.equal(c.snapshot().page, 1);
  assert.equal(calls.at(-1).url.searchParams.has("categoryId"), false);
  c.stop();
});

test("mismatched but valid-looking page never becomes published content", async () => {
  const { controller: c } = scenario(url => url.pathname.endsWith("/categories")
    ? json({ items: [] })
    : json({ items: [product(1)], total: 1, page: 2, pageSize: 20 }));
  c.start();
  await until(() => c.snapshot().products.status === "unavailable");
  assert.equal(c.snapshot().categories.status, "ok");
  c.stop();
});
