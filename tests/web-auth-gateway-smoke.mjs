/**
 * CI-ONLY isolated test double for the future SMS/identity provider.
 * Never import or register this server in the shipping Hana API.
 * It does not send SMS; only tests the Next server-side cookie boundary.
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:https";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "hana-auth-ci-"));
const cert = join(dir, "mock-local.crt");
const key = join(dir, "mock-local.key");
const challengeId = "6b2bc828-cf5d-4af7-a026-a653739d8509";
const accountId = "fbf47579-71b4-4b85-996c-842ac497fb12";
const token = "hn1_" + Buffer.alloc(32, 7).toString("base64url");
const phone = "09123456789";
let revoked = false;
let sellerDraft = null;
let web;
let upstream;
let webLogs = "";

async function main() {
  const openssl = spawnSync("openssl", [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes",
    "-keyout", key, "-out", cert, "-days", "1",
    "-subj", "/CN=127.0.0.1",
    "-addext", "subjectAltName=IP:127.0.0.1",
  ], { stdio: "ignore" });
  assert.equal(openssl.status, 0, "local CI TLS certificate must be generated");

  upstream = createServer(
    { key: readFileSync(key), cert: readFileSync(cert) },
    async (request, response) => {
      const url = request.url;
      let body = "";
      for await (const part of request) body += part;
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Content-Type", "application/json");

      if (url === "/api/v1/auth/otp/request" && request.method === "POST") {
        response.writeHead(202);
        response.end(JSON.stringify({ challengeId }));
      } else if (url === "/api/v1/auth/otp/verify" && request.method === "POST") {
        const payload = JSON.parse(body);
        if (payload.phone !== phone || payload.challengeId !== challengeId ||
          payload.code !== "123456") {
          response.writeHead(401);
          response.end("{}");
        } else {
          response.writeHead(200);
          response.end(JSON.stringify({
            accountId, accessToken: token, tokenType: "Bearer",
            expiresAtUtc: new Date(Date.now() + 3_600_000).toISOString(),
          }));
        }
      } else if (url === "/api/v1/seller/registration" &&
        request.headers.authorization === `Bearer ${token}` && !revoked &&
        request.method === "GET") {
        response.writeHead(sellerDraft ? 200 : 404);
        response.end(JSON.stringify(sellerDraft ?? {}));
      } else if (url === "/api/v1/seller/registration" &&
        request.headers.authorization === `Bearer ${token}` && !revoked &&
        request.method === "PUT") {
        const data = JSON.parse(body);
        assert.equal(data.phone, phone);
        assert.equal(request.headers.authorization, `Bearer ${token}`);
        sellerDraft = { ...data, status: "DRAFT" };
        response.writeHead(200);
        response.end(JSON.stringify({ status: "DRAFT" }));
      } else if (url === "/api/v1/auth/session" &&
        request.headers.authorization === `Bearer ${token}` &&
        request.method === "GET" && !revoked) {
        response.writeHead(200);
        response.end(JSON.stringify({ accountId }));
      } else if (url === "/api/v1/auth/session" &&
        request.headers.authorization === `Bearer ${token}` &&
        request.method === "DELETE" && !revoked) {
        revoked = true;
        response.writeHead(204);
        response.end();
      } else {
        response.writeHead(401);
        response.end("{}");
      }
    },
  );

  await new Promise((resolve) =>
    upstream.listen(5199, "127.0.0.1", resolve));
  web = spawn("npm", [
    "run", "start", "--workspace", "@hana/web-marketplace",
    "--", "-p", "3001", "-H", "127.0.0.1",
  ], {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_EXTRA_CA_CERTS: cert,
      HANA_API_BASE_URL: "https://127.0.0.1:5199",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });
  web.stdout.on("data", (part) => { webLogs += part.toString(); });
  web.stderr.on("data", (part) => { webLogs += part.toString(); });

  const base = "http://127.0.0.1:3001";
  let started = false;
  for (let attempt = 0; attempt < 45; attempt++) {
    if (web.exitCode !== null) break;
    try {
      const health = await fetch(base + "/auth", {
        signal: AbortSignal.timeout(1000),
      });
      if (health.ok) { started = true; break; }
    } catch { /* wait for Next to start */ }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.ok(started, `Next server did not start: ${webLogs}`);

  const post = (path, data, origin = base) => fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(data),
    cache: "no-store",
  });
  const request = await post("/api/auth/otp/request", { phone });
  assert.equal(request.status, 202);
  assert.equal((await request.json()).challengeId, challengeId);
  assert.equal(request.headers.get("cache-control"), "no-store");

  const csrf = await post("/api/auth/otp/verify",
    { phone, code: "123456", challengeId }, "https://other.test");
  assert.equal(csrf.status, 403);

  const invalid = await post("/api/auth/otp/verify",
    { phone, code: "bad", challengeId });
  assert.equal(invalid.status, 400);

  const fail = await post("/api/auth/otp/verify",
    { phone, code: "000000", challengeId });
  assert.equal(fail.status, 401);
  assert.equal(fail.headers.get("set-cookie"), null);

  const verified = await post("/api/auth/otp/verify",
    { phone, code: "123456", challengeId });
  assert.equal(verified.status, 200);
  const responseJson = await verified.json();
  assert.deepEqual(responseJson, { authenticated: true, accountId });
  assert.ok(!JSON.stringify(responseJson).includes(token),
    "bearer must never reach the browser JSON");
  const cookie = verified.headers.get("set-cookie");
  assert.ok(cookie?.startsWith("__Host-hana_session="));
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /Secure/i);
  assert.match(cookie, /SameSite=Strict/i);
  assert.match(cookie, /Path=\//i);
  assert.equal(verified.headers.get("cache-control"), "no-store");
  const sessionCookie = cookie.split(";")[0];

  const anonymous = await fetch(base + "/api/auth/session");
  assert.equal(anonymous.status, 401);
  const active = await fetch(base + "/api/auth/session", {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(active.status, 200);
  assert.deepEqual(await active.json(), { authenticated: true, accountId });

  const sellerUrl = base + "/api/seller/registration";
  const sellerMissing = await fetch(sellerUrl, {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(sellerMissing.status, 404);

  const draft = {
    storeName: "فروشگاه", ownerName: "مسئول",
    phone: "۰۹۱۲۳۴۵۶۷۸۹", city: "تهران",
    address: "نشانی آزمایشی", postalCode: "۱۲۳۴۵۶۷۸۹۰",
  };
  const sellerCsrf = await fetch(sellerUrl, {
    method: "PUT",
    headers: {
      Cookie: sessionCookie, Origin: "https://other.test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(draft),
  });
  assert.equal(sellerCsrf.status, 403);
  const sellerInvalid = await fetch(sellerUrl, {
    method: "PUT",
    headers: {
      Cookie: sessionCookie, Origin: base,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...draft, postalCode: "bad" }),
  });
  assert.equal(sellerInvalid.status, 400);
  const sellerSaved = await fetch(sellerUrl, {
    method: "PUT",
    headers: {
      Cookie: sessionCookie, Origin: base,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(draft),
  });
  assert.equal(sellerSaved.status, 200);
  assert.deepEqual(await sellerSaved.json(), { status: "DRAFT" });
  assert.equal(sellerSaved.headers.get("cache-control"), "no-store");
  const sellerRestored = await fetch(sellerUrl, {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(sellerRestored.status, 200);
  assert.deepEqual(await sellerRestored.json(), {
    ...draft, phone, postalCode: "1234567890", status: "DRAFT",
  });
  assert.ok(!JSON.stringify(sellerDraft).includes(token));

  const rejectLogout = await fetch(base + "/api/auth/session", {
    method: "DELETE",
    headers: { Origin: "https://other.test", Cookie: sessionCookie },
  });
  assert.equal(rejectLogout.status, 403);

  const logout = await fetch(base + "/api/auth/session", {
    method: "DELETE",
    headers: { Origin: base, Cookie: sessionCookie },
  });
  assert.equal(logout.status, 204);
  assert.match(logout.headers.get("set-cookie") ?? "", /expires=/i);

  const after = await fetch(base + "/api/auth/session", {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(after.status, 401);
  console.log("CI-only web auth + seller draft gateway: 202/400/401/403/404/200/204, secure cookie, seller draft, revocation OK");
}

try {
  await main();
} finally {
  if (web?.pid) {
    try { process.kill(-web.pid, "SIGTERM"); } catch { /* already stopped */ }
  }
  if (upstream)
    await new Promise((resolve) => upstream.close(resolve));
  rmSync(dir, { recursive: true, force: true });
}
