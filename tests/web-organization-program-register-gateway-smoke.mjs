import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:https";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const dir = mkdtempSync(join(tmpdir(), "hana-org-register-ui-ci-"));
const cert = join(dir, "cert.pem");
const key = join(dir, "key.pem");
const orgId = "6b2bc828-cf5d-4af7-a026-a653739d8509";
const programId = "fbf47579-71b4-4b85-996c-842ac497fb12";
const foreignId = "298a02d2-9a38-41e6-9a15-65f433f5ba17";
const staleId = "18752a31-1df4-4b79-a4bd-c6cf91fd9b25";
const adminToken = "hn1_" + Buffer.alloc(32, 41).toString("base64url");
const viewerToken = "hn1_" + Buffer.alloc(32, 42).toString("base64url");
let upstream;
let next;
let logs = "";
let status = "DRAFT";
let revision = 1;
let registeredAtUtc = null;
let acceptedKey = null;

function detail(id = programId, state = status, rev = revision) {
  return {
    id,
    name: "طرح ثبت نهایی CI",
    kind: "اعتبار رفاهی",
    allocationMethod: "الگوی حنا",
    beneficiarySource: "API_OR_MANUAL",
    description: "شرح ثبت نهایی",
    status: state,
    revision: rev,
    registeredAtUtc:
      state === "REGISTERED"
        ? registeredAtUtc ?? "2026-09-24T13:30:00+00:00"
        : null,
    createdAtUtc: "2026-09-20T10:00:00+00:00",
    updatedAtUtc: "2026-09-24T13:30:00+00:00",
    organizationId: orgId,
    registrationKey: "must-not-leak",
    registeredByAccountId: "must-not-leak",
  };
}

