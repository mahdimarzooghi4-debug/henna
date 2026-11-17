import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { handleBuyerPurchaseDraft } from "../apps/web-marketplace/lib/buyer-cart-bff.ts";
import { sessionCookieName } from "../apps/web-marketplace/lib/server-auth.ts";

const { NextRequest } = createRequire(new URL("../apps/web-marketplace/package.json", import.meta.url))("next/server");

const previousBase = process.env.HANA_API_BASE_URL;
process.env.HANA_API_BASE_URL = "https://api.henna.test";
const token = "hn1_" + "a".repeat(43);
const seller = "70000000-0000-4000-8000-000000000002";
const product = "60000000-0000-4000-8000-000000000001";
const offer = "70000000-0000-4000-8000-000000000001";
const draft = { revision: 1, sellerPublicId: seller, updatedAtUtc: "2026-09-28T12:30:00Z", lines: [{
  productId: product, offerId: offer, quantity: 2.5, unitName: "کیلوگرم", quantityScale: 1,
  expectedPriceRials: 100000, currentPriceRials: 100000, currentSellableQuantity: 3,
  priceChanged: false, offerAvailable: true, coversRequestedQuantity: true,
}] };

const request = (method, body, extra = {}) => new NextRequest("https://henna.test/api/buyer/cart/purchase-draft", {
  method, headers: { host: "henna.test", ...(extra.origin ? { origin: extra.origin } : {}),
    ...(body === undefined ? {} : { "content-type": "application/json" }),
    ...(extra.key ? { "idempotency-key": extra.key } : {}),
    ...(extra.cookie ? { cookie: sessionCookieName + "=" + token } : {}) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

test("purchase-draft BFF rejects unauthenticated and cross-origin writes before upstream", async () => {
  const originalFetch = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; throw Error("must not call upstream"); };
  try {
    const anonymous = await handleBuyerPurchaseDraft(request("GET"));
    assert.equal(anonymous.status, 401);
    const csrf = await handleBuyerPurchaseDraft(request("PUT", { revision: 0 }, { cookie: true, key: "123e4567-e89b-42d3-a456-426614174000", origin: "https://attacker.test" }));
    assert.equal(csrf.status, 403);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("purchase-draft BFF forwards only the HttpOnly session as server bearer and validates DTO", async () => {
  const originalFetch = globalThis.fetch; let upstream;
  globalThis.fetch = async (url, init) => {
    upstream = { url: String(url), init };
    return new Response(JSON.stringify(draft), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const key = "123e4567-e89b-42d3-a456-426614174000";
    const response = await handleBuyerPurchaseDraft(request("PUT", {
      revision: 0, cartRevision: 7, sellerPublicId: seller, confirmCurrentPriceChanges: false,
      lines: [{ productId: product, offerId: offer, expectedPriceRials: 100000 }],
    }, { cookie: true, key, origin: "https://henna.test" }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(upstream.url, "https://api.henna.test/api/v1/buyer/cart/purchase-draft");
    assert.equal(upstream.init.headers.Authorization, "Bearer " + token);
    assert.equal(upstream.init.headers["Idempotency-Key"], key);
    assert.equal(upstream.init.headers.Cookie, undefined);
    assert.equal(upstream.init.cache, "no-store");
    assert.deepEqual(JSON.parse(upstream.init.body), {
      revision: 0, cartRevision: 7, sellerPublicId: seller, confirmCurrentPriceChanges: false,
      lines: [{ productId: product, offerId: offer, expectedPriceRials: 100000 }],
    });
    const missingConfirmationField = await handleBuyerPurchaseDraft(request("PUT", {
      revision: 0, cartRevision: 7, sellerPublicId: seller,
      lines: [{ productId: product, offerId: offer, expectedPriceRials: 100000 }],
    }, { cookie: true, key, origin: "https://henna.test" }));
    assert.equal(missingConfirmationField.status, 400);
    globalThis.fetch = async () => new Response(JSON.stringify({ code: "PRICE_CONFIRMATION_REQUIRED" }), { status: 409, headers: { "content-type": "application/json" } });
    const priceConflict = await handleBuyerPurchaseDraft(request("PUT", {
      revision: 1, cartRevision: 7, sellerPublicId: seller, confirmCurrentPriceChanges: false,
      lines: [{ productId: product, offerId: offer, expectedPriceRials: 125000 }],
    }, { cookie: true, key: "123e4567-e89b-42d3-a456-426614174001", origin: "https://henna.test" }));
    assert.equal(priceConflict.status, 409);
    assert.deepEqual(await priceConflict.json(), { code: "PRICE_CONFIRMATION_REQUIRED" });
    globalThis.fetch = async () => new Response(JSON.stringify({ ...draft, internalAccountId: "secret" }), { status: 200, headers: { "content-type": "application/json" } });
    const malformed = await handleBuyerPurchaseDraft(request("GET", undefined, { cookie: true }));
    assert.equal(malformed.status, 503);
    assert.equal(malformed.headers.get("cache-control"), "no-store");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousBase === undefined) delete process.env.HANA_API_BASE_URL;
    else process.env.HANA_API_BASE_URL = previousBase;
  }
});
