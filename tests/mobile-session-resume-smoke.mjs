/**
 * Frontend 013: AppState foreground policy with the production MobileAuthClient
 * and CI-only memory token store. Never seed a real account or expose a bearer.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  shouldRecheckOnForeground,
} from "../apps/mobile-consumer/src/session-foreground.ts";
import { MobileAuthClient } from
  "../apps/mobile-consumer/src/mobile-auth.ts";

const bearer = "hn1_" + "A".repeat(43);
const account = "6b2bc828-cf5d-4af7-a026-a653739d8509";
const base = "https://api.hana.test";

function scenario(responses) {
  const calls = [];
  const events = [];
  let deviceToken = bearer;
  const store = {
    read: async () => {
      events.push("read");
      return deviceToken;
    },
    write: async () => { throw Error("foreground check cannot issue token"); },
    remove: async () => {
      events.push("remove");
      deviceToken = null;
    },
  };
  const fetchFn = async (url, options) => {
    calls.push({ url, options });
    const reply = responses.shift();
    if (reply instanceof Error) throw reply;
    return new Response(
      reply?.body === undefined ? null : JSON.stringify(reply.body),
      { status: reply.status, headers: {
        "content-type": "application/json",
      } },
    );
  };
  return {
    client: new MobileAuthClient(base, store, fetchFn),
    calls, events,
    readToken: () => deviceToken,
  };
}

test("only a return from background/inactive to active rechecks displayed session", () => {
  for (const previous of ["background", "inactive"]) {
    for (const view of ["session", "offline"]) {
      assert.equal(shouldRecheckOnForeground(
        previous, "active", view, false,
      ), true, `${previous} → active, ${view}`);
      assert.equal(shouldRecheckOnForeground(
        previous, "active", view, true,
      ), false, "a pending native auth operation already owns the result");
    }
    for (const view of ["phone", "code", "checking"]) {
      assert.equal(shouldRecheckOnForeground(
        previous, "active", view, false,
      ), false, `do not erase ${view} on foreground`);
    }
  }
  for (const previous of ["active", "unknown", "extension", ""]) {
    assert.equal(shouldRecheckOnForeground(
      previous, "active", "session", false,
    ), false, "initial start or duplicate foreground event is not a resume");
  }
  assert.equal(shouldRecheckOnForeground(
    "background", "background", "session", false,
  ), false);
  assert.equal(shouldRecheckOnForeground(
    "active", "inactive", "session", false,
  ), false);
});

test("server-validated resume stays signed in, never writes SecureStore", async () => {
  const s = scenario([{
    status: 200, body: { accountId: account },
  }]);
  assert.equal(shouldRecheckOnForeground(
    "background", "active", "session", false,
  ), true);
  assert.deepEqual(await s.client.session(), {
    status: "authenticated", accountId: account,
  });
  assert.equal(s.readToken(), bearer);
  assert.deepEqual(s.events, ["read"]);
  assert.equal(s.calls.length, 1);
  assert.equal(s.calls[0].url, base + "/api/v1/auth/session");
  assert.equal(s.calls[0].options.method, "GET");
  assert.equal(s.calls[0].options.cache, "no-store");
  assert.equal(s.calls[0].options.headers.Authorization, "Bearer " + bearer);
  assert.equal(s.calls[0].options.body, undefined);
});

test("unknown resume locks UI as offline but keeps bearer until real 401", async () => {
  const s = scenario([
    { status: 503 },
    new Error("network unavailable"),
    { status: 401 },
  ]);
  let view = "session";
  for (const [index, state] of [
    ["background", "active"],
    ["inactive", "active"],
    ["background", "active"],
  ].entries()) {
    const [previous, current] = state;
    assert.equal(shouldRecheckOnForeground(
      previous, current, view, false,
    ), true, `return ${index + 1}`);
    // App.tsx sets "checking" BEFORE fetching. No unverified "session"
    // content may remain visible during a foreground network outage.
    view = "checking";
    const result = await s.client.session();
    view = result.status === "authenticated" ? "session" :
      result.status === "guest" ? "phone" : "offline";
    if (index < 2) {
      assert.equal(result.status, "unavailable");
      assert.equal(view, "offline");
      assert.equal(s.readToken(), bearer,
        "503/network must never revoke local bearer by guesswork");
    } else {
      assert.equal(result.status, "guest");
      assert.equal(view, "phone");
      assert.equal(s.readToken(), null,
        "401 proved bearer invalid and removed it from SecureStore");
    }
  }
  assert.deepEqual(s.events,
    ["read", "read", "read", "remove"]);
  assert.equal(s.calls.length, 3);
});

test("OTP entry foreground never consults, clears or consumes SecureStore", async () => {
  const s = scenario([]);
  for (const view of ["phone", "code", "checking"]) {
    if (shouldRecheckOnForeground(
      "background", "active", view, false,
    )) await s.client.session();
  }
  assert.deepEqual(s.calls, []);
  assert.deepEqual(s.events, []);
  assert.equal(s.readToken(), bearer);
});
