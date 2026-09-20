/**
 * Frontend 006: pure 3-way merge of the six real seller draft fields.
 * These identities, phone numbers and addresses are CI-only fixtures.
 * No provider, invented product screen or shipping demo account is created.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  combineSellerDraftFields,
  suggestSellerFieldChoices,
  unresolvedSellerFieldChoices,
} from "../apps/web-marketplace/lib/seller-field-merge.ts";
import {
  sellerFieldDifferences,
} from "../apps/web-marketplace/lib/seller-conflict.ts";
import {
  loadSellerDraft, sellerFieldKeys,
} from "../apps/web-marketplace/lib/seller-draft-preflight.ts";

const base = {
  storeName: "فروشگاه اولیه",
  ownerName: "مسئول اولیه",
  phone: "09123456789",
  city: "شهر اولیه",
  address: "نشانی اولیه",
  postalCode: "1234567890",
};
const mine = {
  ...base,
  storeName: "فروشگاه ویرایش‌شده من",
  city: "شهر ویرایش‌شده من",
  address: "نشانی ویرایش‌شده من",
};
const server = {
  ...base,
  ownerName: "مسئول سرور",
  city: "شهر ویرایش‌شده سرور",
};

test("three-way defaults preserve independent edits and demand explicit overlapping decision", () => {
  const before = structuredClone(base);
  const local = structuredClone(mine);
  const remote = structuredClone(server);
  const choices = suggestSellerFieldChoices(base, mine, server);
  assert.deepEqual(sellerFieldKeys, [
    "storeName", "ownerName", "phone", "city", "address", "postalCode",
  ]);
  assert.deepEqual(choices, {
    storeName: "mine", ownerName: "server",
    phone: "server", city: null,
    address: "mine", postalCode: "server",
  });
  assert.equal(unresolvedSellerFieldChoices(mine, server, choices), 1);
  assert.equal(combineSellerDraftFields(mine,
    { fields: server, revision: 18 }, choices), null,
  "unresolved same-field edits cannot silently pick a winner");
  assert.deepEqual(base, before);
  assert.deepEqual(mine, local);
  assert.deepEqual(server, remote);
});

test("select one field and combine without an automatic network write", () => {
  const choices = suggestSellerFieldChoices(base, mine, server);
  choices.city = "server";
  const combined = combineSellerDraftFields(mine,
    { fields: server, revision: 18 }, choices);
  assert.deepEqual(combined, {
    fields: {
      ...base, storeName: mine.storeName,
      ownerName: server.ownerName,
      city: server.city,
      address: mine.address,
    }, revision: 18, saved: false,
  });
  assert.equal(combined.fields.phone, base.phone);
  assert.equal(combined.fields.postalCode, base.postalCode);
  assert.deepEqual(sellerFieldDifferences(combined.fields, server)
    .map(({ key }) => key), ["storeName", "address"]);
});

test("explicitly choose local overlapping field and override server-only edits", () => {
  const choices = suggestSellerFieldChoices(base, mine, server);
  choices.city = "mine";
  choices.ownerName = "mine";
  const combined = combineSellerDraftFields(mine,
    { fields: server, revision: 18 }, choices);
  assert.equal(combined.fields.city, mine.city);
  assert.equal(combined.fields.ownerName, base.ownerName);
  assert.equal(combined.revision, 18);
  assert.equal(combined.saved, false);
});

test("choosing every server field results in saved UI only when values already match", () => {
  const choices = suggestSellerFieldChoices(base, mine, server);
  for (const key of sellerFieldKeys) choices[key] = "server";
  const combined = combineSellerDraftFields(mine,
    { fields: server, revision: 18 }, choices);
  assert.deepEqual(combined,
    { fields: server, revision: 18, saved: true });
});

test("identical edits and unchanged fields need no user choice", () => {
  const current = { ...mine, ownerName: "مسئول سرور" };
  const choices = suggestSellerFieldChoices(base, mine, current);
  assert.equal(choices.city, "server");
  assert.equal(choices.address, "server");
  assert.equal(unresolvedSellerFieldChoices(mine, current, choices), 0);
  const chosen = combineSellerDraftFields(mine,
    { fields: current, revision: 19 }, choices);
  assert.deepEqual(chosen, { fields: current, revision: 19, saved: true });
});

test("second 409 uses newly confirmed baseline and never guesses revision zero", () => {
  const firstChoices = suggestSellerFieldChoices(base, mine, server);
  firstChoices.city = "mine";
  const prepared = combineSellerDraftFields(
    mine, { fields: server, revision: 18 }, firstChoices);
  assert.equal(prepared.revision, 18);
  const newServer = {
    ...server, address: "نشانی نسخه نوزده",
  };
  const nextChoices = suggestSellerFieldChoices(
    server, prepared.fields, newServer,
  );
  assert.equal(nextChoices.address, null,
    "both edits diverged from the newest confirmed baseline");
  assert.equal(nextChoices.storeName, "mine");
  assert.equal(nextChoices.ownerName, "server");
  assert.equal(combineSellerDraftFields(
    prepared.fields, { fields: newServer, revision: 19 },
    nextChoices,
  ), null);
});

test("only complete authenticated draft response is eligible for 3-way compare", async () => {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({
      ...server, status: "DRAFT", revision: 18,
    }), { status: 200 });
  };
  const fetched = await loadSellerDraft(fetchFn);
  assert.equal(fetched.status, "restored");
  const choices = suggestSellerFieldChoices(base, mine, fetched.fields);
  assert.equal(unresolvedSellerFieldChoices(mine, fetched.fields, choices), 1);
  assert.deepEqual(calls.map(({ url }) => url), ["/api/seller/registration"]);
  assert.equal(calls[0].init.cache, "no-store");
  for (const status of [401, 404, 503]) {
    const result = await loadSellerDraft(async () =>
      new Response("{}", { status }));
    assert.notEqual(result.status, "restored",
      "network, logout and missing draft must never unlock a merge");
  }
});
