import assert from "node:assert/strict";
import test from "node:test";
import {
  parseBuyerOfferPage, parseBuyerProduct, validBuyerProductId,
} from "../apps/web-marketplace/lib/buyer-catalog.ts";

const ID = "60000000-0000-4000-8000-000000000001";
const OTHER = "60000000-0000-4000-8000-000000000002";
const product = {
  id: ID, categoryId: OTHER, name: "کالای تأییدشدهٔ CI",
  kind: "GOOD", description: null,
};
test("public detail identity and allowlist never become an offer", () => {
  assert.equal(validBuyerProductId(ID), true);
  for (const invalid of ["", "bad", "00000000-0000-0000-0000-000000000000"])
    assert.equal(validBuyerProductId(invalid), false);
  assert.deepEqual(parseBuyerProduct({
    ...product, price: 10, sellerPhone: "SECRET", stock: 99,
  }, ID), product);
  assert.deepEqual(parseBuyerProduct({
    ...product, description: undefined,
  }, ID), product);
});
test("detail fails closed on mismatch and malformed fields", () => {
  assert.equal(parseBuyerProduct(product, OTHER), null);
  assert.equal(parseBuyerProduct(product, "bad"), null);
  assert.equal(parseBuyerProduct({ ...product, id: OTHER }, ID), null);
  assert.equal(parseBuyerProduct({ ...product, kind: "OFFER" }, ID), null);
  assert.equal(parseBuyerProduct({ ...product, description: 42 }, ID), null);
  assert.equal(parseBuyerProduct({ ...product, name: "" }, ID), null);
  assert.equal(parseBuyerProduct({ ...product, categoryId: "bad" }, ID), null);
});


const offer = {
  id: "70000000-0000-4000-8000-000000000001",
  sellerPublicId: "70000000-0000-4000-8000-000000000002",
  sellerName: "فروشگاه تأییدشده",
  priceRials: 1250000,
  sellableQuantity: 2.5,
  unitName: "کیلوگرم",
  quantityScale: 1,
  updatedAtUtc: "2026-09-28T12:30:00Z",
};
const offerPage = {
  items: [offer], page: 1, pageSize: 20, total: 1,
};
test("published offer page is strictly allowlisted and precision-safe", () => {
  assert.deepEqual(parseBuyerOfferPage({
    ...offerPage, items: [{ ...offer, sellerAccountId: "SECRET", stock: 99 }],
  }, 1), null);
  assert.deepEqual(parseBuyerOfferPage(offerPage, 1), offerPage);
  for (const malformed of [
    { ...offer, priceRials: Number.MAX_SAFE_INTEGER + 1 },
    { ...offer, sellableQuantity: 2.55 },
    { ...offer, quantityScale: 1.5 },
    { ...offer, updatedAtUtc: "yesterday" },
    { ...offer, unitName: "" },
  ]) assert.equal(parseBuyerOfferPage({ ...offerPage, items: [malformed] }, 1), null);
  assert.equal(parseBuyerOfferPage({ ...offerPage, page: 2 }, 1), null);
});
