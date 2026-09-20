// CI-only fake transport/storage. No mock SMS or sign-in is shipped.
import assert from "node:assert/strict";
import { test } from "node:test";
import { MobileAuthClient } from "../apps/mobile-consumer/src/mobile-auth.ts";

const NOW = Date.parse("2026-09-20T12:00:00Z");
const PHONE = "09123456789";
const CHALLENGE = "123e4567-e89b-42d3-a456-426614174000";
const ACCOUNT = "123e4567-e89b-42d3-a456-426614174001";
const BEARER = "hn1_" + "A".repeat(43);
const valid = (override = {}) => ({
  accessToken: BEARER, accountId: ACCOUNT, tokenType: "Bearer",
  expiresAtUtc: new Date(NOW + 3600000).toISOString(), ...override,
});
function harness(answers = [], options = {}) {
  const calls = [];
  const storage = { value: options.initialToken ?? null, events: [] };
  const store = {
    async read() {
      storage.events.push("read");
      if (options.failRead) throw Error("secure read");
      return storage.value;
    },
    async write(value) {
      storage.events.push("write");
      if (options.failWrite) throw Error("secure write");
      storage.value = value;
    },
    async remove() {
      storage.events.push("remove");
      if (options.failRemove) throw Error("secure remove");
      storage.value = null;
    },
  };
  const fetchFn = async (url, init) => {
    calls.push({ url, ...init });
    const answer = answers.shift();
    if (!answer || answer instanceof Error) throw answer ?? Error("network");
    return new Response(answer.status === 204 ? null : JSON.stringify(answer.body ?? {}),
      { status: answer.status });
  };
  const client = new MobileAuthClient(options.base ?? "https://api.hana.test",
    store, fetchFn, () => NOW, options.allowLocalHttp ?? false);
  return { client, calls, storage };
}

