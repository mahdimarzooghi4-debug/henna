import assert from "node:assert/strict";
import test from "node:test";
import {
  buyerBrowseHref, buyerBrowseQuery, buyerDetailHref,
  buyerParamsFromRecord, parseBuyerBrowseLocation,
  reconcilePublishedBuyerPage,
} from "../apps/web-marketplace/lib/buyer-catalog.ts";

const category = "2fd59aad-5834-4717-9462-c5e520dd7a31";
const product = "60000000-0000-4000-8000-000000000021";
const good = { categoryId: category, search: "دستباف & کتان", page: 2 };

test("canonical navigation is always same-origin and carries only public state", () => {
  const query = buyerBrowseQuery(good);
  assert.equal(query, new URLSearchParams({
    categoryId: category, search: "دستباف & کتان", page: "2",
  }).toString());
  assert.equal(buyerBrowseHref(good), "/?" + query);
  assert.equal(buyerDetailHref(product, good),
    "/products/" + product + "?" + query);
  assert.equal(buyerDetailHref("https://evil.test/", good), null);
  assert.deepEqual(parseBuyerBrowseLocation(new URLSearchParams(query)), good);
  assert.equal(buyerBrowseHref({ categoryId: null, search: "", page: 1 }), "/");
});

test("invalid, oversized, duplicated and unknown URL fields cannot reach catalog", () => {
  assert.deepEqual(parseBuyerBrowseLocation(new URLSearchParams(
    "?categoryId=evil&search=" + "x".repeat(81) +
      "&page=10001&returnTo=https%3A%2F%2Fevil.test",
  )), { categoryId: null, search: "", page: 1 });
  assert.deepEqual(parseBuyerBrowseLocation(new URLSearchParams(
    "?categoryId=" + category + "&page=0&search=%00",
  )), { categoryId: category, search: "", page: 1 });
  assert.equal(buyerBrowseHref({
    categoryId: "not-a-uuid", search: "x".repeat(81), page: -1,
  }), "/");
  assert.equal(buyerBrowseHref({
    categoryId: null, search: "", page: 10001,
  }), "/");
  const params = buyerParamsFromRecord({
    search: ["first", "second"], categoryId: category,
    page: "2", returnTo: "https://evil.test",
  });
  assert.equal(params.has("search"), false);
  assert.equal(params.has("returnTo"), false);
  assert.deepEqual(parseBuyerBrowseLocation(params), {
    categoryId: category, search: "", page: 2,
  });
});

test("Persian text and page bounds survive a share/reload round-trip", () => {
  for (const page of [1, 2, 10000]) {
    const state = {
      categoryId: category.toUpperCase(),
      search: "   جست‌وجوی فارسی و لاتین % &   ",
      page,
    };
    const href = buyerBrowseHref(state);
    assert.deepEqual(parseBuyerBrowseLocation(
      new URLSearchParams(new URL(href, "https://hana.test").search),
    ), { categoryId: category, search: "جست‌وجوی فارسی و لاتین % &", page });
  }
});

test("only a confirmed empty out-of-range page repairs a saved buyer URL", () => {
  const location = { categoryId: category, search: "دستباف & کتان", page: 2 };
  const page = { items: [], page: 2, pageSize: 20, total: 20 };
  assert.deepEqual(reconcilePublishedBuyerPage(location, page), {
    ...location, page: 1,
  });
  assert.equal(reconcilePublishedBuyerPage(location, {
    ...page, total: 21,
  }), null, "a still-published second page must remain selected");
  assert.equal(reconcilePublishedBuyerPage(location, {
    ...page, items: [{ id: product }],
  }), null, "nonempty results are not an expired page");
  assert.equal(reconcilePublishedBuyerPage(location, {
    ...page, page: 1,
  }), null, "a response for a different request cannot change the URL");
  assert.equal(reconcilePublishedBuyerPage({
    ...location, page: 1,
  }, { ...page, page: 1, total: 0 }), null,
  "the first page is the valid empty published-catalog state");
  assert.deepEqual(reconcilePublishedBuyerPage({
    ...location, page: 10000,
  }, { ...page, page: 10000, total: 0 }), {
    ...location, page: 1,
  });
});
