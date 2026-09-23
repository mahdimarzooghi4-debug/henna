import assert from "node:assert/strict";
import test from "node:test";
import {
  BUYER_PAGE_SIZE, buyerCatalogPath, parseBuyerCategories,
  parseBuyerPage, reconcilePublishedBuyerCategory, validBuyerSearch,
} from "../apps/web-marketplace/lib/buyer-catalog.ts";

const CATEGORY = "2fd59aad-5834-4717-9462-c5e520dd7a31";
const PRODUCT = "b8b52eee-b4c3-4ae5-a72a-8a78dd1561c0";
const category = { id: CATEGORY, name: "دستهٔ تأییدشده", slug: "published" };
const product = {
  id: PRODUCT, categoryId: CATEGORY, name: "کالای تأییدشده",
  kind: "GOOD", description: null,
};
const listing = { items: [product], page: 1, pageSize: 20, total: 1 };

test("empty published response is not a network or schema failure", () => {
  assert.deepEqual(parseBuyerCategories({ items: [] }), []);
  assert.deepEqual(parseBuyerPage({
    items: [], page: 1, pageSize: BUYER_PAGE_SIZE, total: 0,
  }, 1), { items: [], page: 1, pageSize: 20, total: 0 });
  assert.equal(parseBuyerCategories({}), null);
  assert.equal(parseBuyerPage({}, 1), null);
});

test("only allowlisted public catalog identity and description enter the UI", () => {
  assert.deepEqual(parseBuyerCategories({
    items: [{ ...category, sellerPhone: "SECRET" }],
  }), [category]);
  assert.deepEqual(parseBuyerPage({
    ...listing, items: [{ ...product, price: 500, sellerId: "SECRET",
      stock: 20 }],
  }, 1), listing);
  assert.equal(parseBuyerPage({ ...listing, page: 2 }, 1), null);
  assert.equal(parseBuyerPage({ ...listing, pageSize: 50 }, 1), null);
  assert.equal(parseBuyerPage({ ...listing, total: 0 }, 1), null);
  assert.equal(parseBuyerPage({ ...listing, items: [
    { ...product, kind: "OFFER" },
  ] }, 1), null);
  assert.equal(parseBuyerPage({ ...listing, items: [
    { ...product, id: "bad" },
  ] }, 1), null);
  assert.equal(parseBuyerCategories({ items: [
    { ...category, name: "" },
  ] }), null);
});

test("only genuine selected UUID and normalized search reach the browse query", () => {
  assert.equal(buyerCatalogPath(1, null, ""),
    "/api/catalog/products?page=1&pageSize=20");
  const url = new URL(buyerCatalogPath(2, CATEGORY, "کالا & خدمت"),
    "https://www.hana.test");
  assert.deepEqual([...url.searchParams],
    [["page", "2"], ["pageSize", "20"], ["categoryId", CATEGORY],
      ["search", "کالا & خدمت"]]);
  assert.equal(validBuyerSearch("کالا"), true);
  assert.equal(validBuyerSearch("x".repeat(81)), false);
  assert.equal(validBuyerSearch("a\n"), false);
});

test("only an explicitly confirmed published list can retire a removed category", () => {
  const bookmark = {
    categoryId: CATEGORY, search: "چای & خرما", page: 2,
  };
  assert.deepEqual(reconcilePublishedBuyerCategory(bookmark, [category]),
    null, "still published: preserve category and original page");
  assert.deepEqual(reconcilePublishedBuyerCategory(bookmark, []), {
    categoryId: null, search: "چای & خرما", page: 1,
  }, "published 200 empty: remove category but preserve search");
  assert.deepEqual(reconcilePublishedBuyerCategory(bookmark, [{
    ...category, id: "4ef06bf5-32f3-4b10-a41e-5bd69f6bb442",
  }]), { categoryId: null, search: "چای & خرما", page: 1 });
  assert.equal(reconcilePublishedBuyerCategory({
    categoryId: null, search: "", page: 3,
  }, []), null, "all-categories search is never reset");
  assert.equal(reconcilePublishedBuyerCategory({
    categoryId: CATEGORY.toUpperCase(), search: "", page: 2,
  }, [category]), null, "UUID case does not cause false removal");
  assert.deepEqual(bookmark, {
    categoryId: CATEGORY, search: "چای & خرما", page: 2,
  }, "caller state is not mutated");
});
