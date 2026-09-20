/**
 * Frontend 004: a conflict only compares an authenticated server GET against
 * unsaved in-memory text. Mocked responses are CI-only; no shipping SMS,
 * seller identity, browser storage or demo draft is introduced.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  sellerFieldDifferences, sellerFieldLabels, chooseSellerDraftCopy,
} from "../apps/web-marketplace/lib/seller-conflict.ts";
import {
  loadSellerDraft,
} from "../apps/web-marketplace/lib/seller-draft-preflight.ts";

const mine = {
  storeName: "فروشگاه این پنجره",
  ownerName: "مسئول من",
  phone: "09123456789",
  city: "شهر من",
  address: "نشانی جدید و ذخیره‌نشده",
  postalCode: "1234567890",
};
const server = {
  storeName: "فروشگاه ذخیره‌شده",
  ownerName: "مسئول من",
  phone: "09123456789",
  city: "شهر سرور",
  address: "نشانی قدیمی",
  postalCode: "1234567890",
};

const response = (status, data) =>
  new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json" },
  });

test("the approved six fields are compared in form order without changing PII", () => {
  const originalMine = structuredClone(mine);
  const originalServer = structuredClone(server);
  const differences = sellerFieldDifferences(mine, server);
  assert.deepEqual(Object.keys(sellerFieldLabels), [
    "storeName", "ownerName", "phone", "city", "address", "postalCode",
  ]);
  assert.deepEqual(differences, [
    { key: "storeName", label: "نام فروشگاه",
      mine: mine.storeName, onServer: server.storeName },
    { key: "city", label: "شهر / منطقه",
      mine: mine.city, onServer: server.city },
    { key: "address", label: "آدرس فروشگاه",
      mine: mine.address, onServer: server.address },
  ]);
  assert.deepEqual(mine, originalMine);
  assert.deepEqual(server, originalServer);
  assert.deepEqual(sellerFieldDifferences(mine, mine), []);
});

test("choosing the persisted server draft requires explicit click and drops local edits", () => {
  const chosen = chooseSellerDraftCopy(mine,
    { fields: server, revision: 18 }, "server");
  assert.deepEqual(chosen,
    { fields: server, revision: 18, saved: true });
  assert.equal(chosen.fields.storeName, "فروشگاه ذخیره‌شده");
  assert.equal(mine.storeName, "فروشگاه این پنجره",
    "a pure decision must not overwrite the original in-memory draft");
});

test("choosing my draft does not auto-save or reuse the stale revision", () => {
  const chosen = chooseSellerDraftCopy(mine,
    { fields: server, revision: 18 }, "mine");
  assert.deepEqual(chosen,
    { fields: mine, revision: 18, saved: false });
  assert.equal(chosen.fields.address, "نشانی جدید و ذخیره‌نشده");
  assert.notEqual(chosen.revision, 17);
});

test("after a real 409 only a complete authenticated 200 unlocks the two choices", async () => {
  const calls = [];
  const fetchFn = async (url, options) => {
    calls.push({ url, ...options });
    return response(200, {
      ...server, status: "DRAFT", revision: 18,
      internalNote: "not a seller form field",
    });
  };
  const current = await loadSellerDraft(fetchFn);
  assert.equal(current.status, "restored");
  assert.deepEqual(current.fields, server);
  assert.equal(current.revision, 18);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/seller/registration");
  assert.equal(calls[0].cache, "no-store");
  assert.equal(calls[0].method, undefined);
  assert.equal(calls[0].body, undefined);
  assert.deepEqual(chooseSellerDraftCopy(mine, current, "mine"),
    { fields: mine, revision: 18, saved: false });
});

test("signed out, removed, broken and unavailable revision cannot permit overwriting", async () => {
  for (const result of [
    response(401, {}),
    response(404, {}),
    response(503, {}),
    response(200, { ...server, status: "DRAFT", revision: 0 }),
    response(200, { ...server, status: "PUBLISHED", revision: 17 }),
    new Error("network unavailable"),
  ]) {
    const fetchFn = async () => {
      if (result instanceof Error) throw result;
      return result;
    };
    const fetched = await loadSellerDraft(fetchFn);
    assert.notEqual(fetched.status, "restored");
    assert.deepEqual(mine, {
      storeName: "فروشگاه این پنجره",
      ownerName: "مسئول من", phone: "09123456789",
      city: "شهر من", address: "نشانی جدید و ذخیره‌نشده",
      postalCode: "1234567890",
    });
  }
});

test("changing a saved form twice creates a second conflict, not an automatic retry", () => {
  const afterFirst = chooseSellerDraftCopy(mine,
    { fields: server, revision: 18 }, "mine");
  assert.equal(afterFirst.saved, false);
  const updatedServer = { ...server, city: "نسخه جدیدتر" };
  assert.deepEqual(sellerFieldDifferences(
    afterFirst.fields, updatedServer).map(item => item.key),
  ["storeName", "city", "address"]);
  const afterSecond = chooseSellerDraftCopy(
    afterFirst.fields,
    { fields: updatedServer, revision: 19 },
    "mine",
  );
  assert.equal(afterSecond.revision, 19);
  assert.equal(afterSecond.saved, false);
  assert.equal(afterSecond.fields, mine);
});
