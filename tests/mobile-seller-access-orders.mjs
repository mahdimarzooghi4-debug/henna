import test from "node:test";
import assert from "node:assert/strict";
import {
  parseSellerIdentity, SellerAccessClient,
} from "../apps/mobile-seller/src/seller-access.ts";
import { SellerOrdersClient } from "../apps/mobile-seller/src/seller-orders.ts";

const api = "https://henna.test";
const token = "hn1_" + "A".repeat(43);
const newer = "hn1_" + "B".repeat(43);
const id = "87b90ef6-415e-4485-8c61-4e9311fa6054";
const itemId = "adcc2c87-328c-4658-a064-9cacdffdf084";
const approved = {
  sellerAccess: true, sellerPanelEnabled: true,
  trackingCode: "HNA-0123456789ABCDEF",
  activatedAtUtc: "2026-10-05T11:00:00Z",
  storeName: "فروشگاه واقعی", businessName: "کسب و کار تأییدشده",
  offeringType: "GOOD",
  capabilities: {
    dashboard: true, orders: true, listings: true, serviceListings: false,
    inventory: true, pricing: true, settlements: true, reports: true,
  },
};
const body = (payload, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
const makeStore = (initial = token) => {
  let value = initial;
  return {
    read: async () => value,
    write: async text => { value = text; },
    remove: async () => { value = null; },
  };
};

test("seller access accepts only approved active complete backend capability identity", () => {
  assert.equal(parseSellerIdentity(approved)?.storeName, approved.storeName);
  assert.equal(parseSellerIdentity({ ...approved, sellerPanelEnabled: false }), null);
  assert.equal(parseSellerIdentity({ ...approved, capabilities: {
    ...approved.capabilities, orders: false,
  }}), null);
  assert.equal(parseSellerIdentity({ ...approved, capabilities: {
    ...approved.capabilities, inventory: false,
  }}), null);
  assert.equal(parseSellerIdentity({ ...approved, trackingCode: "FAKE" }), null);
});

test("seller client sends bearer only to pinned HTTPS seller endpoint", async () => {
  const store = makeStore();
  const client = new SellerAccessClient(api, store, async (url, options) => {
    assert.equal(url, api + "/api/v1/seller/access");
    assert.equal(options.headers.Authorization, "Bearer " + token);
    assert.equal(options.redirect, "error");
    assert.equal(options.cache, "no-store");
    return body(approved);
  });
  assert.equal((await client.load()).kind, "ready");
  const invalid = new SellerAccessClient("http://evil.test", store, async () => {
    throw Error("must not fetch");
  });
  assert.equal((await invalid.load()).kind, "unavailable");
});

test("401 clears only the exact rejected credential; 403 preserves authenticated session", async () => {
  const store = makeStore();
  const noSeller = new SellerAccessClient(api, store, async () => body({}, 403));
  assert.equal((await noSeller.load()).kind, "denied");
  assert.equal(await store.read(), token);
  const expired = new SellerAccessClient(api, store, async () => body({}, 401));
  assert.equal((await expired.load()).kind, "guest");
  assert.equal(await store.read(), null);
  await store.write(token);
  const stale = new SellerAccessClient(api, store, async () => {
    await store.write(newer);
    return body({}, 401);
  });
  assert.equal((await stale.load()).kind, "unavailable");
  assert.equal(await store.read(), newer);
});

test("outage and invalid response cannot be presented as seller access", async () => {
  const store = makeStore();
  for (const response of [body({}, 503), body({ ...approved, capabilities: null }), body([])]) {
    const client = new SellerAccessClient(api, store, async () => response);
    assert.equal((await client.load()).kind, "unavailable");
  }
});

const approvedOrder = {
  Id: id, State: "PAID", RefundState: "NONE", Version: 1,
  TotalRial: 60000, CreatedAtUtc: "2026-10-05T11:00:00Z",
  Items: [{
    ProductId: itemId, ProductName: "کالای منتشرشده", Quantity: 2,
    UnitPriceRial: 30000, RefundedQuantity: 0,
  }],
};
test("orders use authenticated seller URL, exact page and strict existing commerce parser", async () => {
  const client = new SellerOrdersClient(api, makeStore(), async (url, options) => {
    assert.equal(url, api + "/api/v1/seller/orders?page=2");
    assert.equal(options.headers.Authorization, "Bearer " + token);
    return body({ page: 2, pageSize: 20, items: [approvedOrder] });
  });
  const result = await client.load(2);
  assert.equal(result.kind, "ready");
  if (result.kind === "ready") {
    assert.equal(result.items[0]?.id, id);
    assert.equal(result.items[0]?.totalRial, 60000);
  }
  assert.equal((await client.load(0)).kind, "unavailable");
});

test("wrong page, forged totals, forbidden and service errors fail closed", async () => {
  const store = makeStore();
  for (const payload of [
    { page: 1, pageSize: 20, items: [approvedOrder] },
    { page: 2, pageSize: 20, items: [{ ...approvedOrder, TotalRial: 1 }] },
  ]) {
    const client = new SellerOrdersClient(api, store, async () => body(payload));
    assert.equal((await client.load(2)).kind, "unavailable");
  }
  assert.equal((await new SellerOrdersClient(api, store, async () => body({}, 403)).load(1)).kind, "denied");
  assert.equal((await new SellerOrdersClient(api, store, async () => body({}, 401)).load(1)).kind, "unauthorized");
  assert.equal((await new SellerOrdersClient(api, store, async () => body({}, 503)).load(1)).kind, "unavailable");
});
