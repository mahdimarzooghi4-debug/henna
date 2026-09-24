import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:https";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const dir = mkdtempSync(join(tmpdir(), "hana-org-recipient-bulk-ui-ci-"));
const cert = join(dir, "cert.pem");
const key = join(dir, "key.pem");

const orgId = "1ce80f46-2d77-4aa5-8c13-4995461ce030";
const registeredId = "36ac6ed2-7520-4bea-8f75-b96c5e8cfe31";
const activeId = "2ffbd0f4-111a-4dcb-9e98-960d9306af05";
const pausedId = "26a3e17c-88e2-4312-9aca-80501e99a3b5";
const rowOneId = "be6a3b31-e7d8-42a4-94f8-60981876a2ed";
const rowTwoId = "24870e7d-42a0-4d97-a1b6-3e4fae431fc8";
const matchedAccountId = "bcf2ee38-b35a-4467-9300-da0388454974";

const adminToken = "hn1_" + Buffer.alloc(32, 71).toString("base64url");
const viewerToken = "hn1_" + Buffer.alloc(32, 72).toString("base64url");

let upstream;
let next;
let logs = "";
let importPostCount = 0;
const accepted = new Map();

const programs = {
  REGISTERED: [{
    id: registeredId,
    name: "طرح ثبت‌شده گروهی",
    kind: "اعتبار رفاهی",
    allocationMethod: "الگوی حنا",
    beneficiarySource: "API_OR_MANUAL",
    status: "REGISTERED",
    createdAtUtc: "2026-09-20T10:00:00+00:00",
    updatedAtUtc: "2026-09-24T13:00:00+00:00",
  }],
  ACTIVE: [{
    id: activeId,
    name: "طرح فعال گروهی",
    kind: "اعتبار رفاهی",
    allocationMethod: "الگوی حنا",
    beneficiarySource: "API_OR_MANUAL",
    status: "ACTIVE",
    createdAtUtc: "2026-09-18T10:00:00+00:00",
    updatedAtUtc: "2026-09-24T12:00:00+00:00",
  }],
};

