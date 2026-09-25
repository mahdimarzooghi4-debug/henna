/**
 * Frontend 007. Local CI data only; no shipping demo store, fake SMS account
 * or persistent copy of sensitive seller drafts.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hasUnsavedSellerEdits, validateSellerDraft, isLeavingSellerPage,
} from "../apps/web-marketplace/lib/seller-edit-safety.ts";
import {
  loadSellerDraft, emptySellerFields, sellerFieldKeys,
} from "../apps/web-marketplace/lib/seller-draft-preflight.ts";

const valid = {
  storeName: "فروشگاه آزمایشی",
  ownerName: "مسئول آزمایشی",
  phone: "09123456789",
  city: "شهر آزمایشی",
  address: "نشانی آزمایشی",
  postalCode: "1234567890",
};

test("all six fields validate as one accessible batch, focus the first invalid", () => {
  const result = validateSellerDraft({
    storeName: "   ", ownerName: "\u0001اسم",
    phone: "0912", city: "\n", address: "\nداخل\nنشانی\n",
    postalCode: "123a567890",
  });
  assert.equal(result.firstInvalid, "storeName");
  assert.deepEqual(sellerFieldKeys, [
    "storeName", "ownerName", "phone", "city", "address", "postalCode",
  ]);
  assert.deepEqual(Object.keys(result.errors), sellerFieldKeys,
    "each of six independent errors should be displayed adjacent to its input");
  for (const key of sellerFieldKeys)
    assert.ok(result.errors[key]?.length > 0, key);
});

test("Persian/Arabic numerals normalize before validation, without altering text fields", () => {
  const data = validateSellerDraft({
    ...valid,
    storeName: "  سوپرمارکت بهار  ",
    phone: "۰۹۱۲۳٤۵۶۷۸۹", postalCode: "۱۲۳٤۵۶۷۸۹۰",
  });
  assert.deepEqual(data.errors, {});
  assert.equal(data.firstInvalid, null);
  assert.equal(data.values.storeName, "سوپرمارکت بهار");
  assert.equal(data.values.phone, "09123456789");
  assert.equal(data.values.postalCode, "1234567890");
  assert.equal(valid.phone, "09123456789");
});

test("limit/control and 09 rules mirror backend first-stage validation", () => {
  for (const [key, value] of [
    ["storeName", "x".repeat(121)],
    ["ownerName", "x".repeat(121)],
    ["city", "x".repeat(121)],
    ["address", "x".repeat(501)],
    ["storeName", "متن\u007fنامعتبر"],
    ["ownerName", "متن\u0085نامعتبر"],
    ["city", "شهر\u0000"],
    ["phone", "0999999999"],
    ["phone", "099999999999"],
    ["postalCode", "۱۲۳۴۵-۷۸۹۰"],
    ["postalCode", "123456789"],
  ]) {
    const result = validateSellerDraft({ ...valid, [key]: value });
    assert.equal(result.firstInvalid, key, key + ":" + value.length);
    assert.ok(result.errors[key]);
  }
});

test("server response is not required to be believed on invalid local fields", () => {
  const result = validateSellerDraft(valid);
  assert.equal(result.firstInvalid, null);
  assert.deepEqual(result.values, valid);
  assert.deepEqual(result.errors, {});
});

test("only real differences from the last confirmed server copy require leave warning", () => {
  const baseline = { ...valid };
  assert.equal(hasUnsavedSellerEdits(baseline, baseline), false);
  assert.equal(hasUnsavedSellerEdits(emptySellerFields, emptySellerFields), false);
  const editing = { ...valid, city: "شهر تازه" };
  assert.equal(hasUnsavedSellerEdits(editing, baseline), true);
  assert.equal(hasUnsavedSellerEdits(editing, { ...editing }), false,
    "a fully acknowledged save must remove the warning");
  assert.equal(hasUnsavedSellerEdits(baseline, editing), true,
    "loading server copy explicitly should change confirmed baseline");
  assert.equal(hasUnsavedSellerEdits(
    { ...emptySellerFields, storeName: "آغاز" }, emptySellerFields,
  ), true);
  assert.equal(hasUnsavedSellerEdits(
    { ...valid, storeName: "  فروشگاه آزمایشی" }, valid,
  ), true, "unsubmitted edits are not silently trimmed away before comparison");
});

test("only real page changes require same-tab link confirmation", () => {
  const from = "https://hana.example/seller/register";
  assert.equal(isLeavingSellerPage("#seller-form-heading", from), false);
  assert.equal(isLeavingSellerPage("/seller/register#next", from), false);
  assert.equal(isLeavingSellerPage("/seller/register", from), false);
  assert.equal(isLeavingSellerPage("/auth?returnTo=%2Fseller%2Fregister", from), true);
  assert.equal(isLeavingSellerPage("/", from), true);
  assert.equal(isLeavingSellerPage("//other.example/path", from), true);
  assert.equal(isLeavingSellerPage("not a valid url %%", from), true);
});

test("retrying an unavailable preflight only unlocks after authenticated draft or genuine 404", async () => {
  const replies = [
    new Response("{}", { status: 503 }),
    new Response(JSON.stringify({ ...valid, status: "DRAFT", revision: 7 }),
      { status: 200 }),
  ];
  const calls = [];
  const fetchFn = async (url, options) => {
    calls.push({ url, options });
    return replies.shift();
  };
  const first = await loadSellerDraft(fetchFn);
  assert.deepEqual(first, { status: "unavailable" });
  const second = await loadSellerDraft(fetchFn);
  assert.deepEqual(second, {
    status: "restored", fields: valid, revision: 7,
    applicantType: null,
    identityStatus: null,
    nationalCodeMasked: null,
    legalNationalId: null,
    legalName: null,
    legalRepresentativeName: null,
    legalRepresentativePhone: null,
    businessCategoryId: null,
    businessCategoryName: null,
    businessName: null,
    businessDescription: null,
    businessPhone: null,
    offeringType: null,
    completedStep: 1,
  });
  assert.equal(calls.length, 2);
  assert.ok(calls.every(({ url, options }) =>
    url === "/api/seller/registration" && options.cache === "no-store"));
  const absent = await loadSellerDraft(async () =>
    new Response(null, { status: 404 }));
  assert.deepEqual(absent, { status: "new", revision: 0 });
});
