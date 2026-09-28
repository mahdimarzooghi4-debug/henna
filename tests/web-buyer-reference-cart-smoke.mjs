import assert from "node:assert/strict";
import test from "node:test";
import { parseReferenceCart } from "../apps/web-marketplace/lib/buyer-cart.ts";

const PRODUCT = "60000000-0000-4000-8000-000000000001";
const cart = { revision: 4, items: [{ productId: PRODUCT, quantity: 2.5,
  unitName: "کیلوگرم", quantityScale: 1 }] };

test("reference cart accepts only catalog-unit quantities and safe revisions", () => {
  assert.deepEqual(parseReferenceCart(cart), cart);
  assert.deepEqual(parseReferenceCart({ revision: 0, items: [] }),
    { revision: 0, items: [] });
  for (const bad of [
    { ...cart, revision: -1 },
    { ...cart, revision: Number.MAX_SAFE_INTEGER + 1 },
    { ...cart, items: [{ ...cart.items[0], quantity: 2.55 }] },
    { ...cart, items: [{ ...cart.items[0], quantity: 0 }] },
    { ...cart, items: [{ ...cart.items[0], unitName: "" }] },
    { ...cart, items: [{ ...cart.items[0], productId: "bad" }] },
    { ...cart, items: [cart.items[0], cart.items[0]] },
    { ...cart, items: [{ ...cart.items[0], priceRials: 900 }] },
  ]) assert.equal(parseReferenceCart(bad), null);
});
