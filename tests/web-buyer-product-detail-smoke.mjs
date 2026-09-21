import assert from "node:assert/strict";
import test from "node:test";
import {
  parseBuyerProduct, validBuyerProductId,
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
