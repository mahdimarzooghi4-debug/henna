/**
 * Browser resume policy and exact 200-body validation. This is a client-side
 * safety net in addition to the real Next/ASP.NET session checks.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isConfirmedWebSession, shouldRecheckVisibleWebSession,
} from "../apps/web-marketplace/lib/web-session-visibility.ts";

const accountId = "6b2bc828-cf5d-4af7-a026-a653739d8509";

test("only a visible confirmed/unknown account state may recheck", () => {
  for (const stage of ["authenticated", "session-unavailable"]) {
    assert.equal(shouldRecheckVisibleWebSession(
      "visible", stage, false), true);
    assert.equal(shouldRecheckVisibleWebSession(
      "visible", stage, true), false);
    for (const visibility of ["hidden", "prerender", ""]) {
      assert.equal(shouldRecheckVisibleWebSession(
        visibility, stage, false), false);
    }
  }
  for (const stage of ["checking", "phone", "code"]) {
    assert.equal(shouldRecheckVisibleWebSession(
      "visible", stage, false), false,
    "browser must not interrupt or discard a half-entered OTP");
  }
});

test("valid authenticated 200 requires explicit flag and actual UUID identity", () => {
  assert.equal(isConfirmedWebSession(
    { authenticated: true, accountId }), true);
  assert.equal(isConfirmedWebSession(
    { authenticated: true, accountId: accountId.toUpperCase(),
      other: "server metadata not surfaced" }), true);
  for (const bad of [
    null, false, [], "200", {},
    { authenticated: false, accountId },
    { authenticated: "true", accountId },
    { authenticated: true },
    { authenticated: true, accountId: null },
    { authenticated: true, accountId: 4 },
    { authenticated: true, accountId: "not-an-id" },
    { authenticated: true, accountId:
      "00000000-0000-0000-0000-000000000000" },
  ]) assert.equal(isConfirmedWebSession(bad), false);
});