test("OTP request requires valid phone and a well-formed 202 challenge", async () => {
  const { client, calls } = harness([
    { status: 202, body: {} }, { status: 202, body: { challengeId: CHALLENGE } },
  ]);
  assert.deepEqual(await client.requestOtp("123"), { status: "invalid" });
  assert.deepEqual(await client.requestOtp(PHONE), { status: "unavailable" });
  assert.deepEqual(await client.requestOtp("۰۹۱۲۳۴۵۶۷۸۹"),
    { status: "accepted", challengeId: CHALLENGE });
  assert.equal(calls.length, 2);
  assert.deepEqual(JSON.parse(calls[1].body), { phone: PHONE });
  assert.equal(calls[1].cache, "no-store");
});
test("SMS unavailable and rate limited never count as sent", async () => {
  const { client } = harness([{ status: 503 }, { status: 429 }]);
  assert.deepEqual(await client.requestOtp(PHONE), { status: "unavailable" });
  assert.deepEqual(await client.requestOtp(PHONE), { status: "limited" });
});
test("verify validates challenge and six digits before API", async () => {
  const { client, calls } = harness();
  assert.deepEqual(await client.verifyOtp(PHONE, CHALLENGE, "12345"), { status: "invalid" });
  assert.deepEqual(await client.verifyOtp(PHONE, "bad-id", "123456"), { status: "invalid" });
  assert.equal(calls.length, 0);
});
test("200 with complete actual-format session stores opaque bearer, never returns it to UI", async () => {
  const { client, calls, storage } = harness([{ status: 200, body: valid() }]);
  const outcome = await client.verifyOtp(PHONE, CHALLENGE, "۱۲۳۴۵۶");
  assert.deepEqual(outcome, { status: "authenticated", accountId: ACCOUNT });
  assert.equal(storage.value, BEARER);
  assert.deepEqual(storage.events, ["write"]);
  assert.deepEqual(JSON.parse(calls[0].body),
    { phone: PHONE, code: "123456", challengeId: CHALLENGE });
  assert.ok(!JSON.stringify(outcome).includes(BEARER));
});
test("invalid or expired 200 cannot persist an untrusted token", async () => {
  for (const body of [
    {}, valid({ accessToken: "bad" }), valid({ accountId: "bad" }),
    valid({ tokenType: "bad" }),
    valid({ expiresAtUtc: new Date(NOW - 1000).toISOString() }),
    valid({ expiresAtUtc: new Date(NOW + 86400001).toISOString() }),
  ]) {
    const { client, storage } = harness([{ status: 200, body }]);
    assert.deepEqual(await client.verifyOtp(PHONE, CHALLENGE, "123456"),
      { status: "unavailable" });
    assert.equal(storage.value, null);
  }
});
test("401, 429 and 503 never persist a token", async () => {
  for (const [code, status] of [[401, "invalid"], [429, "limited"], [503, "unavailable"]]) {
    const { client, storage } = harness([{ status: code }]);
    assert.deepEqual(await client.verifyOtp(PHONE, CHALLENGE, "123456"), { status });
    assert.equal(storage.value, null);
  }
});
test("SecureStore write failure attempts server revocation and fails closed", async () => {
  const { client, calls, storage } = harness(
    [{ status: 200, body: valid() }, { status: 204 }], { failWrite: true });
  assert.deepEqual(await client.verifyOtp(PHONE, CHALLENGE, "123456"),
    { status: "unavailable" });
  assert.equal(storage.value, null);
  assert.equal(calls[1].method, "DELETE");
  assert.equal(calls[1].headers.Authorization, "Bearer " + BEARER);
});
test("a restarted app rechecks persisted bearer with server", async () => {
  const { client, calls, storage } = harness(
    [{ status: 200, body: { accountId: ACCOUNT } }], { initialToken: BEARER });
  assert.deepEqual(await client.session(), { status: "authenticated", accountId: ACCOUNT });
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].headers.Authorization, "Bearer " + BEARER);
  assert.equal(storage.value, BEARER);
});
test("missing and malformed device bearers return guest", async () => {
  for (const bearer of [null, "bad"]) {
    const { client, calls, storage } = harness([], { initialToken: bearer });
    assert.deepEqual(await client.session(), { status: "guest" });
    assert.equal(calls.length, 0);
    assert.equal(storage.value, null);
  }
});
test("server 401 removes expired/revoked bearer from device", async () => {
  const { client, storage } = harness([{ status: 401 }], { initialToken: BEARER });
  assert.deepEqual(await client.session(), { status: "guest" });
  assert.equal(storage.value, null);
});
test("503, network failures and malformed 200 preserve session on device", async () => {
  for (const answer of [
    { status: 503 }, new Error("offline"), { status: 200, body: {} },
  ]) {
    const { client, storage } = harness([answer], { initialToken: BEARER });
    assert.deepEqual(await client.session(), { status: "unavailable" });
    assert.equal(storage.value, BEARER);
  }
});
test("204 confirmed revocation precedes deletion; already revoked 401 deletes", async () => {
  for (const status of [204, 401]) {
    const { client, calls, storage } = harness([{ status }], { initialToken: BEARER });
    assert.deepEqual(await client.logout(), { status: "signedOut" });
    assert.equal(calls[0].method, "DELETE");
    assert.equal(calls[0].headers.Authorization, "Bearer " + BEARER);
    assert.deepEqual(storage.events, ["read", "remove"]);
    assert.equal(storage.value, null);
  }
});
test("unknown revocation never deletes bearer", async () => {
  for (const answer of [{ status: 503 }, new Error("offline")]) {
    const { client, storage } = harness([answer], { initialToken: BEARER });
    assert.deepEqual(await client.logout(), { status: "unavailable" });
    assert.equal(storage.value, BEARER);
    assert.deepEqual(storage.events, ["read"]);
  }
});
test("OS keystore errors cannot be presented as successful session or logout", async () => {
  const unreadable = harness([], { initialToken: BEARER, failRead: true });
  assert.deepEqual(await unreadable.client.session(), { status: "unavailable" });
  assert.deepEqual(await unreadable.client.logout(), { status: "unavailable" });
  const stuck = harness([{ status: 204 }], { initialToken: BEARER, failRemove: true });
  assert.deepEqual(await stuck.client.logout(), { status: "unavailable" });
  assert.equal(stuck.storage.value, BEARER);
});
test("production denies plaintext; only explicit emulator local HTTP in development", async () => {
  for (const base of ["http://api.hana.test", "http://10.0.2.2:5184", "ftp://api.hana.test"]) {
    const { client, calls } = harness([], { base });
    assert.deepEqual(await client.requestOtp(PHONE), { status: "unavailable" });
    assert.equal(calls.length, 0);
  }
  const dev = harness([{ status: 503 }], {
    base: "http://10.0.2.2:5184", allowLocalHttp: true,
  });
  assert.deepEqual(await dev.client.requestOtp(PHONE), { status: "unavailable" });
  assert.equal(dev.calls[0].url, "http://10.0.2.2:5184/api/v1/auth/otp/request");
});
