import assert from "node:assert/strict";
import test from "node:test";
import { parseCommerce, parseOffers, parseServiceListings, commerceIntent } from "../apps/web-marketplace/lib/buyer-commerce.ts";
import { safeAuthReturnTo } from "../apps/web-marketplace/lib/auth-return.ts";
const ID = "60000000-0000-4000-8000-000000000001", SELLER = "60000000-0000-4000-8000-000000000002";
const item = { ProductId: ID, Quantity: 2 };
const qi = { OfferId: ID, ProductId: ID, Quantity: 2, UnitPriceRial: 1000, OfferVersion: 1 };
const quote = { Id: ID, SellerId: SELLER, PurchaseType: "PERSONAL", FulfillmentMode: "PICKUP", Items: [qi], Unavailable: [], ItemsTotalRial: 2000, ExpiresAtUtc: "2026-10-04T16:00:00+00:00", Used: false, BuyerId: "SECRET" };
const page = items => ({ items, page: 1, pageSize: 20 });
test("scoped DTOs omit raw owner, address evidence and finance internals", () => {
 assert.deepEqual(parseCommerce("cart", "GET", page([{ Id: ID, BuyerId: "SECRET", Version: 1, Items: [item] }])), { id: ID, version: 1, items: [{ productId: ID, quantity: 2 }] });
 assert.deepEqual(parseCommerce("cart", "GET", page([])), { id: null, version: 0, items: [] });
 assert.equal(parseCommerce("cart", "GET", {}), null);
 assert.equal(parseCommerce("cart", "GET", page([{ Id: ID, Version: 1, Items: [{...item, Quantity: -1}] }])), null);
 assert.equal(JSON.stringify(parseCommerce("quotes", "POST", quote)).includes("SECRET"), false);
 assert.equal(parseCommerce("quotes", "POST", { ...quote, ItemsTotalRial: 1000 }), null);
 assert.equal(parseCommerce("quotes", "POST", { ...quote, ExpiresAtUtc: "1" }), null);
 assert.equal(parseCommerce("quotes", "POST", { ...quote, FulfillmentMode: "DELIVERY" }), null);
 assert.equal(parseCommerce("wallet", "GET", page([{ BalanceRial: 9007199254740992 }])), null);
});
test("published offers require the requested product, active publication and real store name", () => {
 const offer = { id: ID, sellerId: SELLER, productId: ID, priceRial: 1000, stock: 1, version: 1, published: true, storeName: "فروشگاه CI", sellerPhone: "SECRET" };
 assert.equal(parseOffers(page([offer]), ID)?.[0].storeName, "فروشگاه CI");
 assert.equal(JSON.stringify(parseOffers(page([offer]), ID)).includes("SECRET"), false);
 assert.equal(parseOffers(page([{ ...offer, published: false }]), ID), null);
 assert.equal(parseOffers(page([{ ...offer, productId: SELLER }]), ID), null);
 assert.equal(parseOffers(page([{ ...offer, storeName: "" }]), ID), null);
});
test("published service listings are bounded and omit seller-private fields", () => {
 const listing = {
  id: ID, sellerId: SELLER, productId: ID, priceRial: 2500,
  availabilityNote: "شنبه تا چهارشنبه با هماهنگی",
  version: 2, published: true, storeName: "خدمات CI",
  sellerPhone: "SECRET",
 };
 const parsed=parseServiceListings(page([listing]),ID);
 assert.equal(parsed?.[0].availabilityNote,"شنبه تا چهارشنبه با هماهنگی");
 assert.equal(JSON.stringify(parsed).includes("SECRET"),false);
 assert.equal(parseServiceListings(page([{...listing,published:false}]),ID),null);
 assert.equal(parseServiceListings(page([{...listing,productId:SELLER}]),ID),null);
 assert.equal(parseServiceListings(page([{...listing,availabilityNote:""}]),ID),null);
});

test("buyer notifications and tickets omit private account fields", () => {
 const notification={Id:ID,AccountId:"SECRET",Code:"REPLY_TICKET",
  ResourceId:SELLER,CreatedAtUtc:"2026-10-05T09:00:00Z",Read:false};
 const ticket={Id:ID,AccountId:"SECRET",Subject:"پیگیری سفارش",
  Message:"متن درخواست",State:"ANSWERED",
  CreatedAtUtc:"2026-10-05T09:10:00Z",Reply:"پاسخ پشتیبانی"};
 const n=parseCommerce("notifications","GET",page([notification]));
 const t=parseCommerce("tickets","GET",page([ticket]));
 assert.equal(n?.[0].code,"REPLY_TICKET");
 assert.equal(t?.[0].reply,"پاسخ پشتیبانی");
 assert.equal(JSON.stringify(n).includes("SECRET"),false);
 assert.equal(JSON.stringify(t).includes("SECRET"),false);
 assert.equal(parseCommerce("tickets","GET",page([{...ticket,State:"PRIVATE"}])),null);
 const read=parseCommerce(`notifications/${ID}/read`,"POST",
  {...notification,Read:true});
 assert.equal(read?.read,true);
});

test("idempotency retry keeps the original key/body; a reviewed changed intent gets a new key", () => {
 const first = commerceIntent(null, "orders", { quoteId: ID, unavailableDisposition: "KEEP" });
 assert.deepEqual(commerceIntent(first, "orders", { quoteId: ID, unavailableDisposition: "KEEP" }), first);
 assert.notEqual(commerceIntent(first, "orders", { quoteId: ID, unavailableDisposition: "REMOVE" }).key, first.key);
});
test("buyer login returns accept implemented paths and reject free redirects", () => {
 for (const path of ["/cart", "/checkout", "/orders", "/account", "/orders/" + ID, "/seller/register"]) assert.equal(safeAuthReturnTo(path), path);
 for (const path of ["https://evil.test/cart", "//evil.test", "/cart?next=x", "/cart#x", "/orders/invalid", "/orders/" + ID + "/cancel", "%2Fcart", ["/cart"]]) assert.equal(safeAuthReturnTo(path), null);
});

test("order pages must match the requested bounded page", () => {
 assert.deepEqual(parseCommerce("orders", "GET", {items:[],page:2,pageSize:20}, 2), []);
 assert.equal(parseCommerce("orders", "GET", {items:[],page:1,pageSize:20}, 2), null);
 for (const invalid of [0, -1, 1.5, 10001]) assert.equal(parseCommerce("orders", "GET", {items:[],page:invalid,pageSize:20}, invalid), null);
});
