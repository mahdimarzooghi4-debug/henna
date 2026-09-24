import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:https";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const dir = mkdtempSync(join(tmpdir(), "hana-org-recipient-create-ui-ci-"));
const cert = join(dir, "cert.pem");
const key = join(dir, "key.pem");

const orgId = "6b2bc828-cf5d-4af7-a026-a653739d8509";
const registeredId = "fbf47579-71b4-4b85-996c-842ac497fb12";
const activeId = "18752a31-1df4-4b79-a4bd-c6cf91fd9b25";
const draftId = "298a02d2-9a38-41e6-9a15-65f433f5ba17";
const pausedId = "4e4d3ef2-38bc-48fd-a559-154948b24472";
const foreignId = "96f7c0be-87e1-413a-ad86-aa0051ba4d6a";
const duplicateRecipientId = "0aa13c0f-ccce-40da-bf94-fddb51c467ef";
const createdRecipientId = "3364265e-03b6-497e-aad4-b57a971174e1";
const matchedAccountId = "7af6dc88-eb1c-42d7-ac08-1c60bf3a48ce";

const adminToken = "hn1_" + Buffer.alloc(32, 61).toString("base64url");
const viewerToken = "hn1_" + Buffer.alloc(32, 62).toString("base64url");

let upstream;
let next;
let logs = "";
let recipientPostCount = 0;
const accepted = new Map();

const programs = {
  REGISTERED: [{
    id: registeredId,
    name: "طرح ثبت‌شده واقعی",
    kind: "اعتبار رفاهی",
    allocationMethod: "الگوی حنا",
    beneficiarySource: "API_OR_MANUAL",
    status: "REGISTERED",
    createdAtUtc: "2026-09-20T10:00:00+00:00",
    updatedAtUtc: "2026-09-24T13:00:00+00:00",
  }],
  ACTIVE: [{
    id: activeId,
    name: "طرح فعال واقعی",
    kind: "اعتبار رفاهی",
    allocationMethod: "الگوی حنا",
    beneficiarySource: "API_OR_MANUAL",
    status: "ACTIVE",
    createdAtUtc: "2026-09-18T10:00:00+00:00",
    updatedAtUtc: "2026-09-24T12:00:00+00:00",
  }],
  DRAFT: [{
    id: draftId,
    name: "طرح پیش‌نویس نباید نمایش داده شود",
    kind: "اعتبار رفاهی",
    allocationMethod: "الگوی حنا",
    beneficiarySource: "API_OR_MANUAL",
    status: "DRAFT",
    createdAtUtc: "2026-09-24T10:00:00+00:00",
    updatedAtUtc: "2026-09-24T10:00:00+00:00",
  }],
};

function profile(role) {
  return {
    organizationId: orgId,
    name: "سازمان ثبت مشمول CI",
    organizationType: "سازمان حمایتگر",
    defaultAllocationMethod: "الگوی حنا",
    phone: null,
    email: null,
    address: null,
    representativeName: null,
    representativePhone: null,
    verified: true,
    active: true,
    memberRole: role,
  };
}

function recipient(body, programStatus = "ACTIVE") {
  const programName = body.programId === registeredId
    ? "طرح ثبت‌شده واقعی"
    : "طرح فعال واقعی";
  const hasMatch = Boolean(body.phone);
  return {
    id: createdRecipientId,
    displayName: body.displayName,
    referenceMasked: "EMP****001",
    source: "MANUAL",
    matchStatus: hasMatch ? "MATCHED" : "NEEDS_MATCH",
    hanaAccountMatched: hasMatch,
    program: {
      id: body.programId,
      name: programName,
      status: programStatus,
    },
    createdAtUtc: "2026-09-24T14:25:00+00:00",
    updatedAtUtc: "2026-09-24T14:25:00+00:00",

    // Deliberate upstream-only data. The Next BFF must discard all of it.
    organizationId: orgId,
    externalReference: body.externalReference,
    phone: body.phone,
    matchedAccountId: hasMatch ? matchedAccountId : null,
    referenceFingerprint: "a".repeat(64),
    creationFingerprint: "b".repeat(64),
    creationKey: "must-not-leak",
    createdByAccountId: matchedAccountId,
    allocationStatus: "MUST_NOT_LEAK",
    usageStatus: "MUST_NOT_LEAK",
  };
}

