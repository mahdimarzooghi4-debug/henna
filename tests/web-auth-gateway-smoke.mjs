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

      if (url?.startsWith("/api/v1/catalog/") && request.method === "GET") {
        assert.equal(request.headers.cookie, undefined,
          "catalog gateway must not send browser session cookies upstream");
        assert.equal(request.headers.authorization, undefined,
          "public catalog must not expose or forward buyer session bearer");
        if (url === "/api/v1/catalog/categories") {
          response.writeHead(200);
          response.end(JSON.stringify({ items: [
            { id: challengeId, name: "گروه تست", slug: "ci-group",
              internalAdminNote: "must not leak" },
          ] }));
        } else if (url.startsWith("/api/v1/catalog/products?")) {
          const query = new URL(url, "https://catalog.test").searchParams;
          assert.equal(query.get("page"), "1");
          assert.equal(query.get("pageSize"), "20");
          if (query.get("search") === "outage") {
            response.writeHead(503);
            response.end(JSON.stringify({ message: "upstream down" }));
          } else if (query.get("search") === "broken") {
            response.writeHead(200);
            response.end(JSON.stringify({ items: [{ id: "bad" }], page: 1,
              pageSize: 20, total: 1 }));
          } else {
            response.writeHead(200);
            response.end(JSON.stringify({ items: [{
              id: accountId, categoryId: challengeId, name: "کالای نمونه آزمون",
              kind: "GOOD", description: null, price: 42000,
              sellerId: challengeId, state: "PUBLISHED",
            }], page: 1, pageSize: 20, total: 1 }));
          }
        } else if (url === "/api/v1/catalog/products/" + accountId) {
          response.writeHead(200);
          response.end(JSON.stringify({
            id: accountId, categoryId: challengeId, name: "کالای نمونه آزمون",
            kind: "GOOD", description: null, price: 42000,
            privateModerationReason: "never leak",
          }));
        } else {
          response.writeHead(404);
          response.end(JSON.stringify({ message: "not found" }));
        }
      } else if (url === "/api/v1/auth/otp/request" && request.method === "POST") {
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
        if ((sellerDraft?.revision ?? 0) !== data.revision) {
          response.writeHead(409);
          response.end(JSON.stringify({ message: "stale revision" }));
        } else {
          sellerDraft = {
            ...data,
            revision: data.revision + 1,
            status: "DRAFT",
            applicantType: sellerDraft?.applicantType ?? null,
            completedStep: sellerDraft?.completedStep ?? 1,
          };
          response.writeHead(200);
          response.end(JSON.stringify({
            status: "DRAFT", revision: sellerDraft.revision,
          }));
        }
      } else if (url === "/api/v1/seller/registration/applicant-type" &&
        request.headers.authorization === `Bearer ${token}` && !revoked &&
        request.method === "PUT") {
        const data = JSON.parse(body);
        assert.deepEqual(Object.keys(data).sort(),
          ["applicantType", "revision"].sort());
        if (sellerDraft?.revision !== data.revision) {
          response.writeHead(409);
          response.end(JSON.stringify({ message: "stale revision" }));
        } else {
          assert.ok(data.applicantType === "NATURAL" ||
            data.applicantType === "LEGAL");
          sellerDraft = {
            ...sellerDraft,
            applicantType: data.applicantType,
            completedStep: 2,
            revision: data.revision + 1,
          };
          response.writeHead(200);
          response.end(JSON.stringify({
            status: "DRAFT",
            revision: sellerDraft.revision,
            applicantType: sellerDraft.applicantType,
            completedStep: 2,
          }));
        }
      } else if (url === "/api/v1/seller/registration/identity/natural" &&
        request.headers.authorization === `Bearer ${token}` && !revoked &&
        request.method === "POST") {
        const data = JSON.parse(body);
        assert.deepEqual(Object.keys(data).sort(),
          ["nationalCode", "revision"].sort());
        if (sellerDraft?.revision !== data.revision ||
          sellerDraft?.applicantType !== "NATURAL" ||
          sellerDraft?.completedStep !== 2) {
          response.writeHead(409);
          response.end(JSON.stringify({ message: "stale identity step" }));
        } else if (data.nationalCode === "0499370899") {
          response.writeHead(503);
          response.end(JSON.stringify({ message: "provider unavailable" }));
        } else {
          assert.equal(data.nationalCode, "0084575948");
          sellerDraft = {
            ...sellerDraft,
            identityStatus: "VERIFIED",
            nationalCodeMasked: "******5948",
            completedStep: 3,
            revision: data.revision + 1,
          };
          response.writeHead(200);
          response.end(JSON.stringify({
            status: "DRAFT",
            revision: sellerDraft.revision,
            identityStatus: "VERIFIED",
            nationalCodeMasked: "******5948",
            completedStep: 3,
          }));
        }
      } else if (url === "/api/v1/seller/registration/submit" &&
        request.headers.authorization === `Bearer ${token}` && !revoked &&
        request.method === "POST") {
        const data = JSON.parse(body);
        assert.deepEqual(Object.keys(data), ["revision"]);
        assert.equal(data.revision, sellerDraft?.revision);
        assert.match(request.headers["idempotency-key"] ?? "",
          /^[0-9a-f-]{36}$/i);
        sellerDraft = {
          ...sellerDraft,
          status: "SUBMITTED",
          revision: sellerDraft.revision + 1,
          submittedAtUtc: "2026-09-25T12:30:00Z",
        };
        response.writeHead(200);
        response.end(JSON.stringify({
          status: "SUBMITTED",
          revision: sellerDraft.revision,
          submittedAtUtc: sellerDraft.submittedAtUtc,
        }));
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
    body: JSON.stringify({ ...draft, revision: 0 }),
  });
  assert.equal(sellerSaved.status, 200);
  assert.deepEqual(await sellerSaved.json(), { status: "DRAFT", revision: 1 });
  assert.equal(sellerSaved.headers.get("cache-control"), "no-store");
  const sellerRestored = await fetch(sellerUrl, {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(sellerRestored.status, 200);
  assert.deepEqual(await sellerRestored.json(), {
    ...draft, phone, postalCode: "1234567890", status: "DRAFT", revision: 1,
    applicantType: null,
    identityStatus: null,
    nationalCodeMasked: null,
    legalNationalId: null,
    legalName: null,
    legalRepresentativeName: null,
    legalRepresentativePhone: null,
    completedStep: 1,
  });
  const sellerStale = await fetch(sellerUrl, {
    method: "PUT",
    headers: {
      Cookie: sessionCookie, Origin: base,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...draft, storeName: "نسخه قدیمی", revision: 0 }),
  });
  assert.equal(sellerStale.status, 409);
  const savedSecond = await fetch(sellerUrl, {
    method: "PUT",
    headers: {
      Cookie: sessionCookie, Origin: base,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...draft, storeName: "نسخه دوم", revision: 1 }),
  });
  assert.equal(savedSecond.status, 200);
  assert.deepEqual(await savedSecond.json(), { status: "DRAFT", revision: 2 });
  const sellerAfter = await fetch(sellerUrl, { headers: { Cookie: sessionCookie } });
  assert.equal(sellerAfter.status, 200);
  assert.equal((await sellerAfter.json()).storeName, "نسخه دوم");
  assert.ok(!JSON.stringify(sellerDraft).includes(token));

  const applicantCsrf = await fetch(
    sellerUrl + "/applicant-type", {
      method: "PUT",
      headers: {
        Cookie: sessionCookie, Origin: "https://other.test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ applicantType: "NATURAL", revision: 2 }),
    });
  assert.equal(applicantCsrf.status, 403);

  const applicantUnknown = await fetch(
    sellerUrl + "/applicant-type", {
      method: "PUT",
      headers: {
        Cookie: sessionCookie, Origin: base,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        applicantType: "NATURAL", revision: 2, role: "ADMIN",
      }),
    });
  assert.equal(applicantUnknown.status, 400);

  const applicantSaved = await fetch(
    sellerUrl + "/applicant-type", {
      method: "PUT",
      headers: {
        Cookie: sessionCookie, Origin: base,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ applicantType: "NATURAL", revision: 2 }),
    });
  assert.equal(applicantSaved.status, 200);
  assert.deepEqual(await applicantSaved.json(), {
    status: "DRAFT", revision: 3,
    applicantType: "NATURAL", completedStep: 2,
  });

  const identityCsrf = await fetch(
    sellerUrl + "/identity/natural", {
      method: "POST",
      headers: {
        Cookie: sessionCookie, Origin: "https://other.test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ nationalCode: "0084575948", revision: 3 }),
    });
  assert.equal(identityCsrf.status, 403);

  const identityUnknown = await fetch(
    sellerUrl + "/identity/natural", {
      method: "POST",
      headers: {
        Cookie: sessionCookie, Origin: base,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nationalCode: "0084575948", revision: 3, verified: true,
      }),
    });
  assert.equal(identityUnknown.status, 400);

  const identityUnavailable = await fetch(
    sellerUrl + "/identity/natural", {
      method: "POST",
      headers: {
        Cookie: sessionCookie, Origin: base,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ nationalCode: "0499370899", revision: 3 }),
    });
  assert.equal(identityUnavailable.status, 503);
  assert.equal(sellerDraft.revision, 3);
  assert.equal(sellerDraft.completedStep, 2);

  const identityVerified = await fetch(
    sellerUrl + "/identity/natural", {
      method: "POST",
      headers: {
        Cookie: sessionCookie, Origin: base,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ nationalCode: "0084575948", revision: 3 }),
    });
  assert.equal(identityVerified.status, 200);
  assert.deepEqual(await identityVerified.json(), {
    status: "DRAFT",
    revision: 4,
    identityStatus: "VERIFIED",
    nationalCodeMasked: "******5948",
    completedStep: 3,
  });

  // Steps 4-6 are exercised by their own slices. This gateway test advances
  // only its in-memory upstream fixture so Seller 005's submit BFF remains
  // covered without inventing shipping endpoints.
  sellerDraft = { ...sellerDraft, completedStep: 6 };

  const submissionKey = "0f3b8bc9-61bd-4ca4-8964-7fce65f4e91b";
  const submitCsrf = await fetch(sellerUrl, {
    method: "POST",
    headers: {
      Cookie: sessionCookie, Origin: "https://other.test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ revision: 4, idempotencyKey: submissionKey }),
  });
  assert.equal(submitCsrf.status, 403);
  const submitUnknown = await fetch(sellerUrl, {
    method: "POST",
    headers: {
      Cookie: sessionCookie, Origin: base,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      revision: 4, idempotencyKey: submissionKey, status: "ACTIVE",
    }),
  });
  assert.equal(submitUnknown.status, 400);
  const submitted = await fetch(sellerUrl, {
    method: "POST",
    headers: {
      Cookie: sessionCookie, Origin: base,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ revision: 4, idempotencyKey: submissionKey }),
  });
  assert.equal(submitted.status, 200);
  assert.deepEqual(await submitted.json(), {
    status: "SUBMITTED", revision: 5,
    submittedAtUtc: "2026-09-25T12:30:00Z",
  });
  assert.equal(submitted.headers.get("cache-control"), "no-store");

  const sellerSubmitted = await fetch(sellerUrl, {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(sellerSubmitted.status, 200);
  assert.equal((await sellerSubmitted.json()).status, "SUBMITTED");

  const categoryResponse = await fetch(base + "/api/catalog/categories", {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(categoryResponse.status, 200);
  assert.equal(categoryResponse.headers.get("cache-control"), "no-store");
  assert.deepEqual(await categoryResponse.json(), { items: [
    { id: challengeId, name: "گروه تست", slug: "ci-group" },
  ] });

  const listingResponse = await fetch(base + "/api/catalog/products", {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(listingResponse.status, 200);
  assert.equal(listingResponse.headers.get("cache-control"), "no-store");
  assert.deepEqual(await listingResponse.json(), {
    items: [{ id: accountId, categoryId: challengeId,
      name: "کالای نمونه آزمون", kind: "GOOD", description: null }],
    page: 1, pageSize: 20, total: 1,
  });

  const detailResponse = await fetch(
    base + "/api/catalog/products/" + accountId);
  assert.equal(detailResponse.status, 200);
  assert.deepEqual(await detailResponse.json(), {
    id: accountId, categoryId: challengeId,
    name: "کالای نمونه آزمون", kind: "GOOD", description: null,
  });
  const hidden = await fetch(base + "/api/catalog/products/" + challengeId);
  assert.equal(hidden.status, 404);
  for (const path of [
    "/api/catalog/products?page=0",
    "/api/catalog/products?pageSize=51",
    "/api/catalog/products?page=1&page=2",
    "/api/catalog/products?categoryId=bad",
    "/api/catalog/products?search=" + "a".repeat(81),
    "/api/catalog/products?extra=1",
  ]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 400, path);
  }
  assert.equal((await fetch(
    base + "/api/catalog/products?search=outage")).status, 503);
  assert.equal((await fetch(
    base + "/api/catalog/products?search=broken")).status, 503);
  assert.equal((await fetch(
    base + "/api/catalog/products/not-a-guid")).status, 404);
  console.log("CI-only buyer catalog gateway: validated public data, no bearer/price leakage, 400/404/503 separation OK");

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
  console.log("CI-only web auth + seller registration gateway: secure cookie, draft, submit boundary and revocation OK");
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
