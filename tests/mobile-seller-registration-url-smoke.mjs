import assert from "node:assert/strict";
import test from "node:test";
import { sellerRegistrationUrl } from "../apps/mobile-consumer/src/seller-registration-url.ts";

test("seller form opens on the configured public web origin", () => {
  assert.equal(sellerRegistrationUrl("https://henna.example/"),
    "https://henna.example/seller/register");
});

test("local HTTP is accepted only for the development emulator", () => {
  assert.equal(sellerRegistrationUrl("http://10.0.2.2:3000", true),
    "http://10.0.2.2:3000/seller/register");
  assert.equal(sellerRegistrationUrl("http://10.0.2.2:3000", false), null);
  assert.equal(sellerRegistrationUrl("http://example.com", true), null);
});

test("missing, malformed and credential-bearing web origins are rejected", () => {
  assert.equal(sellerRegistrationUrl(undefined), null);
  assert.equal(sellerRegistrationUrl("javascript:alert(1)"), null);
  assert.equal(sellerRegistrationUrl("https://user:pass@henna.example"), null);
  assert.equal(sellerRegistrationUrl("https://henna.example/?redirect=evil"), null);
});
