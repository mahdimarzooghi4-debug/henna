import assert from "node:assert/strict";
import test from "node:test";
import { parseCartOfferComparison, parsePurchaseDraft, parseReferenceCart } from "../apps/web-marketplace/lib/buyer-cart.ts";

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

test("cart offer comparison groups by opaque seller identity and checks full quantity", () => {
  const seller = "70000000-0000-4000-8000-000000000002";
  const comparison = {
    cartRevision: 4,
    items: [{ ...cart.items[0], status: "HAS_PUBLISHED_OFFERS" }],
    sellers: [{ sellerPublicId: seller, sellerName: "فروشگاه تأییدشده", offers: [{
      productId: PRODUCT, offerId: "70000000-0000-4000-8000-000000000001",
      priceRials: 100000, sellableQuantity: 2.5, requestedQuantity: 2.5,
      unitName: "کیلوگرم", quantityScale: 1, coversRequestedQuantity: true,
      updatedAtUtc: "2026-09-28T12:30:00Z",
    }] }],
  };
  assert.deepEqual(parseCartOfferComparison(comparison), comparison);
  assert.equal(parseCartOfferComparison({ ...comparison,
    sellers: [{ ...comparison.sellers[0], sellerPublicId: "bad" }],
  }), null);
  assert.equal(parseCartOfferComparison({ ...comparison,
    sellers: [{ ...comparison.sellers[0], offers: [{ ...comparison.sellers[0].offers[0], sellerAccountId: "SECRET" }] }],
  }), null);
  assert.equal(parseCartOfferComparison({ ...comparison,
    sellers: [{ ...comparison.sellers[0], offers: [{ ...comparison.sellers[0].offers[0], coversRequestedQuantity: false }] }],
  }), null);
  assert.equal(parseCartOfferComparison({ ...comparison, cartRevision: 3 }).cartRevision, 3,
    "the UI compares this server revision with the cart revision it just read");
});

test("purchase selection draft is strict, one-seller, and marks changed prices", () => {
  const seller = "70000000-0000-4000-8000-000000000002";
  const offer = "70000000-0000-4000-8000-000000000001";
  const draft = { revision: 1, sellerPublicId: seller, updatedAtUtc: "2026-09-28T12:30:00Z", lines: [{
    productId: PRODUCT, offerId: offer, quantity: 2.5, unitName: "کیلوگرم", quantityScale: 1,
    expectedPriceRials: 100000, currentPriceRials: 125000, currentSellableQuantity: 3,
    priceChanged: true, offerAvailable: true, coversRequestedQuantity: true,
  }] };
  assert.deepEqual(parsePurchaseDraft(draft), draft);
  assert.deepEqual(parsePurchaseDraft({ revision: 0, sellerPublicId: null, updatedAtUtc: null, lines: [] }),
    { revision: 0, sellerPublicId: null, updatedAtUtc: null, lines: [] });
  assert.equal(parsePurchaseDraft({ ...draft, lines: [{ ...draft.lines[0], priceChanged: false }] }), null);
  assert.equal(parsePurchaseDraft({ ...draft, lines: [{ ...draft.lines[0], sellerAccountId: "secret" }] }), null);
});
