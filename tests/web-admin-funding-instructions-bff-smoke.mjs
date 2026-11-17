// CI-only upstream records; no production organization data is used.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:https";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const instructionId = "123e4567-e89b-42d3-a456-426614174000";
const malformedId = "123e4567-e89b-42d3-a456-426614174001";
const token = "hn1_" + "A".repeat(43);
const nonAdminToken = "hn1_" + "B".repeat(43);
const actorId = "123e4567-e89b-42d3-a456-426614174008";
const at = "2026-09-27T10:00:00+00:00";
const dir = mkdtempSync(join(tmpdir(), "hana-admin-funding-bff-"));
const cert = join(dir, "cert.pem"), privateKey = join(dir, "key.pem");
let server, next, output = "", upstreamCalls = 0;
const idempotencyKeys = [];

const summary = {
  instructionId, organizationName: "سازمان آزمون", programName: "طرح آزمون",
  allocationMode: "HENNA_NEEDS_BASED", sourceInstructionReference: "REF-1405-01",
  state: "PENDING_VERIFICATION", revision: 1, submittedAtUtc: at,
  reviewReason: null, reviewedAtUtc: null,
};
const detail = {
  ...summary, programId: "123e4567-e89b-42d3-a456-426614174002", programRevision: 1,
};
const event = {
  eventId: "123e4567-e89b-42d3-a456-426614174003", instructionId,
  revision: 2, decision: "REJECTED", reference: "REF-1405-01",
  reason: "مرجع ناخوانا است.", actorAccountId: actorId, occurredAtUtc: at,
};

