/**
 * CI-only public reference fixtures. Shipping UI NEVER assumes a real province,
 * active launch city, seller, account, or SMS provider.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatSellerReferenceCity, getSellerReferenceCities,
  getSellerReferenceProvinces, parseReferenceCities,
  parseReferenceProvinces, validReferenceId,
} from "../apps/web-marketplace/lib/seller-location-reference.ts";

const provinceId = "6b2bc828-cf5d-4af7-a026-a653739d8509";
const secondProvinceId = "4ef06bf5-32f3-4b10-a41e-5bd69f6bb442";
const cityId = "fbf47579-71b4-4b85-996c-842ac497fb12";
const province = {
  id: provinceId, name: "استان تست", slug: "ci-province",
};
const city = {
  id: cityId, provinceId, name: "شهر تست", slug: "ci-city",
};

function reply(status, json, type = "application/json") {
  return new Response(JSON.stringify(json), {
    status, headers: { "Content-Type": type },
  });
}
function harness(responses) {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url, init });
    const answer = responses.shift();
    if (answer instanceof Error) throw answer;
    return answer;
  };
  return { calls, fetchFn };
}

test("no fetch is made until the UI asks for real reference provinces", async () => {
  const { calls, fetchFn } = harness([
    reply(200, { items: [province] }),
    reply(200, { items: [city] }),
  ]);
  assert.deepEqual(calls, []);
  const provinces = await getSellerReferenceProvinces(fetchFn);
  assert.deepEqual(provinces, { status: "ok", items: [province] });
  const cities = await getSellerReferenceCities(provinceId, fetchFn);
  assert.deepEqual(cities, { status: "ok", items: [city] });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "/api/geography/provinces");
  assert.equal(calls[1].url,
    "/api/geography/cities?provinceId=" + provinceId);
  for (const { init } of calls) {
    assert.equal(init.method, "GET");
    assert.equal(init.cache, "no-store");
    assert.deepEqual(init.headers, { Accept: "application/json" });
    assert.equal(init.body, undefined);
    assert.equal(init.headers.Authorization, undefined);
    assert.equal(init.headers.Cookie, undefined);
  }
});

test("valid 200 empty reference is different from 503 and malformed 200", async () => {
  const { fetchFn } = harness([
    reply(200, { items: [] }),
    reply(503, { message: "outage" }),
    reply(200, { items: [{ ...province, state: "SELECTABLE" }] },
      "text/plain"),
    new Error("offline"),
    reply(200, { items: [city] }),
  ]);
  assert.deepEqual(await getSellerReferenceProvinces(fetchFn),
    { status: "ok", items: [] });
  assert.deepEqual(await getSellerReferenceProvinces(fetchFn),
    { status: "unavailable" });
  assert.deepEqual(await getSellerReferenceProvinces(fetchFn),
    { status: "unavailable" });
  assert.deepEqual(await getSellerReferenceProvinces(fetchFn),
    { status: "unavailable" });
  assert.deepEqual(await getSellerReferenceProvinces(fetchFn),
    { status: "unavailable" },
    "city shaped record cannot become a province option");
});

test("cross-province city, duplicate ID/slug, bad names and extra-long lists fail closed", () => {
  assert.deepEqual(parseReferenceProvinces({ items: [
    { ...province, secret: "never render", launched: true },
  ] }), [province]);
  assert.deepEqual(parseReferenceCities({ items: [
    { ...city, availableForDelivery: true, sellerCount: 15 },
  ] }, provinceId), [city]);
  assert.equal(parseReferenceCities({ items: [
    { ...city, provinceId: secondProvinceId },
  ] }, provinceId), null);
  assert.equal(parseReferenceProvinces({ items: [
    province, { ...province, slug: "other" },
  ] }), null);
  assert.equal(parseReferenceProvinces({ items: [
    province, { ...province, id: secondProvinceId },
  ] }), null);
  assert.equal(parseReferenceCities({ items: [
    city, { ...city, id: provinceId },
  ] }, provinceId), null);
  assert.equal(parseReferenceCities({ items: [
    city, { ...city, slug: "other" },
  ] }, provinceId), null);
  assert.equal(parseReferenceProvinces({ items: [
    { ...province, name: "  " },
  ] }), null);
  assert.equal(parseReferenceProvinces({ items: [
    { ...province, name: "X".repeat(121) },
  ] }), null);
  assert.equal(parseReferenceProvinces({ items: [
    { ...province, slug: "bad slug" },
  ] }), null);
  assert.equal(parseReferenceProvinces({ items: Array(101).fill(province) }), null);
  assert.equal(parseReferenceCities({ items: Array(2001).fill(city) }, provinceId), null);
  for (const bad of [null, [], {}, { items: null }, { items: {} }]) {
    assert.equal(parseReferenceProvinces(bad), null);
    assert.equal(parseReferenceCities(bad, provinceId), null);
  }
});

test("invalid province id fails before network and is never treated as empty", async () => {
  const { calls, fetchFn } = harness([]);
  assert.equal(validReferenceId(provinceId), true);
  for (const bad of [
    "", "not-a-uuid", "00000000-0000-0000-0000-000000000000",
    "123e4567-e89b-12d3-a456-426614174000&admin=true",
  ]) {
    assert.equal(validReferenceId(bad), false);
    assert.deepEqual(await getSellerReferenceCities(bad, fetchFn),
      { status: "unavailable" });
  }
  assert.deepEqual(calls, []);
});

test("choice writes only existing city/region TEXT; it never claims coverage", () => {
  assert.equal(formatSellerReferenceCity(province, city),
    "شهر تست، استان تست");
  assert.equal(formatSellerReferenceCity(province, {
    ...city, provinceId: secondProvinceId,
  }), null);
  assert.equal(formatSellerReferenceCity(province, {
    ...city, name: "ش".repeat(120),
  }), null);
  const chosen = formatSellerReferenceCity(province, city);
  assert.equal(typeof chosen, "string");
  assert.equal(chosen.includes(cityId), false);
  assert.equal(chosen.includes("DELIVERY"), false);
  assert.equal(chosen.includes("ACTIVE"), false);
});

test("an AbortSignal is forwarded so stale province changes cannot update UI", async () => {
  const abort = new AbortController();
  const { fetchFn, calls } = harness([
    reply(200, { items: [city] }),
  ]);
  const result = await getSellerReferenceCities(
    provinceId, fetchFn, abort.signal);
  assert.deepEqual(result, { status: "ok", items: [city] });
  assert.equal(calls[0].init.signal, abort.signal);
});