async function readBody(req) {
  return JSON.parse(await new Promise(resolve => {
    let raw = "";
    req.on("data", chunk => { raw += chunk; });
    req.on("end", () => resolve(raw));
  }));
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
      const url = new URL(req.url, "https://127.0.0.1:5207");

      if (url.pathname === "/api/v1/organization/me") {
        if (auth === `Bearer ${adminToken}`) {
          res.writeHead(200);
          res.end(JSON.stringify(profile("PORTAL_ADMIN")));
          return;
        }
        if (auth === `Bearer ${viewerToken}`) {
          res.writeHead(200);
          res.end(JSON.stringify(profile("PORTAL_VIEWER")));
          return;
        }
        res.writeHead(401); res.end("{}"); return;
      }

      if (url.pathname === "/api/v1/organization/programs" &&
        req.method === "GET") {
        if (auth !== `Bearer ${adminToken}` &&
          auth !== `Bearer ${viewerToken}`) {
          res.writeHead(401); res.end("{}"); return;
        }
        const status = url.searchParams.get("status");
        const page = Number(url.searchParams.get("page") ?? "1");
        const pageSize = Number(url.searchParams.get("pageSize") ?? "20");
        const items = programs[status] ?? [];
        res.writeHead(200);
        res.end(JSON.stringify({
          items,
          page,
          pageSize,
          total: items.length,
          internal: "MUST_NOT_LEAK",
        }));
        return;
      }

      if (url.pathname === "/api/v1/organization/recipients" &&
        req.method === "GET") {
        if (auth !== `Bearer ${adminToken}` &&
          auth !== `Bearer ${viewerToken}`) {
          res.writeHead(401); res.end("{}"); return;
        }
        res.writeHead(200);
        res.end(JSON.stringify({
          items: [],
          page: Number(url.searchParams.get("page") ?? "1"),
          pageSize: Number(url.searchParams.get("pageSize") ?? "20"),
          total: 0,
        }));
        return;
      }

      if (url.pathname === "/api/v1/organization/recipients" &&
        req.method === "POST") {
        recipientPostCount += 1;
        if (auth === `Bearer ${viewerToken}`) {
          res.writeHead(403); res.end("{}"); return;
        }
        if (auth !== `Bearer ${adminToken}`) {
          res.writeHead(401); res.end("{}"); return;
        }

        const idempotencyKey = req.headers["idempotency-key"];
        assert.equal(typeof idempotencyKey, "string");
        const body = await readBody(req);
        assert.deepEqual(
          Object.keys(body).sort(),
          ["displayName", "externalReference", "phone", "programId"].sort(),
        );
        assert.ok(!("organizationId" in body));
        assert.ok(!("matchStatus" in body));
        assert.ok(!("source" in body));

        if (body.programId === foreignId) {
          res.writeHead(404); res.end("{}"); return;
        }
        if (body.programId === pausedId) {
          res.writeHead(409);
          res.end(JSON.stringify({
            currentStatus: "PAUSED",
            internal: "MUST_NOT_LEAK",
          }));
          return;
        }
        if (body.externalReference === "DUP-1") {
          res.writeHead(409);
          res.end(JSON.stringify({
            existingRecipientId: duplicateRecipientId,
            referenceFingerprint: "MUST_NOT_LEAK",
          }));
          return;
        }

        const fingerprint = JSON.stringify(body);
        if (accepted.has(idempotencyKey)) {
          const prior = accepted.get(idempotencyKey);
          if (prior.fingerprint !== fingerprint) {
            res.writeHead(409);
            res.end(JSON.stringify({ internal: "MUST_NOT_LEAK" }));
            return;
          }
          res.writeHead(200);
          res.end(JSON.stringify(prior.recipient));
          return;
        }

        const created = recipient(body);
        accepted.set(idempotencyKey, { fingerprint, recipient: created });
        res.writeHead(201);
        res.end(JSON.stringify(created));
        return;
      }

      res.writeHead(404); res.end("{}");
    },
  );
  await new Promise(resolve =>
    upstream.listen(5207, "127.0.0.1", resolve));

  next = spawn("npm", [
    "run", "start", "--workspace", "@hana/web-marketplace",
    "--", "-p", "3008", "-H", "127.0.0.1",
  ], {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_EXTRA_CA_CERTS: cert,
      HANA_API_BASE_URL: "https://127.0.0.1:5207",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });
  next.stdout.on("data", part => { logs += part.toString(); });
  next.stderr.on("data", part => { logs += part.toString(); });

  const base = "http://127.0.0.1:3008";
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

  const adminPage = await fetch(base + "/organization/people/add", {
    headers: cookie(adminToken),
  });
  assert.equal(adminPage.status, 200);
  const adminHtml = await adminPage.text();
  assert.match(adminHtml, /ثبت و افزودن دستی مشمولان/);
  assert.match(adminHtml, /ثبت گروهی افراد \(فایل اکسل \/ CSV\)/);
  assert.match(adminHtml, /افزودن انفرادی مشمول جدید/);
  assert.match(adminHtml, /مثال: محمد امینی/);
  assert.match(adminHtml, /شناسه موردنیاز سازمان/);
  assert.match(adminHtml, /شماره تلفن همراه \(جهت تطبیق حساب کاربری\)/);
  assert.match(adminHtml, /طرح ثبت‌شده واقعی/);
  assert.match(adminHtml, /طرح فعال واقعی/);
  assert.doesNotMatch(adminHtml, /طرح پیش‌نویس نباید نمایش داده شود/);
  assert.match(adminHtml, /ثبت گروهی در Backend 042 فعال نشده/);

  const viewerPage = await fetch(base + "/organization/people/add", {
    headers: cookie(viewerToken),
  });
  assert.equal(viewerPage.status, 200);
  const viewerHtml = await viewerPage.text();
  assert.match(viewerHtml, /مجوز افزودن مشمول فعال نیست/);
  assert.doesNotMatch(viewerHtml, /مثال: محمد امینی/);

  const adminList = await fetch(base + "/organization/people", {
    headers: cookie(adminToken),
  });
  const adminListHtml = await adminList.text();
  assert.match(adminListHtml, /\/organization\/people\/add/);

  const viewerList = await fetch(base + "/organization/people", {
    headers: cookie(viewerToken),
  });
  const viewerListHtml = await viewerList.text();
  assert.doesNotMatch(viewerListHtml, /\/organization\/people\/add/);

  const createUrl = base + "/api/organization/recipients";
  const payload = {
    displayName: "فرد جدید CI",
    externalReference: "EMP-RAW-001",
    phone: "09121112233",
    programId: activeId,
    idempotencyKey: crypto.randomUUID(),
  };

  const beforeCsrf = recipientPostCount;
  const csrf = await fetch(createUrl, {
    method: "POST",
    headers: {
      ...cookie(adminToken),
      Origin: "https://malicious.test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  assert.equal(csrf.status, 403);
  assert.equal(recipientPostCount, beforeCsrf);

  const beforeExtra = recipientPostCount;
  const extra = await fetch(createUrl, {
    method: "POST",
    headers: mutationHeaders(adminToken),
    body: JSON.stringify({
      ...payload,
      organizationId: orgId,
    }),
  });
  assert.equal(extra.status, 400);
  assert.equal(recipientPostCount, beforeExtra);

  const missingKey = await fetch(createUrl, {
    method: "POST",
    headers: mutationHeaders(adminToken),
    body: JSON.stringify({
      displayName: payload.displayName,
      externalReference: payload.externalReference,
      phone: payload.phone,
      programId: payload.programId,
    }),
  });
  assert.equal(missingKey.status, 400);

  const viewer = await fetch(createUrl, {
    method: "POST",
    headers: mutationHeaders(viewerToken),
    body: JSON.stringify(payload),
  });
  assert.equal(viewer.status, 403);

  const created = await fetch(createUrl, {
    method: "POST",
    headers: mutationHeaders(adminToken),
    body: JSON.stringify(payload),
  });
  assert.equal(created.status, 201);
  assert.equal(created.headers.get("cache-control"), "no-store");
  const createdText = await created.text();
  const createdBody = JSON.parse(createdText);
  assert.equal(createdBody.id, createdRecipientId);
  assert.equal(createdBody.displayName, "فرد جدید CI");
  assert.equal(createdBody.referenceMasked, "EMP****001");
  assert.equal(createdBody.matchStatus, "MATCHED");
  assert.equal(createdBody.hanaAccountMatched, true);
  assert.equal(createdBody.program.id, activeId);
  assert.ok(!createdText.includes("EMP-RAW-001"));
  assert.ok(!createdText.includes("09121112233"));
  assert.ok(!createdText.includes(orgId));
  assert.ok(!createdText.includes(matchedAccountId));
  assert.ok(!createdText.includes("referenceFingerprint"));
  assert.ok(!createdText.includes("creationFingerprint"));
  assert.ok(!createdText.includes("creationKey"));
  assert.ok(!createdText.includes("createdByAccountId"));
  assert.ok(!createdText.includes("allocationStatus"));
  assert.ok(!createdText.includes("usageStatus"));
  assert.ok(!createdText.includes("MUST_NOT_LEAK"));
  assert.deepEqual(
    Object.keys(createdBody).sort(),
    [
      "createdAtUtc",
      "displayName",
      "hanaAccountMatched",
      "id",
      "matchStatus",
      "program",
      "referenceMasked",
      "source",
      "updatedAtUtc",
    ].sort(),
  );

  const replay = await fetch(createUrl, {
    method: "POST",
    headers: mutationHeaders(adminToken),
    body: JSON.stringify(payload),
  });
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).id, createdRecipientId);

  const changedSameKey = await fetch(createUrl, {
    method: "POST",
    headers: mutationHeaders(adminToken),
    body: JSON.stringify({
      ...payload,
      displayName: "نام تغییرکرده",
    }),
  });
  assert.equal(changedSameKey.status, 409);
  const changedText = await changedSameKey.text();
  assert.ok(!changedText.includes("MUST_NOT_LEAK"));

  const duplicate = await fetch(createUrl, {
    method: "POST",
    headers: mutationHeaders(adminToken),
    body: JSON.stringify({
      ...payload,
      externalReference: "DUP-1",
      idempotencyKey: crypto.randomUUID(),
    }),
  });
  assert.equal(duplicate.status, 409);
  const duplicateText = await duplicate.text();
  const duplicateBody = JSON.parse(duplicateText);
  assert.equal(duplicateBody.existingRecipientId, duplicateRecipientId);
  assert.ok(!duplicateText.includes("referenceFingerprint"));
  assert.ok(!duplicateText.includes("MUST_NOT_LEAK"));

  const paused = await fetch(createUrl, {
    method: "POST",
    headers: mutationHeaders(adminToken),
    body: JSON.stringify({
      ...payload,
      programId: pausedId,
      idempotencyKey: crypto.randomUUID(),
    }),
  });
  assert.equal(paused.status, 409);
  const pausedText = await paused.text();
  const pausedBody = JSON.parse(pausedText);
  assert.equal(pausedBody.currentStatus, "PAUSED");
  assert.ok(!pausedText.includes("MUST_NOT_LEAK"));

  const foreign = await fetch(createUrl, {
    method: "POST",
    headers: mutationHeaders(adminToken),
    body: JSON.stringify({
      ...payload,
      programId: foreignId,
      idempotencyKey: crypto.randomUUID(),
    }),
  });
  assert.equal(foreign.status, 404);

  console.log("Organization recipient create UI/BFF CI: admin form, eligible programs, CSRF, idempotency, conflicts and privacy allowlist OK");
} finally {
  if (next?.pid) {
    try { process.kill(-next.pid, "SIGTERM"); } catch {}
  }
  if (upstream)
    await new Promise(resolve => upstream.close(resolve));
  rmSync(dir, { recursive: true, force: true });
}