try {
  const openssl = spawnSync("openssl", [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes",
    "-keyout", key, "-out", cert, "-days", "1",
    "-subj", "/CN=127.0.0.1",
    "-addext", "subjectAltName=IP:127.0.0.1",
  ], { stdio: "ignore" });
  assert.equal(openssl.status, 0);

  upstream = createServer(
    { key: readFileSync(key), cert: readFileSync(cert) },
    async (req, res) => {
      assert.equal(req.headers.cookie, undefined);
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      const auth = req.headers.authorization;

      if (req.url === "/api/v1/organization/me") {
        const isAdmin = auth === `Bearer ${adminToken}`;
        const isViewer = auth === `Bearer ${viewerToken}`;
        if (!isAdmin && !isViewer) {
          res.writeHead(401); res.end("{}"); return;
        }
        res.writeHead(200);
        res.end(JSON.stringify({
          organizationId: orgId,
          name: isAdmin ? "سازمان مدیر ثبت CI" : "سازمان مشاهده‌گر CI",
          organizationType: "سازمان حمایتگر",
          defaultAllocationMethod: "الگوی حنا",
          phone: null, email: null, address: null,
          representativeName: null, representativePhone: null,
          verified: true, active: true,
          memberRole: isAdmin ? "PORTAL_ADMIN" : "PORTAL_VIEWER",
        }));
        return;
      }

      if (req.url === "/api/v1/organization/programs/" + programId &&
        req.method === "GET") {
        if (auth !== `Bearer ${adminToken}` &&
          auth !== `Bearer ${viewerToken}`) {
          res.writeHead(401); res.end("{}"); return;
        }
        res.writeHead(200);
        res.end(JSON.stringify(detail()));
        return;
      }

      if (req.url === "/api/v1/organization/programs/" + foreignId &&
        req.method === "POST") {
        res.writeHead(404); res.end("{}"); return;
      }

      if (req.url === "/api/v1/organization/programs/" + staleId +
        "/register" && req.method === "POST") {
        res.writeHead(409);
        res.end(JSON.stringify({
          currentRevision: 3,
          currentStatus: "DRAFT",
          internal: "must-not-leak",
        }));
        return;
      }

      if (req.url === "/api/v1/organization/programs/" + programId +
        "/register" && req.method === "POST") {
        if (auth === `Bearer ${viewerToken}`) {
          res.writeHead(403); res.end("{}"); return;
        }
        if (auth !== `Bearer ${adminToken}`) {
          res.writeHead(401); res.end("{}"); return;
        }

        const idempotencyKey = req.headers["idempotency-key"];
        assert.equal(typeof idempotencyKey, "string");
        const body = JSON.parse(await new Promise(resolve => {
          let raw = "";
          req.on("data", chunk => { raw += chunk; });
          req.on("end", () => resolve(raw));
        }));
        assert.deepEqual(Object.keys(body), ["revision"]);

        if (acceptedKey !== null) {
          if (idempotencyKey === acceptedKey && body.revision === 1) {
            res.writeHead(200);
            res.end(JSON.stringify(detail()));
            return;
          }
          res.writeHead(409);
          res.end(JSON.stringify({
            currentRevision: revision,
            currentStatus: status,
          }));
          return;
        }

        if (body.revision !== revision) {
          res.writeHead(409);
          res.end(JSON.stringify({
            currentRevision: revision,
            currentStatus: status,
          }));
          return;
        }

        acceptedKey = idempotencyKey;
        status = "REGISTERED";
        revision += 1;
        registeredAtUtc = "2026-09-24T13:30:00+00:00";
        res.writeHead(200);
        res.end(JSON.stringify(detail()));
        return;
      }

      res.writeHead(404); res.end("{}");
    },
  );
  await new Promise(resolve =>
    upstream.listen(5205, "127.0.0.1", resolve));

  next = spawn("npm", [
    "run", "start", "--workspace", "@hana/web-marketplace",
    "--", "-p", "3006", "-H", "127.0.0.1",
  ], {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_EXTRA_CA_CERTS: cert,
      HANA_API_BASE_URL: "https://127.0.0.1:5205",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });
  next.stdout.on("data", part => { logs += part.toString(); });
  next.stderr.on("data", part => { logs += part.toString(); });

  const base = "http://127.0.0.1:3006";
  let ready = false;
  for (let i = 0; i < 45; i++) {
    if (next.exitCode !== null) break;
    try {
      if ((await fetch(base + "/auth", {
        signal: AbortSignal.timeout(1000),
      })).ok) { ready = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(ready, "Next did not start: " + logs);

  const cookie = token => ({
    Cookie: `__Host-hana_session=${token}`,
  });
  const mutationHeaders = token => ({
    ...cookie(token),
    Origin: base,
    "Content-Type": "application/json",
  });
  const registerUrl =
    base + "/api/organization/programs/" + programId + "/register";

  const adminDraftPage = await fetch(
    base + "/organization/programs/" + programId,
    { headers: cookie(adminToken) });
  const adminDraftHtml = await adminDraftPage.text();
  assert.match(adminDraftHtml, /ثبت نهایی طرح/);
  assert.match(adminDraftHtml, /ویرایش پیش‌نویس/);

  const viewerDraftPage = await fetch(
    base + "/organization/programs/" + programId,
    { headers: cookie(viewerToken) });
  const viewerDraftHtml = await viewerDraftPage.text();
  assert.doesNotMatch(viewerDraftHtml, /تأیید و ثبت نهایی/);
  assert.doesNotMatch(viewerDraftHtml, /ویرایش پیش‌نویس/);

  const csrf = await fetch(registerUrl, {
    method: "POST",
    headers: {
      ...cookie(adminToken),
      Origin: "https://malicious.test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      revision: 1,
      idempotencyKey: crypto.randomUUID(),
    }),
  });
  assert.equal(csrf.status, 403);

  const extraField = await fetch(registerUrl, {
    method: "POST",
    headers: mutationHeaders(adminToken),
    body: JSON.stringify({
      revision: 1,
      idempotencyKey: crypto.randomUUID(),
      status: "ACTIVE",
    }),
  });
  assert.equal(extraField.status, 400);

  const viewer = await fetch(registerUrl, {
    method: "POST",
    headers: mutationHeaders(viewerToken),
    body: JSON.stringify({
      revision: 1,
      idempotencyKey: crypto.randomUUID(),
    }),
  });
  assert.equal(viewer.status, 403);

  const registrationKey = crypto.randomUUID();
  const body = JSON.stringify({
    revision: 1,
    idempotencyKey: registrationKey,
  });
  const registered = await fetch(registerUrl, {
    method: "POST",
    headers: mutationHeaders(adminToken),
    body,
  });
  assert.equal(registered.status, 200);
  assert.equal(registered.headers.get("cache-control"), "no-store");
  const registeredBody = await registered.json();
  assert.equal(registeredBody.status, "REGISTERED");
  assert.equal(registeredBody.revision, 2);
  assert.equal(
    registeredBody.registeredAtUtc,
    "2026-09-24T13:30:00+00:00");
  assert.ok(!("organizationId" in registeredBody));
  assert.ok(!("registrationKey" in registeredBody));
  assert.ok(!("registeredByAccountId" in registeredBody));

  const replay = await fetch(registerUrl, {
    method: "POST",
    headers: mutationHeaders(adminToken),
    body,
  });
  assert.equal(replay.status, 200);
  const replayBody = await replay.json();
  assert.equal(replayBody.status, "REGISTERED");
  assert.equal(replayBody.revision, 2);

  const registeredPage = await fetch(
    base + "/organization/programs/" + programId,
    { headers: cookie(adminToken) });
  const registeredHtml = await registeredPage.text();
  assert.match(registeredHtml, /ثبت‌شده/);
  assert.match(registeredHtml, /زمان ثبت نهایی/);
  assert.doesNotMatch(registeredHtml, /ویرایش پیش‌نویس/);
  assert.doesNotMatch(registeredHtml, /تأیید و ثبت نهایی/);

  const stale = await fetch(
    base + "/api/organization/programs/" + staleId + "/register",
    {
      method: "POST",
      headers: mutationHeaders(adminToken),
      body: JSON.stringify({
        revision: 1,
        idempotencyKey: crypto.randomUUID(),
      }),
    },
  );
  assert.equal(stale.status, 409);
  const staleBody = await stale.json();
  assert.equal(staleBody.currentRevision, 3);
  assert.equal(staleBody.currentStatus, "DRAFT");
  assert.ok(!("internal" in staleBody));

  const foreign = await fetch(
    base + "/api/organization/programs/" + foreignId + "/register",
    {
      method: "POST",
      headers: mutationHeaders(adminToken),
      body: JSON.stringify({
        revision: 1,
        idempotencyKey: crypto.randomUUID(),
      }),
    },
  );
  assert.equal(foreign.status, 404);

  console.log("Organization register UI/BFF CI: admin-only confirmation boundary, CSRF, idempotent transition, conflict and tenant 404 OK");
} finally {
  if (next?.pid) {
    try { process.kill(-next.pid, "SIGTERM"); } catch {}
  }
  if (upstream)
    await new Promise(resolve => upstream.close(resolve));
  rmSync(dir, { recursive: true, force: true });
}