function profile(role) {
  return {
    organizationId: orgId,
    name: "سازمان import گروهی CI",
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

function recipient(id, displayName, masked, matched) {
  return {
    id,
    displayName,
    referenceMasked: masked,
    source: "MANUAL",
    matchStatus: matched ? "MATCHED" : "NEEDS_MATCH",
    hanaAccountMatched: matched,
    program: {
      id: activeId,
      name: "طرح فعال گروهی",
      status: "ACTIVE",
    },
    createdAtUtc: "2026-09-24T15:00:00+00:00",
    updatedAtUtc: "2026-09-24T15:00:00+00:00",

    // Upstream-only fields that must never reach the browser.
    organizationId: orgId,
    externalReference: matched ? "RAW-BULK-001" : "RAW-BULK-002",
    phone: matched ? "09121112233" : null,
    matchedAccountId: matched ? matchedAccountId : null,
    referenceFingerprint: "a".repeat(64),
    creationFingerprint: "b".repeat(64),
    creationKey: "MUST_NOT_LEAK",
    createdByAccountId: matchedAccountId,
    allocationStatus: "MUST_NOT_LEAK",
    usageStatus: "MUST_NOT_LEAK",
  };
}

function successResult() {
  return {
    importedCount: 2,
    matchedCount: 1,
    needsMatchCount: 1,
    atomic: true,
    items: [
      { row: 2, recipient: recipient(rowOneId, "فرد گروهی اول", "BUL****001", true) },
      { row: 3, recipient: recipient(rowTwoId, "فرد گروهی دوم", "BUL****002", false) },
    ],
    importedAtUtc: "2026-09-24T15:00:00+00:00",

    batchFingerprint: "c".repeat(64),
    importKey: "MUST_NOT_LEAK",
    tenantId: orgId,
  };
}

async function rawRequestBody(req) {
  return await new Promise(resolve => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
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
      const url = new URL(req.url, "https://127.0.0.1:5208");

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
        }));
        return;
      }

      if (url.pathname === "/api/v1/organization/recipients/import" &&
        req.method === "POST") {
        importPostCount += 1;
        if (auth === `Bearer ${viewerToken}`) {
          res.writeHead(403); res.end("{}"); return;
        }
        if (auth !== `Bearer ${adminToken}`) {
          res.writeHead(401); res.end("{}"); return;
        }

        assert.match(
          req.headers["content-type"] ?? "",
          /^multipart\/form-data; boundary=/,
        );
        const idempotencyKey = req.headers["idempotency-key"];
        assert.equal(typeof idempotencyKey, "string");

        const body = await rawRequestBody(req);
        const textBody = body.toString("utf8");
        assert.match(textBody, /name="programId"/);
        assert.match(textBody, /name="file"; filename="[^"]+\.csv"/);
        assert.ok(!textBody.includes('name="idempotencyKey"'));
        assert.ok(!textBody.includes("__Host-hana_session"));

        if (textBody.includes(pausedId)) {
          res.writeHead(409);
          res.end(JSON.stringify({
            importedCount: 0,
            atomic: true,
            message: "state changed",
            currentStatus: "PAUSED",
            internal: "MUST_NOT_LEAK",
          }));
          return;
        }

        if (textBody.includes("BAD-ROW")) {
          res.writeHead(422);
          res.end(JSON.stringify({
            importedCount: 0,
            atomic: true,
            errors: [{
              row: 3,
              field: "phone",
              code: "INVALID_PHONE",
              message: "شماره خام 09129999999 برای BAD-ROW معتبر نیست.",
              rawPhone: "123",
              rawReference: "BAD-ROW",
            }],
            internal: "MUST_NOT_LEAK",
          }));
          return;
        }

        if (textBody.includes("DUPLICATE-BULK")) {
          res.writeHead(409);
          res.end(JSON.stringify({
            importedCount: 0,
            atomic: true,
            errors: [{
              row: 2,
              field: "externalReference",
              code: "DUPLICATE_EXISTING",
              message: "شناسه خام DUPLICATE-BULK قبلاً ثبت شده است.",
              existingRecipientId: rowOneId,
              referenceFingerprint: "MUST_NOT_LEAK",
            }],
          }));
          return;
        }

        assert.ok(
          textBody.includes(activeId) ||
          textBody.includes(registeredId),
        );
        assert.ok(textBody.includes("displayName,externalReference,phone"));

        const fingerprint =
          textBody.replace(/------formdata-undici-[^\r\n]+/g, "BOUNDARY");
        if (accepted.has(idempotencyKey)) {
          const prior = accepted.get(idempotencyKey);
          if (prior !== fingerprint) {
            res.writeHead(409);
            res.end(JSON.stringify({
              importedCount: 0,
              atomic: true,
              message: "key conflict",
              internal: "MUST_NOT_LEAK",
            }));
            return;
          }
          res.writeHead(200);
          res.end(JSON.stringify(successResult()));
          return;
        }

        accepted.set(idempotencyKey, fingerprint);
        res.writeHead(201);
        res.end(JSON.stringify(successResult()));
        return;
      }

      res.writeHead(404); res.end("{}");
    },
  );
  await new Promise(resolve =>
    upstream.listen(5208, "127.0.0.1", resolve));

  next = spawn("npm", [
    "run", "start", "--workspace", "@hana/web-marketplace",
    "--", "-p", "3009", "-H", "127.0.0.1",
  ], {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_EXTRA_CA_CERTS: cert,
      HANA_API_BASE_URL: "https://127.0.0.1:5208",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });
  next.stdout.on("data", part => { logs += part.toString(); });
  next.stderr.on("data", part => { logs += part.toString(); });

  const base = "http://127.0.0.1:3009";
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

  const adminPage = await fetch(base + "/organization/people/add", {
    headers: cookie(adminToken),
  });
  assert.equal(adminPage.status, 200);
  const html = await adminPage.text();
  assert.match(html, /ثبت گروهی افراد \(فایل اکسل \/ CSV\)/);
  assert.match(html, /فایل اکسل یا CSV را به اینجا بکشید یا انتخاب کنید/);
  assert.match(html, /حداکثر ۲ مگابایت و ۵۰۰ ردیف داده/);
  assert.match(html, /دانلود نمونه قالب فایل/);
  assert.match(html, /افزودن گروهی/);
  assert.match(html, /\/organization-upload\.png/);
  assert.match(html, /طرح ثبت‌شده گروهی/);
  assert.match(html, /طرح فعال گروهی/);
  assert.doesNotMatch(html, /ثبت گروهی در Backend 042 فعال نشده/);
  assert.doesNotMatch(html, /disabled=""[^>]*type="file"/);

  const viewerPage = await fetch(base + "/organization/people/add", {
    headers: cookie(viewerToken),
  });
  const viewerHtml = await viewerPage.text();
  assert.match(viewerHtml, /مجوز افزودن مشمول فعال نیست/);
  assert.doesNotMatch(viewerHtml, /org-bulk-import-form/);

  const template = await fetch(
    base + "/api/organization/recipients/import",
  );
  assert.equal(template.status, 200);
  assert.match(
    template.headers.get("content-type") ?? "",
    /^text\/csv;/,
  );
  assert.match(
    template.headers.get("content-disposition") ?? "",
    /hana-recipient-import-template\.csv/,
  );
  const templateBytes = Buffer.from(await template.arrayBuffer());
  assert.deepEqual([...templateBytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  const templateText = templateBytes.subarray(3).toString("utf8");
  assert.equal(
    templateText,
    "نام و عنوان نمایشی,شناسه موردنیاز سازمان,شماره همراه در صورت نیاز\r\n",
  );

  const importUrl = base + "/api/organization/recipients/import";
  const makeForm = ({
    programId = activeId,
    content = "displayName,externalReference,phone\nفرد اول,BULK-001,\nفرد دوم,BULK-002,\n",
    fileName = "people.csv",
    idempotencyKey = crypto.randomUUID(),
    extra = false,
  } = {}) => {
    const form = new FormData();
    form.set("programId", programId);
    form.set("file", new Blob([content], { type: "text/csv" }), fileName);
    form.set("idempotencyKey", idempotencyKey);
    if (extra) form.set("organizationId", orgId);
    return form;
  };

  const beforeCsrf = importPostCount;
  const csrf = await fetch(importUrl, {
    method: "POST",
    headers: {
      ...cookie(adminToken),
      Origin: "https://malicious.test",
    },
    body: makeForm(),
  });
  assert.equal(csrf.status, 403);
  assert.equal(importPostCount, beforeCsrf);

  const beforeExtra = importPostCount;
  const extra = await fetch(importUrl, {
    method: "POST",
    headers: {
      ...cookie(adminToken),
      Origin: base,
    },
    body: makeForm({ extra: true }),
  });
  assert.equal(extra.status, 400);
  assert.equal(importPostCount, beforeExtra);

  const unsupported = await fetch(importUrl, {
    method: "POST",
    headers: {
      ...cookie(adminToken),
      Origin: base,
    },
    body: makeForm({ fileName: "people.txt" }),
  });
  assert.equal(unsupported.status, 415);

  const viewer = await fetch(importUrl, {
    method: "POST",
    headers: {
      ...cookie(viewerToken),
      Origin: base,
    },
    body: makeForm(),
  });
  assert.equal(viewer.status, 403);

  const keyOne = crypto.randomUUID();
  const validContent =
    "displayName,externalReference,phone\nفرد اول,BULK-001,09121112233\nفرد دوم,BULK-002,\n";
  const created = await fetch(importUrl, {
    method: "POST",
    headers: {
      ...cookie(adminToken),
      Origin: base,
    },
    body: makeForm({
      content: validContent,
      idempotencyKey: keyOne,
    }),
  });
  assert.equal(created.status, 201);
  assert.equal(created.headers.get("cache-control"), "no-store");
  const createdText = await created.text();
  const createdBody = JSON.parse(createdText);
  assert.deepEqual(
    Object.keys(createdBody).sort(),
    [
      "atomic",
      "importedAtUtc",
      "importedCount",
      "matchedCount",
      "needsMatchCount",
    ].sort(),
  );
  assert.equal(createdBody.importedCount, 2);
  assert.equal(createdBody.matchedCount, 1);
  assert.equal(createdBody.needsMatchCount, 1);
  assert.equal(createdBody.atomic, true);
  for (const secret of [
    "RAW-BULK-001",
    "RAW-BULK-002",
    "09121112233",
    orgId,
    matchedAccountId,
    "referenceFingerprint",
    "creationFingerprint",
    "creationKey",
    "createdByAccountId",
    "batchFingerprint",
    "importKey",
    "items",
    "allocationStatus",
    "usageStatus",
    "MUST_NOT_LEAK",
  ])
    assert.ok(!createdText.includes(secret), secret + " leaked");

  const replay = await fetch(importUrl, {
    method: "POST",
    headers: {
      ...cookie(adminToken),
      Origin: base,
    },
    body: makeForm({
      content: validContent,
      idempotencyKey: keyOne,
    }),
  });
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).importedCount, 2);

  const invalid = await fetch(importUrl, {
    method: "POST",
    headers: {
      ...cookie(adminToken),
      Origin: base,
    },
    body: makeForm({
      content:
        "displayName,externalReference,phone\nفرد سالم,GOOD-ROW,\nفرد خراب,BAD-ROW,123\n",
    }),
  });
  assert.equal(invalid.status, 422);
  const invalidText = await invalid.text();
  const invalidBody = JSON.parse(invalidText);
  assert.equal(invalidBody.importedCount, 0);
  assert.equal(invalidBody.atomic, true);
  assert.deepEqual(
    Object.keys(invalidBody.errors[0]).sort(),
    ["code", "field", "message", "row"].sort(),
  );
  assert.ok(!invalidText.includes("BAD-ROW"));
  assert.ok(!invalidText.includes("09129999999"));
  assert.ok(!invalidText.includes("rawPhone"));
  assert.ok(!invalidText.includes("MUST_NOT_LEAK"));

  const duplicate = await fetch(importUrl, {
    method: "POST",
    headers: {
      ...cookie(adminToken),
      Origin: base,
    },
    body: makeForm({
      content:
        "displayName,externalReference,phone\nتکراری,DUPLICATE-BULK,\n",
    }),
  });
  assert.equal(duplicate.status, 409);
  const duplicateText = await duplicate.text();
  const duplicateBody = JSON.parse(duplicateText);
  assert.equal(duplicateBody.errors[0].code, "DUPLICATE_EXISTING");
  assert.ok(!duplicateText.includes("DUPLICATE-BULK"));
  assert.ok(!duplicateText.includes("existingRecipientId"));
  assert.ok(!duplicateText.includes("referenceFingerprint"));

  const paused = await fetch(importUrl, {
    method: "POST",
    headers: {
      ...cookie(adminToken),
      Origin: base,
    },
    body: makeForm({ programId: pausedId }),
  });
  assert.equal(paused.status, 409);
  const pausedText = await paused.text();
  const pausedBody = JSON.parse(pausedText);
  assert.equal(pausedBody.currentStatus, "PAUSED");
  assert.ok(!pausedText.includes("MUST_NOT_LEAK"));

  console.log(
    "Organization recipient bulk UI/BFF CI: template, Figma card, multipart allowlist, idempotency, atomic errors and privacy OK",
  );
} finally {
  if (next?.pid) {
    try { process.kill(-next.pid, "SIGTERM"); } catch {}
  }
  if (upstream)
    await new Promise(resolve => upstream.close(resolve));
  rmSync(dir, { recursive: true, force: true });
}
