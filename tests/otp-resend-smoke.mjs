/**
 * CI-only OTP recovery. No SMS provider, real number, session or client
 * secret is introduced into the shipping web/Expo UI.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { otpRequestTransition as webTransition } from
  "../apps/web-marketplace/lib/otp-request-transition.ts";
import { otpRequestTransition as mobileTransition } from
  "../apps/mobile-consumer/src/otp-request-transition.ts";
import { MobileAuthClient } from
  "../apps/mobile-consumer/src/mobile-auth.ts";

const oldId = "123e4567-e89b-42d3-a456-426614174000";
const newId = "123e4567-e89b-42d3-a456-426614174001";
const previous = { challengeId: oldId, code: "۱۲۳۴۵۶" };

test("202 resend swaps challenge and clears six digits in web and Expo", () => {
  const web = webTransition({ status: "accepted", challengeId: newId },
    previous, true);
  const mobile = mobileTransition({ status: "accepted", challengeId: newId },
    previous, true);
  assert.deepEqual(
    [web.stage, web.challengeId, web.code, web.status],
    ["code", newId, "", "idle"]);
  assert.deepEqual(
    [mobile.view, mobile.challengeId, mobile.code, mobile.status],
    ["code", newId, "", "idle"]);
  assert.match(web.message, /کد قبلی دیگر معتبر نیست/);
  assert.match(mobile.notice, /کد قبلی دیگر معتبر نیست/);
  assert.ok(!JSON.stringify(web).includes("authenticated"));
  assert.ok(!JSON.stringify(mobile).includes("authenticated"));
});

test("initial accepted request starts code step but does not assert delivery", () => {
  const web = webTransition({ status: "accepted", challengeId: newId },
    { challengeId: "", code: "" }, false);
  const mobile = mobileTransition({ status: "accepted", challengeId: newId },
    { challengeId: null, code: "" }, false);
  assert.equal(web.stage, "code");
  assert.equal(mobile.view, "code");
  assert.equal(web.message, "");
  assert.equal(mobile.notice, "");
});

test("429 resend keeps old challenge and entered digits: no fake cooldown", () => {
  const web = webTransition({ status: "limited" }, previous, true);
  const mobile = mobileTransition({ status: "limited" }, previous, true);
  assert.equal(web.stage, "code");
  assert.equal(mobile.view, "code");
  assert.equal(web.challengeId, oldId);
  assert.equal(mobile.challengeId, oldId);
  assert.equal(web.code, previous.code);
  assert.equal(mobile.code, previous.code);
  assert.equal(web.status, "limited");
  assert.equal(mobile.status, "limited");
  assert.match(web.message, /اگر کد قبلی را دارید و هنوز اعتبار دارد/);
  assert.match(mobile.notice, /اگر کد قبلی را دارید و هنوز معتبر است/);
  assert.doesNotMatch(JSON.stringify(web), /\b90\b|\b60\b/);
});

test("503, invalid response or unknown send may invalidate old challenge", () => {
  for (const outcome of [{ status: "unavailable" }, { status: "invalid" }]) {
    const web = webTransition(outcome, previous, true);
    const mobile = mobileTransition(outcome, previous, true);
    assert.equal(web.stage, "phone");
    assert.equal(web.challengeId, "");
    assert.equal(web.code, "");
    assert.equal(mobile.view, "phone");
    assert.equal(mobile.challengeId, null);
    assert.equal(mobile.code, "");
    assert.match(web.message, /کد قبلی ممکن است باطل شده باشد/);
    assert.match(mobile.notice, /کد قبلی ممکن است باطل شده باشد/);
  }
});

test("an unthrottled first request failure never opens a code form", () => {
  for (const outcome of [
    { status: "limited" },
    { status: "invalid" },
    { status: "unavailable" },
  ]) {
    const web = webTransition(outcome, previous, false);
    const mobile = mobileTransition(outcome, previous, false);
    assert.deepEqual([web.stage, web.challengeId, web.code],
      ["phone", "", ""]);
    assert.deepEqual([mobile.view, mobile.challengeId, mobile.code],
      ["phone", null, ""]);
  }
});

test("Expo real OTP transport class maps two accepted requests and 429/503 without stored bearer", async () => {
  let calls = [];
  const replies = [
    { status: 202, body: { challengeId: oldId } },
    { status: 429, body: {} },
    { status: 202, body: { challengeId: newId } },
    { status: 503, body: {} },
  ];
  const fetchFn = async (url, options) => {
    calls.push({ url, ...options });
    const answer = replies.shift();
    return new Response(JSON.stringify(answer.body), { status: answer.status });
  };
  const store = {
    read: async () => { throw Error("unexpected bearer read"); },
    write: async () => { throw Error("OTP request cannot persist bearer"); },
    remove: async () => { throw Error("unexpected bearer removal"); },
  };
  const client = new MobileAuthClient("https://api.hana.test",
    store, fetchFn);
  const a = await client.requestOtp("۰۹۱۲۳۴۵۶۷۸۹");
  assert.deepEqual(a, { status: "accepted", challengeId: oldId });
  const throttled = await client.requestOtp("۰۹۱۲۳۴۵۶۷۸۹");
  assert.deepEqual(throttled, { status: "limited" });
  assert.equal(mobileTransition(throttled,
    { challengeId: a.challengeId, code: "123456" }, true).challengeId,
  oldId);
  const newer = await client.requestOtp("۰۹۱۲۳۴۵۶۷۸۹");
  assert.deepEqual(newer, { status: "accepted", challengeId: newId });
  const failed = await client.requestOtp("۰۹۱۲۳۴۵۶۷۸۹");
  assert.equal(failed.status, "unavailable");
  assert.equal(mobileTransition(failed,
    { challengeId: newer.challengeId, code: "123456" }, true).challengeId,
  null);
  assert.equal(calls.length, 4);
  for (const call of calls) {
    assert.equal(call.url, "https://api.hana.test/api/v1/auth/otp/request");
    assert.equal(call.method, "POST");
    assert.equal(call.cache, "no-store");
    assert.equal(call.headers.Authorization, undefined);
    assert.deepEqual(JSON.parse(call.body), { phone: "09123456789" });
  }
});