try {
  const certResult = spawnSync("openssl", ["req", "-x509", "-newkey", "rsa:2048",
    "-nodes", "-keyout", privateKey, "-out", cert, "-days", "1",
    "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1"],
    { stdio: "ignore" });
  assert.equal(certResult.status, 0);
  server = createServer({ cert: readFileSync(cert), key: readFileSync(privateKey) },
    async (req, res) => {
      upstreamCalls++;
      assert.equal(req.headers.cookie, undefined, "browser cookie must not reach API");
      assert.equal(req.headers.accept, "application/json");
      const url = new URL(req.url, "https://127.0.0.1:5202");
      if (req.headers.authorization === `Bearer ${nonAdminToken}`) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Admin role missing" })); return;
      }
      assert.equal(req.headers.authorization, `Bearer ${token}`);
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      if (req.method === "GET" && url.pathname === "/api/v1/admin/organization-funding-instructions") {
        assert.equal(url.searchParams.get("page"), "2");
        assert.equal(url.searchParams.get("pageSize"), "10");
        assert.equal(url.searchParams.get("state"), "PENDING_VERIFICATION");
        res.writeHead(200);
        res.end(JSON.stringify({ items: [summary], page: 2, pageSize: 10, total: 1 })); return;
      }
      if (req.method === "GET" && url.pathname.endsWith(`/${instructionId}/events`)) {
        res.writeHead(200); res.end(JSON.stringify({ events: [event] })); return;
      }
      if (req.method === "GET" && url.pathname.endsWith(`/${malformedId}/events`)) {
        res.writeHead(200); res.end(JSON.stringify({ events: [{ ...event, actorAccountId: "bad" }] })); return;
      }
      if (req.method === "GET" && url.pathname.endsWith(`/${instructionId}`)) {
        res.writeHead(200); res.end(JSON.stringify(detail)); return;
      }
      if (req.method === "GET" && url.pathname.endsWith(`/${malformedId}`)) {
        res.writeHead(200); res.end(JSON.stringify({ ...detail, amount: 1000000 })); return;
      }
      if (req.method === "POST" && url.pathname.endsWith(`/${instructionId}/review`)) {
        assert.match(req.headers["idempotency-key"] ?? "",
          /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        idempotencyKeys.push(req.headers["idempotency-key"]);
        let raw = ""; for await (const part of req) raw += part.toString();
        assert.deepEqual(JSON.parse(raw), { revision: 1, decision: "REJECTED", reason: "مرجع ناخوانا است." });
        res.writeHead(idempotencyKeys.length === 1 ? 201 : 200);
        res.end(JSON.stringify({ ...event, revision: 2 })); return;
      }
      res.writeHead(404); res.end("{}");
    });
  await new Promise(resolve => server.listen(5202, "127.0.0.1", resolve));
  next = spawn("npm", ["run", "start", "--workspace", "@hana/web-marketplace",
    "--", "-p", "3004", "-H", "127.0.0.1"], { detached: true,
    stdio: ["ignore", "pipe", "pipe"], env: { ...process.env,
      NODE_EXTRA_CA_CERTS: cert, HANA_API_BASE_URL: "https://127.0.0.1:5202",
      NEXT_TELEMETRY_DISABLED: "1" } });
  next.stdout.on("data", part => output += part.toString());
  next.stderr.on("data", part => output += part.toString());
  const base = "http://127.0.0.1:3004";
  let ready = false;
  for (let n = 0; n < 45; n++) {
    if (next.exitCode !== null) break;
    try { if ((await fetch(base + "/auth", { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch { }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(ready, "Next did not start: " + output);
  const cookie = `__Host-hana_session=${token}`;
  const list = await fetch(base + "/api/admin/organization-funding-instructions?page=2&pageSize=10&state=pending_verification",
    { headers: { Cookie: cookie } });
  assert.equal(list.status, 200); assert.equal(list.headers.get("cache-control"), "no-store");
  assert.deepEqual(await list.json(), { items: [summary], page: 2, pageSize: 10, total: 1 });

  const detailResponse = await fetch(base + "/api/admin/organization-funding-instructions/" + instructionId,
    { headers: { Cookie: cookie } });
  assert.equal(detailResponse.status, 200); assert.equal(detailResponse.headers.get("cache-control"), "no-store");
  const detailBody = await detailResponse.json();
  const { actorAccountId: _hiddenActor, ...publicEvent } = event;
  assert.deepEqual(detailBody, { ...detail, events: [publicEvent] });
  assert.equal(Object.hasOwn(detailBody.events[0], "actorAccountId"), false);
  assert.equal(Object.hasOwn(detailBody, "amount"), false);
  assert.equal(JSON.stringify(detailBody).includes(token), false);

  const reviewPath = base + "/api/admin/organization-funding-instructions/" + instructionId + "/review";
  const submitReview = () => fetch(reviewPath, { method: "POST", headers: {
    Cookie: cookie, Origin: base, "Content-Type": "application/json",
  }, body: JSON.stringify({ revision: 1, decision: "REJECTED", reason: "مرجع ناخوانا است." }) });
  const rejected = await submitReview();
  assert.equal(rejected.status, 200); assert.equal(rejected.headers.get("cache-control"), "no-store");
  const reviewResult = await rejected.json();
  assert.equal(reviewResult.decision, "REJECTED");
  assert.equal(Object.hasOwn(reviewResult, "actorAccountId"), false);
  assert.equal(Object.hasOwn(reviewResult, "idempotencyKey"), false);
  assert.equal(JSON.stringify(reviewResult).includes(idempotencyKeys[0]), false);
  assert.deepEqual(await (await submitReview()).json(), reviewResult);
  assert.equal(idempotencyKeys[0], idempotencyKeys[1], "retry key must be stable");

  const malformed = await fetch(base + "/api/admin/organization-funding-instructions/" + malformedId,
    { headers: { Cookie: cookie } });
  assert.equal(malformed.status, 503, "unexpected financial fields must fail closed");
  const beforeInvalid = upstreamCalls;
  for (const path of [
    "/api/admin/organization-funding-instructions?state=UNKNOWN",
    "/api/admin/organization-funding-instructions?page=1&page=2",
    "/api/admin/organization-funding-instructions?accountId=" + instructionId,
    "/api/admin/organization-funding-instructions/" + instructionId + "?debug=true",
  ]) {
    const response = await fetch(base + path, { headers: { Cookie: cookie } });
    assert.equal(response.status, 400, path); assert.equal(response.headers.get("cache-control"), "no-store");
  }
  assert.equal(upstreamCalls, beforeInvalid, "invalid query must not reach upstream");
  assert.equal((await fetch(base + "/api/admin/organization-funding-instructions")).status, 401);
  assert.equal((await fetch(base + "/api/admin/organization-funding-instructions",
    { headers: { Cookie: `__Host-hana_session=${nonAdminToken}` } })).status, 403);
  const wrongOrigin = await fetch(reviewPath, { method: "POST", headers: {
    Cookie: cookie, Origin: "https://malicious.test", "Content-Type": "application/json",
  }, body: JSON.stringify({ revision: 1, decision: "VERIFIED" }) });
  assert.equal(wrongOrigin.status, 403);
  const missingReason = await fetch(reviewPath, { method: "POST", headers: {
    Cookie: cookie, Origin: base, "Content-Type": "application/json",
  }, body: JSON.stringify({ revision: 1, decision: "REJECTED" }) });
  assert.equal(missingReason.status, 400);
  assert.equal(upstreamCalls, beforeInvalid + 1, "blocked mutations must not reach upstream");
  console.log("Admin funding instruction BFF smoke passed");
} finally {
  if (next?.pid) { try { process.kill(-next.pid, "SIGTERM"); } catch { } }
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  rmSync(dir, { recursive: true, force: true });
}
