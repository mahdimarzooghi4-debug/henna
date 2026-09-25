/**
 * Pure behavior tests for the production seller preflight and redirect policy.
 * Mocked fetch below is CI-only; no fake SMS or authenticated account ships.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  emptySellerFields, loadSellerDraft,
} from "../apps/web-marketplace/lib/seller-draft-preflight.ts";
import {
  safeSellerReturnTo, sellerLoginHref, sellerRegistrationPath,
} from "../apps/web-marketplace/lib/seller-return.ts";

const fields = {
  storeName: "فروشگاه واقعی از دید تست",
  ownerName: "مسئول تست",
  phone: "09123456789",
  city: "شهر تست",
  address: "نشانی تست",
  postalCode: "1234567890",
};

const reply = (status, data, contentType = "application/json") =>
  new Response(status === 204 ? null : JSON.stringify(data), {
    status, headers: { "Content-Type": contentType },
  });

function harness(responses) {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url, ...init });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next;
  };
  return { calls, fetchFn };
}

test("the only return destination is the exact existing seller registration path", () => {
  assert.equal(sellerLoginHref, "/auth?returnTo=%2Fseller%2Fregister");
  assert.equal(safeSellerReturnTo(sellerRegistrationPath),
    sellerRegistrationPath);
  for (const value of [
    null, undefined, "", "/",
    "/seller/register/", "/seller/register?state=logged-in",
    "/seller/register#done", "/seller/register/../auth",
    "/seller/%72egister", "%2Fseller%2Fregister",
    "//malicious.test", "https://malicious.test",
    "https://malicious.test/seller/register",
    "\\malicious.test", "/\\malicious.test",
    "/seller/register\nX-Header: evil",
    [sellerRegistrationPath], [sellerRegistrationPath, "/"],
    { toString: () => sellerRegistrationPath },
  ]) {
    assert.equal(safeSellerReturnTo(value), null, String(value));
  }
});

test("401 requires login and 404 is the ONLY absence proof", async () => {
  const { calls, fetchFn } = harness([
    reply(401, {}), reply(404, {}),
  ]);
  assert.deepEqual(await loadSellerDraft(fetchFn), { status: "signedOut" });
  assert.deepEqual(await loadSellerDraft(fetchFn),
    { status: "new", revision: 0 });
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.url, "/api/seller/registration");
    assert.equal(call.cache, "no-store");
    assert.equal(call.method, undefined);
    assert.equal(call.headers, undefined);
  }
});

test("200 restores all fields and the EXACT persisted revision together", async () => {
  const { fetchFn } = harness([
    reply(200, { ...fields, status: "DRAFT", revision: 17 }),
  ]);
  const restored = await loadSellerDraft(fetchFn);
  assert.deepEqual(restored,
    {
      status: "restored", revision: 17, fields,
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
      activityProvinceId: null,
      activityProvinceName: null,
      activityCityId: null,
      activityCityName: null,
      activityAddress: null,
      activityHours: null,
      sellerDelivery: null,
      pickup: null,
      serviceArea: null,
      registrationContactName: null,
      registrationContactRole: null,
      backupPhone: null,
      websiteOrSocial: null,
      businessEmail: null,
      responseHours: null,
      documentsRequired: false,
      completedStep: 1,
    });
  assert.deepEqual(emptySellerFields, {
    storeName: "", ownerName: "", phone: "",
    city: "", address: "", postalCode: "",
  });
});

test("incomplete, stale-format or broken 200 cannot unlock an unversioned draft", async () => {
  for (const data of [
    {}, null,
    { ...fields, status: "PUBLISHED", revision: 1 },
    { ...fields, status: "DRAFT", revision: 0 },
    { ...fields, status: "DRAFT", revision: 2147483647 },
    { ...fields, status: "DRAFT", revision: 1.2 },
    { ...fields, status: "DRAFT", revision: "1" },
    { ...fields, storeName: undefined, status: "DRAFT", revision: 1 },
    { ...fields, status: "DRAFT", revision: 1, postalCode: 1234567890 },
  ]) {
    const { fetchFn } = harness([reply(200, data)]);
    assert.deepEqual(await loadSellerDraft(fetchFn),
      { status: "unavailable" });
  }
});

test("an unavailable preflight never pretends the account has no draft", async () => {
  const answers = [
    reply(500, {}), reply(503, {}),
    reply(429, {}), reply(200, { error: "unknown" }),
    new Response("not json", { status: 200 }),
    new Error("offline"),
  ];
  for (const answer of answers) {
    const { fetchFn } = harness([answer]);
    assert.deepEqual(await loadSellerDraft(fetchFn),
      { status: "unavailable" });
  }
});

test("in-flight hydration does not release a draft revision early", async () => {
  let resolve;
  const fetchFn = () => new Promise((done) => { resolve = done; });
  let completed = false;
  const outcome = loadSellerDraft(fetchFn).then((x) => {
    completed = true;
    return x;
  });
  await Promise.resolve();
  assert.equal(completed, false,
    "a pending GET must not unlock an assumed revision zero");
  resolve(reply(200, { ...fields, status: "DRAFT", revision: 4 }));
  assert.deepEqual(await outcome,
    {
      status: "restored", revision: 4, fields,
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
      activityProvinceId: null,
      activityProvinceName: null,
      activityCityId: null,
      activityCityName: null,
      activityAddress: null,
      activityHours: null,
      sellerDelivery: null,
      pickup: null,
      serviceArea: null,
      registrationContactName: null,
      registrationContactRole: null,
      backupPhone: null,
      websiteOrSocial: null,
      businessEmail: null,
      responseHours: null,
      documentsRequired: false,
      completedStep: 1,
    });
  assert.equal(completed, true);
});

test("a real abort signal is forwarded for unmount cancellation", async () => {
  const controller = new AbortController();
  const { fetchFn, calls } = harness([new Error("aborted")]);
  assert.deepEqual(await loadSellerDraft(fetchFn, controller.signal),
    { status: "unavailable" });
  assert.equal(calls[0].signal, controller.signal);
});
