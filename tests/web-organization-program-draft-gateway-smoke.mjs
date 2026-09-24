import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:https";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const dir = mkdtempSync(join(tmpdir(), "hana-org-draft-ui-ci-"));
const cert = join(dir, "cert.pem");
const key = join(dir, "key.pem");
const orgId = "6b2bc828-cf5d-4af7-a026-a653739d8509";
const programId = "fbf47579-71b4-4b85-996c-842ac497fb12";
const foreignId = "298a02d2-9a38-41e6-9a15-65f433f5ba17";
const adminToken = "hn1_" + Buffer.alloc(32, 31).toString("base64url");
const viewerToken = "hn1_" + Buffer.alloc(32, 32).toString("base64url");
let upstream;
let next;
let logs = "";
let currentRevision = 1;
let currentName = "طرح اولیه";
const seenKeys = new Map();

function detail() {
  return {
    id: programId,
    name: currentName,
    kind: "اعتبار رفاهی",
    allocationMethod: "الگوی حنا",
    beneficiarySource: "API_OR_MANUAL",
    description: "شرح واقعی",
    status: "DRAFT",
    revision: currentRevision,
    registeredAtUtc: null,
    createdAtUtc: "2026-09-20T10:00:00+00:00",
    updatedAtUtc: "2026-09-20T10:00:00+00:00",
    organizationId: orgId,
    internalAudit: "must-not-leak",
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
          name: isAdmin ? "سازمان مدیر CI" : "سازمان مشاهده‌گر CI",
          organizationType: "سازمان حمایتگر",
          defaultAllocationMethod: "الگوی حنا",
          phone: null, email: null, address: null,
          representativeName: null, representativePhone: null,
          verified: true, active: true,
          memberRole: isAdmin ? "PORTAL_ADMIN" : "PORTAL_VIEWER",
        }));
        return;
      }

      if (req.url === "/api/v1/organization/programs" &&
        req.method === "POST") {
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
        assert.equal(body.organizationId, undefined);
        assert.equal(body.status, undefined);
        assert.equal(body.allocationMethod, undefined);
        const signature = JSON.stringify(body);
        if (seenKeys.has(idempotencyKey)) {
          if (seenKeys.get(idempotencyKey) !== signature) {
            res.writeHead(409); res.end("{}"); return;
          }
          res.writeHead(200); res.end(JSON.stringify(detail())); return;
        }
        seenKeys.set(idempotencyKey, signature);
        currentName = body.name;
        currentRevision = 1;
        res.writeHead(201); res.end(JSON.stringify(detail())); return;
      }

      if (req.url === "/api/v1/organization/programs/" + foreignId &&
        req.method === "PUT") {
        res.writeHead(404); res.end("{}"); return;
      }

      if (req.url === "/api/v1/organization/programs/" + programId) {
        if (req.method === "GET") {
          if (auth !== `Bearer ${adminToken}`) {
            res.writeHead(401); res.end("{}"); return;
          }
          res.writeHead(200); res.end(JSON.stringify(detail())); return;
        }
        if (req.method === "PUT") {
          if (auth === `Bearer ${viewerToken}`) {
            res.writeHead(403); res.end("{}"); return;
          }
          if (auth !== `Bearer ${adminToken}`) {
            res.writeHead(401); res.end("{}"); return;
          }
          const body = JSON.parse(await new Promise(resolve => {
            let raw = "";
            req.on("data", chunk => { raw += chunk; });
            req.on("end", () => resolve(raw));
          }));
          assert.equal(body.organizationId, undefined);
          assert.equal(body.status, undefined);
          if (body.revision !== currentRevision) {
            res.writeHead(409);
            res.end(JSON.stringify({ currentRevision }));
            return;
          }
          currentRevision += 1;
          currentName = body.name;
          res.writeHead(200); res.end(JSON.stringify(detail())); return;
        }
      }

      if (req.url?.startsWith("/api/v1/organization/programs") &&
        req.method === "GET") {
        if (auth !== `Bearer ${adminToken}` &&
          auth !== `Bearer ${viewerToken}`) {
          res.writeHead(401); res.end("{}"); return;
        }
        res.writeHead(200);
        res.end(JSON.stringify({
          items: [], page: 1, pageSize: 20, total: 0,
        }));
        return;
      }

      res.writeHead(404); res.end("{}");
    },
  );
  await new Promise(resolve =>
    upstream.listen(5204, "127.0.0.1", resolve));

  next = spawn("npm", [
    "run", "start", "--workspace", "@hana/web-marketplace",
    "--", "-p", "3005", "-H", "127.0.0.1",
  ], {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_EXTRA_CA_CERTS: cert,
      HANA_API_BASE_URL: "https://127.0.0.1:5204",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });
  next.stdout.on("data", part => { logs += part.toString(); });
  next.stderr.on("data", part => { logs += part.toString(); });

  const base = "http://127.0.0.1:3005";
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

  const adminNewPage = await fetch(
    base + "/organization/programs/new",
    { headers: cookie(adminToken) });
  const adminHtml = await adminNewPage.text();
  assert.match(adminHtml, /ثبت پیش‌نویس واقعی/);
  assert.match(adminHtml, /name="kind"/);

  const viewerNewPage = await fetch(
    base + "/organization/programs/new",
    { headers: cookie(viewerToken) });
  const viewerHtml = await viewerNewPage.text();
  assert.match(viewerHtml, /مجوز ثبت طرح ندارید/);
  assert.doesNotMatch(viewerHtml, /name="kind"/);

  const csrf = await fetch(base + "/api/organization/programs", {
    method: "POST",
    headers: {
      ...cookie(adminToken),
      Origin: "https://malicious.test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "x", kind: "y", beneficiarySource: "API",
      description: null, idempotencyKey: crypto.randomUUID(),
    }),
  });
  assert.equal(csrf.status, 403);

  const viewerCreate = await fetch(base + "/api/organization/programs", {
    method: "POST",
    headers: mutationHeaders(viewerToken),
    body: JSON.stringify({
      name: "طرح viewer", kind: "اعتبار",
      beneficiarySource: "API", description: null,
      idempotencyKey: crypto.randomUUID(),
    }),
  });
  assert.equal(viewerCreate.status, 403);

  const forbiddenField = await fetch(base + "/api/organization/programs", {
    method: "POST",
    headers: mutationHeaders(adminToken),
    body: JSON.stringify({
      name: "طرح", kind: "اعتبار",
      beneficiarySource: "API", description: null,
      idempotencyKey: crypto.randomUUID(), organizationId: orgId,
    }),
  });
  assert.equal(forbiddenField.status, 400);

  const keyValue = crypto.randomUUID();
  const createBody = {
    name: "طرح جدید UI",
    kind: "اعتبار رفاهی",
    beneficiarySource: "API_OR_MANUAL",
    description: "شرح واقعی",
    idempotencyKey: keyValue,
  };
  const created = await fetch(base + "/api/organization/programs", {
    method: "POST",
    headers: mutationHeaders(adminToken),
    body: JSON.stringify(createBody),
  });
  assert.equal(created.status, 201);
  const createdBody = await created.json();
  assert.equal(createdBody.id, programId);
  assert.equal(createdBody.revision, 1);
  assert.ok(!("organizationId" in createdBody));
  assert.ok(!("internalAudit" in createdBody));

  const replay = await fetch(base + "/api/organization/programs", {
    method: "POST",
    headers: mutationHeaders(adminToken),
    body: JSON.stringify(createBody),
  });
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).id, programId);

  const detailPage = await fetch(
    base + "/organization/programs/" + programId,
    { headers: cookie(adminToken) });
  const detailHtml = await detailPage.text();
  assert.match(detailHtml, /ویرایش پیش‌نویس/);
  assert.match(detailHtml, /نسخه فعلی فرم/);

  const updated = await fetch(
    base + "/api/organization/programs/" + programId,
    {
      method: "PUT",
      headers: mutationHeaders(adminToken),
      body: JSON.stringify({
        name: "طرح ویرایش‌شده",
        kind: "اعتبار رفاهی",
        beneficiarySource: "API",
        description: "شرح دوم",
        revision: 1,
      }),
    },
  );
  assert.equal(updated.status, 200);
  const updatedBody = await updated.json();
  assert.equal(updatedBody.revision, 2);
  assert.equal(updatedBody.name, "طرح ویرایش‌شده");

  // The original create request remains idempotent after later edits.
  const replayAfterEdit = await fetch(base + "/api/organization/programs", {
    method: "POST",
    headers: mutationHeaders(adminToken),
    body: JSON.stringify(createBody),
  });
  assert.equal(replayAfterEdit.status, 200);
  const replayAfterEditBody = await replayAfterEdit.json();
  assert.equal(replayAfterEditBody.id, programId);
  assert.equal(replayAfterEditBody.revision, 2);

  const stale = await fetch(
    base + "/api/organization/programs/" + programId,
    {
      method: "PUT",
      headers: mutationHeaders(adminToken),
      body: JSON.stringify({
        name: "ویرایش قدیمی",
        kind: "اعتبار رفاهی",
        beneficiarySource: "API",
        description: null,
        revision: 1,
      }),
    },
  );
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).currentRevision, 2);

  const foreign = await fetch(
    base + "/api/organization/programs/" + foreignId,
    {
      method: "PUT",
      headers: mutationHeaders(adminToken),
      body: JSON.stringify({
        name: "x", kind: "y",
        beneficiarySource: "MANUAL",
        description: null, revision: 1,
      }),
    },
  );
  assert.equal(foreign.status, 404);

  console.log("Organization draft UI/BFF CI: admin gating, CSRF, idempotent create, safe edit and revision conflict OK");
} finally {
  if (next?.pid) {
    try { process.kill(-next.pid, "SIGTERM"); } catch {}
  }
  if (upstream)
    await new Promise(resolve => upstream.close(resolve));
  rmSync(dir, { recursive: true, force: true });
}
