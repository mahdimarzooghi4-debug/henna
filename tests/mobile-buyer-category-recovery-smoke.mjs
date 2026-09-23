/**
 * Frontend 026: exercise the shipping Expo browse coordinator with CI-only
 * public HTTP. No categories/products from this file enter the app bundle.
 * The existing native Android/iOS gates separately verify the installed UI.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BuyerBrowseController } from
  "../apps/mobile-consumer/src/buyer-browse-controller.ts";
import { MobileCatalogClient } from
  "../apps/mobile-consumer/src/mobile-catalog.ts";

const A = "2fd59aad-5834-4717-9462-c5e520dd7a31";
const B = "4ef06bf5-32f3-4b10-a41e-5bd69f6bb442";
const category = id => ({ id, name: "دسته CI", slug: "ci-category" });
const reply = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json" },
});
const page = (url, items = [], total = 0) => ({
  items, page: Number(url.searchParams.get("page")),
  pageSize: 20, total,
});

function scenario({ initial, categories, products }) {
  const calls = [], states = [];
  const client = new MobileCatalogClient("https://api.hana.test",
    async (raw, options) => {
      const url = new URL(raw);
      calls.push({ url, signal: options.signal });
      assert.equal(options.method, "GET");
      assert.equal(options.credentials, "omit");
      assert.equal(options.redirect, "error");
      assert.equal(options.headers.Authorization, undefined);
      assert.equal(options.headers.Cookie, undefined);
      return url.pathname.endsWith("/categories")
        ? categories(url) : products(url, options.signal);
    });
  const controller = new BuyerBrowseController(client,
    state => states.push(state), initial);
  return { controller, calls, states };
}
async function until(check) {
  for (let i = 0; i < 150; i++) {
    if (check()) return;
    await new Promise(resolve => setTimeout(resolve, 3));
  }
  throw Error("category recovery did not settle");
}

test("cold saved category removed by published 200 preserves search, resets page and suppresses late old product", async () => {
  let finishStale;
  const stale = new Promise(resolve => { finishStale = resolve; });
  const saved = { categoryId: B, search: "کالای فارسی", page: 2 };
  const { controller: c, calls, states } = scenario({
    initial: saved,
    categories: () => reply({ items: [category(A)] }),
    products: url => url.searchParams.has("categoryId")
      ? stale : reply(page(url)),
  });
  assert.equal(c.snapshot().categoryRecovery, false);
  c.start();
  await until(() => c.snapshot().categories.status === "ok" &&
    c.snapshot().products.status === "ok");
  assert.equal(c.snapshot().categoryRecovery, true);
  assert.equal(c.snapshot().categoryId, null);
  assert.equal(c.snapshot().search, saved.search);
  assert.equal(c.snapshot().page, 1);
  assert.equal(c.snapshot().products.data.page, 1);
  const old = calls.find(x => x.url.searchParams.get("categoryId") === B);
  assert.ok(old);
  assert.equal(old.signal.aborted, true);
  const refreshed = calls.at(-1).url;
  assert.equal(refreshed.searchParams.has("categoryId"), false);
  assert.equal(refreshed.searchParams.get("search"), saved.search);
  assert.equal(refreshed.searchParams.get("page"), "1");
  assert.equal(states.some(s => s.categoryRecovery &&
    s.categoryId === null && s.products.status === "loading"), true);
  finishStale(reply({ items: [], total: 0, page: 2, pageSize: 20 }));
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(c.snapshot().categoryId, null);
  assert.equal(c.snapshot().products.data.page, 1);
  c.stop();
});

test("503 or malformed categories never prove unpublication; later valid 200 does", async () => {
  let mode = "published";
  const saved = { categoryId: B, search: "همین جست‌وجو", page: 2 };
  const { controller: c, calls } = scenario({
    initial: saved,
    categories: () => mode === "503" ? reply({}, 503)
      : mode === "malformed" ? reply({ items: "invalid" })
      : reply({ items: mode === "removed"
        ? [category(A)] : [category(A), category(B)] }),
    products: url => reply(page(url)),
  });
  c.start();
  await until(() => c.snapshot().categories.status === "ok" &&
    c.snapshot().products.status === "ok");
  assert.equal(c.snapshot().categoryRecovery, false);
  for (mode of ["503", "malformed"]) {
    const oldCalls = calls.length;
    await c.refreshCategories();
    assert.equal(c.snapshot().categories.status, "unavailable");
    assert.equal(c.snapshot().categoryId, B);
    assert.equal(c.snapshot().page, 2);
    assert.equal(c.snapshot().search, saved.search);
    assert.equal(c.snapshot().categoryRecovery, false);
    assert.equal(calls.length, oldCalls + 1,
      "category error must not initiate another product query");
  }
  mode = "removed";
  await c.refreshCategories();
  await until(() => c.snapshot().products.status === "ok");
  assert.equal(c.snapshot().categoryId, null);
  assert.equal(c.snapshot().page, 1);
  assert.equal(c.snapshot().search, saved.search);
  assert.equal(c.snapshot().categoryRecovery, true);
  assert.equal(calls.at(-1).url.searchParams.has("categoryId"), false);
  c.stop();
});

test("warm missing link restores search with notice; a new query clears it", async () => {
  const { controller: c, calls } = scenario({
    categories: () => reply({ items: [category(A)] }),
    products: url => reply(page(url)),
  });
  c.start();
  await until(() => c.snapshot().categories.status === "ok" &&
    c.snapshot().products.status === "ok");
  c.restoreLocation({ categoryId: B, search: "عبارت جدید", page: 8 });
  assert.equal(c.snapshot().products.status, "loading");
  assert.equal(c.snapshot().categoryRecovery, true);
  assert.equal(c.snapshot().categoryId, null);
  assert.equal(c.snapshot().page, 1);
  assert.equal(c.snapshot().search, "عبارت جدید");
  await until(() => c.snapshot().products.status === "ok");
  assert.equal(calls.at(-1).url.searchParams.get("search"), "عبارت جدید");
  assert.equal(calls.at(-1).url.searchParams.get("page"), "1");
  assert.equal(c.submitSearch(" جست‌وجوی تازه "), true);
  assert.equal(c.snapshot().categoryRecovery, false);
  await until(() => c.snapshot().products.status === "ok");
  c.restoreLocation({ categoryId: B, search: "", page: 2 });
  assert.equal(c.snapshot().categoryRecovery, true);
  assert.equal(c.chooseCategory(null), true);
  assert.equal(c.snapshot().categoryRecovery, false);
  await until(() => c.snapshot().products.status === "ok");
  c.stop();
});

test("published category UUID casing is not mistaken for removal on cold and warm links", async () => {
  const upper = B.toUpperCase();
  const { controller: c, calls } = scenario({
    initial: { categoryId: B, search: "نام", page: 2 },
    categories: () => reply({ items: [category(upper)] }),
    products: url => reply(page(url)),
  });
  c.start();
  await until(() => c.snapshot().categories.status === "ok" &&
    c.snapshot().products.status === "ok");
  assert.equal(c.snapshot().categoryId, upper);
  assert.equal(c.snapshot().categoryRecovery, false);
  assert.equal(c.snapshot().page, 2);
  c.restoreLocation({ categoryId: B, search: "نام دیگر", page: 3 });
  assert.equal(c.snapshot().categoryId, upper);
  assert.equal(c.snapshot().categoryRecovery, false);
  assert.equal(c.snapshot().page, 3);
  await until(() => c.snapshot().products.status === "ok");
  assert.equal(calls.at(-1).url.searchParams.get("categoryId"), upper);
  c.stop();
});

test("recovery notice is rendered in the approved mobile category section", () => {
  const screen = readFileSync(new URL(
    "../apps/mobile-consumer/src/buyer-browse-screen.tsx", import.meta.url),
  "utf8");
  assert.match(screen, /browse\.categoryRecovery && categories\.status === "ok"/);
  assert.match(screen, /accessibilityRole="alert" style=\{styles\.categoryRecovery\}/);
  assert.match(screen, /دسته‌بندی انتخاب‌شده دیگر منتشر نیست/);
});
