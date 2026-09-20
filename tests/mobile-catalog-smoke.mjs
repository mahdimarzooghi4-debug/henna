// CI-only programmable network responses. No sample catalog data is shipped
// to Expo or injected into the production ASP.NET API.
import assert from "node:assert/strict";
import { test } from "node:test";
import { MobileCatalogClient } from "../apps/mobile-consumer/src/mobile-catalog.ts";

const CATEGORY = "6b2bc828-cf5d-4af7-a026-a653739d8509";
const PRODUCT = "fbf47579-71b4-4b85-996c-842ac497fb12";
const PRIVATE = "this must never reach an app screen";

const category = {
  id: CATEGORY, name: "گروه تست", slug: "ci-group",
};
const product = {
  id: PRODUCT, categoryId: CATEGORY, name: "کالای تست",
  kind: "GOOD", description: null,
};

function harness(answers = [], options = {}) {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url, ...init });
    const answer = answers.shift();
    if (!answer || answer instanceof Error)
      throw answer ?? Error("network unavailable");
    if (answer instanceof Response) return answer;
    return new Response(JSON.stringify(answer.body ?? {}), {
      status: answer.status ?? 200,
      headers: { "Content-Type": "application/json", ...answer.headers },
    });
  };
  const client = new MobileCatalogClient(
    options.base ?? "https://api.hana.test",
    fetchFn,
    options.allowLocalHttp ?? false,
  );
  return { client, calls };
}

function checkPublicCall(call) {
  assert.equal(call.method, "GET");
  assert.equal(call.cache, "no-store");
  assert.equal(call.credentials, "omit");
  assert.equal(call.redirect, "error");
  assert.equal(call.headers.Authorization, undefined);
  assert.equal(call.headers.Cookie, undefined);
  assert.equal(call.headers.Accept, "application/json");
  assert.equal(call.headers["Cache-Control"], "no-store");
  assert.ok(call.signal instanceof AbortSignal);
}

test("public categories reject private upstream metadata and need no session", async () => {
  const { client, calls } = harness([{
    body: { items: [{ ...category, internalNote: PRIVATE }] },
  }]);
  assert.deepEqual(await client.categories(),
    { status: "ok", data: [category] });
  assert.equal(calls[0].url, "https://api.hana.test/api/v1/catalog/categories");
  checkPublicCall(calls[0]);
});

test("public listing supports pagination, category filter and encoded search", async () => {
  const { client, calls } = harness([{
    body: {
      items: [{ ...product, price: 123456, sellerId: CATEGORY,
        stock: 42, moderationNote: PRIVATE }],
      total: 1, page: 2, pageSize: 1,
    },
  }, {
    body: { items: [], total: 0, page: 1, pageSize: 20 },
  }]);
  assert.deepEqual(await client.list({
    page: 2, pageSize: 1, categoryId: CATEGORY,
    search: " کالا & خدمت? ",
  }), {
    status: "ok",
    data: { items: [product], total: 1, page: 2, pageSize: 1 },
  });
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, "/api/v1/catalog/products");
  assert.equal(url.searchParams.get("page"), "2");
  assert.equal(url.searchParams.get("pageSize"), "1");
  assert.equal(url.searchParams.get("categoryId"), CATEGORY);
  assert.equal(url.searchParams.get("search"), "کالا & خدمت?");
  checkPublicCall(calls[0]);
  // An actual empty response is different from a network outage.
  assert.deepEqual(await client.list(), {
    status: "ok", data: {
      items: [], total: 0, page: 1, pageSize: 20,
    },
  });
});

test("published detail is shaped without price; non-public detail is 404", async () => {
  const { client, calls } = harness([{
    body: { ...product, price: 60000, state: "PUBLISHED",
      internalAdminNote: PRIVATE },
  }, { status: 404 }]);
  assert.deepEqual(await client.detail(PRODUCT),
    { status: "ok", data: product });
  assert.deepEqual(await client.detail(CATEGORY), { status: "notFound" });
  assert.equal(calls[0].url,
    "https://api.hana.test/api/v1/catalog/products/" + PRODUCT);
  checkPublicCall(calls[0]);
});

test("invalid parameters cannot make a network request", async () => {
  const { client, calls } = harness();
  for (const query of [
    { page: 0 }, { page: 10001 }, { page: 1.5 },
    { pageSize: 0 }, { pageSize: 51 }, { pageSize: NaN },
    { categoryId: "bad" },
    { categoryId: "00000000-0000-0000-0000-000000000000" },
    { search: "a".repeat(81) }, { search: "\u0000" },
  ]) {
    assert.deepEqual(await client.list(query), { status: "invalid" });
  }
  for (const id of ["", "bad",
    "00000000-0000-0000-0000-000000000000",
  ]) {
    assert.deepEqual(await client.detail(id), { status: "invalid" });
  }
  assert.equal(calls.length, 0);
});

test("production rejects plaintext and URL credentials, path or query", async () => {
  for (const base of [
    undefined, "http://api.hana.test", "http://10.0.2.2:5184",
    "https://user:secret@api.hana.test", "https://api.hana.test/path",
    "https://api.hana.test/?token=secret",
    "https://api.hana.test/#fragment", "ftp://api.hana.test",
  ]) {
    const { client, calls } = harness([], { base });
    assert.deepEqual(await client.categories(), { status: "unavailable" });
    assert.equal(calls.length, 0);
  }
  const dev = harness([{ status: 503 }], {
    base: "http://10.0.2.2:5184", allowLocalHttp: true,
  });
  assert.deepEqual(await dev.client.list(), { status: "unavailable" });
  assert.equal(dev.calls[0].url,
    "http://10.0.2.2:5184/api/v1/catalog/products?page=1&pageSize=20");
});

test("bad server/network responses never become an empty catalog", async () => {
  for (const answer of [
    { status: 503 }, { status: 401 }, { status: 400 },
    { status: 200, body: {} },
    { status: 200, body: { items: [{ ...category, id: "bad" }] } },
    { status: 200, body: { items: [{ ...category, name: "" }] } },
    { status: 200, body: { items: "not-an-array" } },
    { status: 200, body: { items: [] },
      headers: { "Content-Type": "text/html" } },
    { status: 200, body: { items: [] },
      headers: { "Content-Length": "512001" } },
    new Response("not JSON", {
      headers: { "Content-Type": "application/json" },
    }),
    new Error("offline"),
  ]) {
    const { client } = harness([answer]);
    assert.deepEqual(await client.categories(), { status: "unavailable" });
  }
});

test("malformed item, kind and pagination fail closed", async () => {
  for (const body of [
    { items: [{ ...product, kind: "INVENTORY" }],
      page: 1, pageSize: 20, total: 1 },
    { items: [{ ...product, description: "x".repeat(2001) }],
      page: 1, pageSize: 20, total: 1 },
    { items: [product, product], page: 1, pageSize: 1, total: 2 },
    { items: [product], page: 1, pageSize: 20, total: 0 },
    { items: [], page: 0, pageSize: 20, total: 0 },
    { items: [], page: 1, pageSize: 51, total: 0 },
  ]) {
    const { client } = harness([{ body }]);
    assert.deepEqual(await client.list(), { status: "unavailable" });
  }
  const { client } = harness([{
    body: { ...product, description: undefined },
  }]);
  assert.deepEqual(await client.detail(PRODUCT),
    { status: "unavailable" });
});
