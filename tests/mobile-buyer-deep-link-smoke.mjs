/**
 * Frontend 020: real shipping parser + BrowseController + MobileCatalogClient
 * against ephemeral CI-only HTTP. Native OS delivery is not claimed.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  formatBuyerLink, parseBuyerLink,
} from "../apps/mobile-consumer/src/buyer-link.ts";
import {
  BuyerBrowseController, BROWSE_PAGE_SIZE,
} from "../apps/mobile-consumer/src/buyer-browse-controller.ts";
import { MobileCatalogClient } from "../apps/mobile-consumer/src/mobile-catalog.ts";

const A = "2fd59aad-5834-4717-9462-c5e520dd7a31";
const B = "4ef06bf5-32f3-4b10-a41e-5bd69f6bb442";
const ID = "60000000-0000-4000-8000-000000000001";
const OTHER = "60000000-0000-4000-8000-000000000002";
const blank = { categoryId: null, search: "", page: 1 };
const saved = { categoryId: B, search: "کالای & فارسی", page: 2 };
const reply = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json" },
});
async function until(check) {
  for (let n = 0; n < 100; n++) {
    if (check()) return;
    await new Promise(resolve => setTimeout(resolve, 3));
  }
  throw Error("browse query did not settle");
}

test("Expo scheme already configured and cold browse/detail URIs round-trip", () => {
  const config = JSON.parse(readFileSync(
    new URL("../apps/mobile-consumer/app.json", import.meta.url), "utf8",
  ));
  assert.equal(config.expo.scheme, "hana");
  const cold = formatBuyerLink({ kind: "detail", id: ID, browse: saved });
  assert.equal(cold, "hana://products/" + ID +
    "?categoryId=" + B + "&search=" +
    new URLSearchParams({ search: saved.search }).toString().slice(7) +
    "&page=2");
  assert.deepEqual(parseBuyerLink(cold), {
    kind: "detail", id: ID, browse: saved,
  });
  assert.equal(formatBuyerLink({ kind: "browse", browse: blank }),
    "hana://browse");
  assert.deepEqual(parseBuyerLink("hana://browse"), {
    kind: "browse", browse: blank,
  });
  assert.deepEqual(parseBuyerLink("hana://products/" + OTHER), {
    kind: "detail", id: OTHER, browse: blank,
  });
});

test("untrusted, unsupported, malformed or ambiguous incoming routes fail closed", () => {
  for (const url of [
    null, "", "https://hana.test/products/" + ID,
    "https://evil.test/products/" + ID, "exp://127.0.0.1",
    "javascript:alert(1)", "hana://auth",
    "hana://products/not-a-uuid", "hana://products/" + ID + "/extra",
    "hana://products/" + ID + "#fragment", "hana://browse.evil/",
    "hana://user@browse", "hana://browse?page=2&page=3",
    "hana://browse?search=a&search=b",
    "hana://browse?" + "x".repeat(4100),
  ]) assert.equal(parseBuyerLink(url), null, String(url)?.slice(0, 70));
  assert.equal(formatBuyerLink({
    kind: "detail", id: "not-a-uuid", browse: blank,
  }), null);
  assert.deepEqual(parseBuyerLink("hana://browse?returnTo=https%3A%2F%2Fevil.test" +
    "&categoryId=bad&search=" + "x".repeat(81) + "&page=10001"), {
      kind: "browse", browse: blank,
    });
  assert.deepEqual(parseBuyerLink("hana://browse?search=%00&page=-2"), {
    kind: "browse", browse: blank,
  });
  assert.equal(formatBuyerLink({ kind: "browse", browse: {
    categoryId: "bad", search: "x".repeat(81), page: 10001,
  } }), "hana://browse");
  for (const page of [1, 2, 10000]) {
    const route = { kind: "browse", browse: { ...saved, page } };
    assert.deepEqual(parseBuyerLink(formatBuyerLink(route)), route);
  }
});

test("cold-start saved query is used on the first public catalog fetch", async () => {
  const calls = [], states = [];
  const client = new MobileCatalogClient("https://api.hana.test",
    async (path, options) => {
      const url = new URL(path);
      calls.push({ url, options });
      assert.equal(options.credentials, "omit");
      assert.equal(options.headers.Authorization, undefined);
      assert.equal(options.headers.Cookie, undefined);
      assert.ok(options.signal instanceof AbortSignal);
      if (url.pathname.endsWith("/categories"))
        return reply({ items: [
          { id: A, name: "آ", slug: "a" },
          { id: B, name: "ب", slug: "b" },
        ] });
      return reply({ items: [], page: Number(url.searchParams.get("page")),
        pageSize: BROWSE_PAGE_SIZE, total: 0 });
    });
  const route = parseBuyerLink(formatBuyerLink({
    kind: "detail", id: ID, browse: saved,
  }));
  const ctrl = new BuyerBrowseController(client,
    state => states.push(state), route.browse);
  assert.equal(ctrl.snapshot().page, 2);
  assert.equal(ctrl.snapshot().search, saved.search);
  ctrl.start();
  await until(() => ctrl.snapshot().products.status === "ok");
  const fetchPath = calls.find(x => x.url.pathname.endsWith("/products"));
  assert.equal(fetchPath.url.searchParams.get("categoryId"), B);
  assert.equal(fetchPath.url.searchParams.get("search"), saved.search);
  assert.equal(fetchPath.url.searchParams.get("page"), "2");
  assert.equal(calls.some(x => x.url.pathname.endsWith("/products") &&
    x.url.searchParams.get("page") === "1"), false);
  assert.equal(states.some(x => x.categoryId === B && x.search === saved.search &&
    x.page === 2), true);
  ctrl.stop();
});

test("warm links abort old results, honor new category, and removed categories reset", async () => {
  let completeOld, oldSignal;
  const oldResponse = new Promise(resolve => { completeOld = resolve; });
  let categories = [A, B];
  const calls = [], states = [];
  const client = new MobileCatalogClient("https://api.hana.test",
    async (path, options) => {
      const u = new URL(path);
      calls.push({ u, options });
      if (u.pathname.endsWith("/categories")) return reply({
        items: categories.map((id, n) => ({
          id, name: "گروه " + n, slug: "group-" + n,
        })),
      });
      if (u.searchParams.get("search") === "انتظار") {
        oldSignal = options.signal;
        return oldResponse; // intentionally ignores abort
      }
      return reply({
        items: [], total: 0, page: Number(u.searchParams.get("page")),
        pageSize: BROWSE_PAGE_SIZE,
      });
    });
  const ctrl = new BuyerBrowseController(client,
    state => states.push(state));
  ctrl.start();
  await until(() => ctrl.snapshot().categories.status === "ok" &&
    ctrl.snapshot().products.status === "ok");
  ctrl.restoreLocation({
    categoryId: A, search: "انتظار", page: 2,
  });
  assert.equal(ctrl.snapshot().products.status, "loading");
  assert.equal(ctrl.snapshot().search, "انتظار");
  ctrl.restoreLocation(saved);
  assert.equal(oldSignal.aborted, true);
  await until(() => ctrl.snapshot().products.status === "ok");
  assert.equal(ctrl.snapshot().search, saved.search);
  assert.equal(ctrl.snapshot().categoryId, B);
  assert.equal(ctrl.snapshot().page, 2);
  completeOld(reply({ items: [], total: 0, page: 2, pageSize: 20 }));
  await new Promise(r => setTimeout(r, 10));
  assert.equal(ctrl.snapshot().search, saved.search);
  assert.equal(ctrl.snapshot().page, 2);
  categories = [A];
  await ctrl.refreshCategories();
  await until(() => ctrl.snapshot().products.status === "ok");
  assert.equal(ctrl.snapshot().categoryId, null);
  assert.equal(ctrl.snapshot().page, 1);
  assert.equal(calls.at(-1).u.searchParams.has("categoryId"), false);
  assert.equal(states.some(s => s.search === saved.search &&
    s.products.status === "loading"), true);
  ctrl.stop();
  const count = calls.length;
  ctrl.restoreLocation(saved);
  assert.equal(calls.length, count);
});
