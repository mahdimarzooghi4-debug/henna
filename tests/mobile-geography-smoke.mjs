// Only CI transport fixtures; no production city seed or fake availability.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MobileGeographyClient,
} from "../apps/mobile-consumer/src/mobile-geography.ts";

const PROVINCE = "6b2bc828-cf5d-4af7-a026-a653739d8509";
const CITY = "fbf47579-71b4-4b85-996c-842ac497fb12";
const province = { id: PROVINCE, name: "استان آزمون", slug: "ci-province" };
const city = {
  id: CITY, provinceId: PROVINCE, name: "شهر آزمون",
  slug: "ci-city",
};

function harness(answers = [], options = {}) {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url, ...init });
    const next = answers.shift();
    if (!next || next instanceof Error)
      throw next ?? Error("network unavailable");
    if (next instanceof Response) return next;
    return new Response(JSON.stringify(next.body ?? {}), {
      status: next.status ?? 200,
      headers: { "Content-Type": "application/json", ...next.headers },
    });
  };
  return {
    calls,
    client: new MobileGeographyClient(
      Object.hasOwn(options, "base") ? options.base
        : "https://api.hana.test",
      fetchFn, options.allowLocalHttp ?? false,
    ),
  };
}

function publicRequest(call) {
  assert.equal(call.method, "GET");
  assert.equal(call.credentials, "omit");
  assert.equal(call.cache, "no-store");
  assert.equal(call.redirect, "error");
  assert.equal(call.headers.Accept, "application/json");
  assert.equal(call.headers["Cache-Control"], "no-store");
  assert.equal(call.headers.Authorization, undefined);
  assert.equal(call.headers.Cookie, undefined);
  assert.ok(call.signal instanceof AbortSignal);
}

test("province lookup strips state/operational flags, without authentication", async () => {
  const { calls, client } = harness([{
    body: { items: [{ ...province, state: "SELECTABLE",
      launched: true, sellerCount: 100 }] },
  }]);
  assert.deepEqual(await client.provinces(),
    { status: "ok", data: [province] });
  assert.equal(calls[0].url, "https://api.hana.test/api/v1/geography/provinces");
  publicRequest(calls[0]);
});

test("cities must belong to requested province and never imply delivery", async () => {
  const { calls, client } = harness([
    { body: { items: [{
      ...city, deliveryAvailable: true, hasOffers: true,
      availabilityStatus: "AVAILABLE",
    }] } },
    { body: { items: [] } },
  ]);
  assert.deepEqual(await client.cities(PROVINCE),
    { status: "ok", data: [city] });
  const target = new URL(calls[0].url);
  assert.equal(target.pathname, "/api/v1/geography/cities");
  assert.equal(target.searchParams.get("provinceId"), PROVINCE);
  publicRequest(calls[0]);
  assert.deepEqual(await client.cities(PROVINCE),
    { status: "ok", data: [] });
});

test("single city returns only canonical identity or notFound", async () => {
  const { calls, client } = harness([
    { body: { ...city, state: "SELECTABLE",
      sellerId: PROVINCE, checkoutReady: true } },
    { status: 404 },
  ]);
  assert.deepEqual(await client.city(CITY),
    { status: "ok", data: city });
  assert.deepEqual(await client.city(PROVINCE),
    { status: "notFound" });
  assert.equal(calls[0].url,
    "https://api.hana.test/api/v1/geography/cities/" + CITY);
  publicRequest(calls[0]);
});

test("invalid IDs fail locally without networking", async () => {
  const { calls, client } = harness();
  for (const value of [
    "", "bad", "../cities", "//attacker.test",
    "00000000-0000-0000-0000-000000000000",
  ]) {
    assert.deepEqual(await client.cities(value), { status: "invalid" });
    assert.deepEqual(await client.city(value), { status: "invalid" });
  }
  assert.equal(calls.length, 0);
});

test("missing and malformed config rejects plaintext and secret-bearing URLs", async () => {
  for (const base of [
    undefined, "http://api.hana.test", "http://10.0.2.2:5184",
    "https://api.hana.test/path", "https://user:password@api.hana.test",
    "https://api.hana.test?key=secret", "ftp://api.hana.test",
  ]) {
    const { client, calls } = harness([], { base });
    assert.deepEqual(await client.provinces(), { status: "unavailable" });
    assert.equal(calls.length, 0);
  }
  const dev = harness([{ status: 503 }], {
    base: "http://10.0.2.2:5184", allowLocalHttp: true,
  });
  assert.deepEqual(await dev.client.provinces(),
    { status: "unavailable" });
  assert.equal(dev.calls[0].url,
    "http://10.0.2.2:5184/api/v1/geography/provinces");
});

test("unavailable location server never means no selectable cities", async () => {
  for (const response of [
    { status: 503 }, { status: 401 }, { status: 429 },
    { status: 404 }, { status: 200, body: {} },
    { status: 200, body: { items: ["bad"] } },
    { status: 200, body: { items: [{ ...city, id: "bad" }] } },
    { status: 200, body: { items: [{
      ...city, provinceId: CITY,
    }] } },
    { status: 200, body: { items: [{ ...city, slug: "NOT-VALID" }] } },
    { status: 200, body: { items: [{ ...city, name: "" }] } },
    { status: 200, body: { items: [] },
      headers: { "Content-Type": "text/html" } },
    { status: 200, body: { items: [] },
      headers: { "Content-Length": "512001" } },
    new Response("not-json", {
      headers: { "Content-Type": "application/json" },
    }),
    new Error("offline"),
  ]) {
    const { client } = harness([response]);
    assert.deepEqual(await client.cities(PROVINCE),
      { status: "unavailable" });
  }
});

test("untrusted single city response is unavailable, not a valid city", async () => {
  for (const body of [
    { ...city, id: "bad" },
    { ...city, provinceId: "bad" },
    { ...city, slug: "" },
    { ...city, name: "x".repeat(121) },
    { ...city, name: "bad\u0000" },
    {},
  ]) {
    const { client } = harness([{ body }]);
    assert.deepEqual(await client.city(CITY),
      { status: "unavailable" });
  }
});
