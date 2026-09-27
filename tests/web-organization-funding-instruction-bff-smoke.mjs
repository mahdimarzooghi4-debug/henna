import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:https";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const orgId = "123e4567-e89b-42d3-a456-426614174000";
const programId = "123e4567-e89b-42d3-a456-426614174002";
const membershipId = "123e4567-e89b-42d3-a456-426614174001";
const instructionId = "123e4567-e89b-42d3-a456-426614174003";
const idempotencyKey = "123e4567-e89b-42d3-a456-426614174004";
const token = "hn1_" + "A".repeat(43);
const dir = mkdtempSync(join(tmpdir(), "hana-org-funding-bff-"));
const cert = join(dir, "cert.pem"), privateKey = join(dir, "key.pem");
let server, next, output = "", calls = 0, instruction = null;
const at = "2026-09-27T12:15:00+00:00";

try {
  const certResult = spawnSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", privateKey, "-out", cert, "-days", "1", "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1"], { stdio: "ignore" });
  assert.equal(certResult.status, 0);
  server = createServer({ cert: readFileSync(cert), key: readFileSync(privateKey) }, async (req, res) => {
    calls++;
    assert.equal(req.headers.cookie, undefined, "browser cookie must not reach API");
    assert.equal(req.headers.authorization, `Bearer ${token}`, "BFF must forward bearer server-to-server");
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "GET" && req.url === "/api/v1/organization/programs") {
      res.writeHead(200); res.end(JSON.stringify({ programs: [{ programId, organizationId: orgId, name: "طرح آزمون", allocationMode: "ORGANIZATION_DEFINED", description: "", state: "DRAFT", revision: 1, createdAtUtc: at }] })); return;
    }
    if (req.method === "GET" && req.url === "/api/v1/organization/profiles") {
      res.writeHead(200); res.end(JSON.stringify({ profiles: [{ organizationId: orgId, organizationName: "سازمان آزمون", memberRole: "ORG_REPRESENTATIVE", membershipId }] })); return;
    }
    const path = `/api/v1/organization/programs/${programId}/funding-instruction`;
    if (req.url === path && req.method === "GET") {
      if (!instruction) { res.writeHead(404); res.end("{}"); return; }
      res.writeHead(200); res.end(JSON.stringify(instruction)); return;
    }
    if (req.url === path && req.method === "POST") {
      assert.equal(req.headers["idempotency-key"], idempotencyKey);
      let raw = ""; for await (const part of req) raw += part.toString();
      assert.deepEqual(JSON.parse(raw), { programRevision: 1, sourceInstructionReference: "نامه رسمی ۱۴۰۵" });
      instruction = { instructionId, programId, programRevision: 1, allocationMode: "ORGANIZATION_DEFINED", sourceInstructionReference: "نامه رسمی ۱۴۰۵", state: "PENDING_VERIFICATION", revision: 1, submittedAtUtc: at };
      res.writeHead(201); res.end(JSON.stringify(instruction)); return;
    }
    res.writeHead(404); res.end("{}");
  });
  await new Promise(resolve => server.listen(5205, "127.0.0.1", resolve));
  next = spawn("npm", ["run", "start", "--workspace", "@hana/web-marketplace", "--", "-p", "3005", "-H", "127.0.0.1"], { detached: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NODE_EXTRA_CA_CERTS: cert, HANA_API_BASE_URL: "https://127.0.0.1:5205", NEXT_TELEMETRY_DISABLED: "1" } });
  next.stdout.on("data", part => output += part.toString());
  next.stderr.on("data", part => output += part.toString());
  const base = "http://127.0.0.1:3005", cookie = `__Host-hana_session=${token}`;
  let ready = false;
  for (let i = 0; i < 45; i++) {
    if (next.exitCode !== null) break;
    try { if ((await fetch(base + "/organization", { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch { }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(ready, "Next did not start: " + output);
  const path = `${base}/api/organization/programs/${programId}/funding-instruction`;
  const initial = await fetch(path, { headers: { Cookie: cookie } });
  assert.equal(initial.status, 404); assert.equal(initial.headers.get("cache-control"), "no-store");
  const beforeRejected = calls;
  const rejected = await fetch(path, { method: "POST", headers: { Cookie: cookie, Origin: "https://attacker.test", "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify({ programRevision: 1, sourceInstructionReference: "نامه رسمی ۱۴۰۵" }) });
  assert.equal(rejected.status, 403); assert.equal(calls, beforeRejected, "cross-origin mutation must not reach API");
  const missingCookie = await fetch(path);
  assert.equal(missingCookie.status, 401); assert.equal(calls, beforeRejected);
  const created = await fetch(path, { method: "POST", headers: { Cookie: cookie, Origin: base, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify({ programRevision: 1, sourceInstructionReference: "نامه رسمی ۱۴۰۵" }) });
  assert.equal(created.status, 201); assert.equal(created.headers.get("cache-control"), "no-store");
  const body = await created.json();
  assert.equal(body.state, "PENDING_VERIFICATION"); assert.equal(body.allocationMode, "ORGANIZATION_DEFINED");
  assert.equal(Object.hasOwn(body, "amount"), false); assert.equal(Object.hasOwn(body, "balance"), false);
  assert.equal(JSON.stringify(body).includes(token), false);
  const callsAfterCreate = calls;
  const badBody = await fetch(path, { method: "POST", headers: { Cookie: cookie, Origin: base, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify({ programRevision: 1, sourceInstructionReference: "نامه رسمی ۱۴۰۵", amount: 100 }) });
  assert.equal(badBody.status, 400); assert.equal(calls, callsAfterCreate, "unexpected fields must fail before upstream");
  console.log("Organization funding instruction BFF: cookie isolation, server bearer forwarding, strict origin/body, idempotent header, no-store and financial-field allowlist verified");
} finally {
  if (next?.pid) { try { process.kill(-next.pid, "SIGTERM"); } catch { } }
  if (server) await new Promise(resolve => server.close(resolve));
  rmSync(dir, { recursive: true, force: true });
}
