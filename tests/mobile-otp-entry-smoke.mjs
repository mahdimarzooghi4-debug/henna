/**
 * Frontend 012: pure user-visible Expo OTP validation + shipping transport.
 * Fixture identities are CI-only; no SMS, device keys or demo account.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { validateOtpEntry } from
  "../apps/mobile-consumer/src/otp-form-input.ts";
import { MobileAuthClient } from
  "../apps/mobile-consumer/src/mobile-auth.ts";

const phone = "09123456789";
const challenge = "6b2bc828-cf5d-4af7-a026-a653739d8509";

test("Persian/Arabic keypad input displays and submits six normalized digits", () => {
  for (const [raw, expected] of [
    ["۱۲۳۴۵۶", "123456"],
    ["١٢٣٤٥٦", "123456"],
    ["۱٢۳٤۵۶", "123456"],
    [" ۱۲۳۴۵۶ ", "123456"],
    ["000000", "000000"],
  ]) {
    assert.deepEqual(validateOtpEntry(raw),
      { code: expected, error: null });
  }
});

test("incomplete, extra and non-numeric entry receives exact field-level message", () => {
  for (const raw of [
    "", " ", "۱۲۳", "12345", "۱۲۳۴۵۶۷", "12345a",
    "۱۲۳ ۴۵۶", "۱۲۳\n۴۵۶", "۱۲۳۴۵!", "۱۲۳۴۵۶\u200b",
  ]) {
    const result = validateOtpEntry(raw);
    assert.equal(result.error, "کد تأیید باید شش رقم باشد.");
    assert.ok(!/^\d{6}$/.test(result.code));
  }
});

test("invalid UI input does not consume OTP verification attempts", async () => {
  const calls = [];
  const store = {
    read: async () => { throw Error("unexpected SecureStore read"); },
    write: async () => { throw Error("unexpected SecureStore write"); },
    remove: async () => { throw Error("unexpected SecureStore remove"); },
  };
  const client = new MobileAuthClient(
    "https://api.hana.test", store, async (...args) => {
      calls.push(args);
      return new Response(null, { status: 400 });
    },
  );
  for (const code of ["123", "  ", "۱۲۳a۵۶"]) {
    const entry = validateOtpEntry(code);
    assert.ok(entry.error);
    // ConsumerAuthScreen must return with its visible error before calling
    // auth.verifyOtp; even the transport independently rejects invalid code.
    assert.deepEqual(await client.verifyOtp(phone, challenge, entry.code),
      { status: "invalid" });
  }
  assert.equal(calls.length, 0);
});

test("validated six-digit mobile OTP reaches the real transport with no bearer", async () => {
  const calls = [];
  const store = {
    read: async () => { throw Error("unexpected read"); },
    write: async () => { throw Error("invalid response cannot write bearer"); },
    remove: async () => { throw Error("unexpected remove"); },
  };
  const client = new MobileAuthClient(
    "https://api.hana.test", store,
    async (url, init) => {
      calls.push({ url, init });
      return new Response(null, { status: 400 });
    },
  );
  const entry = validateOtpEntry("۱۲۳۴۵۶");
  assert.equal(entry.error, null);
  assert.deepEqual(await client.verifyOtp(phone, challenge, entry.code),
    { status: "invalid" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url,
    "https://api.hana.test/api/v1/auth/otp/verify");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.cache, "no-store");
  assert.equal(calls[0].init.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    phone, code: "123456", challengeId: challenge,
  });
});
