import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:https";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const dir = mkdtempSync(join(tmpdir(), "hana-org-recipients-ui-ci-"));
const cert = join(dir, "cert.pem");
const key = join(dir, "key.pem");
const orgId = "6b2bc828-cf5d-4af7-a026-a653739d8509";
const programId = "fbf47579-71b4-4b85-996c-842ac497fb12";
const secondProgramId = "18752a31-1df4-4b79-a4bd-c6cf91fd9b25";
const matchedAccountId = "298a02d2-9a38-41e6-9a15-65f433f5ba17";
const memberToken = "hn1_" + Buffer.alloc(32, 51).toString("base64url");
const outsiderToken = "hn1_" + Buffer.alloc(32, 52).toString("base64url");
let upstream;
let next;
let logs = "";
let recipientRequests = 0;

const recipients = [
  {
    id: "4e4d3ef2-38bc-48fd-a559-154948b24472",
    displayName: "فرد واقعی یک",
    referenceMasked: "۰۰۲****۳۲۱",
    source: "API",
    matchStatus: "MATCHED",
    hanaAccountMatched: true,
    program: {
      id: programId,
      name: "طرح سلامت کارکنان",
      status: "REGISTERED",
    },
    createdAtUtc: "2026-09-24T12:00:00+00:00",
    updatedAtUtc: "2026-09-24T12:00:00+00:00",
    organizationId: orgId,
    matchedAccountId,
    allocationStatus: "MUST_NOT_LEAK",
    usageStatus: "MUST_NOT_LEAK",
  },
  {
    id: "96f7c0be-87e1-413a-ad86-aa0051ba4d6a",
    displayName: "فرد واقعی دو",
    referenceMasked: "۱۲۸****۸۹۰",
    source: "MANUAL",
    matchStatus: "NEEDS_MATCH",
    hanaAccountMatched: false,
    program: {
      id: secondProgramId,
      name: "طرح رفاهی ثبت‌شده",
      status: "REGISTERED",
    },
    createdAtUtc: "2026-09-24T12:05:00+00:00",
    updatedAtUtc: "2026-09-24T12:05:00+00:00",
    organizationId: orgId,
    matchedAccountId: null,
    allocationStatus: "MUST_NOT_LEAK",
    usageStatus: "MUST_NOT_LEAK",
  },
];

function profile() {
  return {
    organizationId: orgId,
    name: "سازمان مشمولان CI",
    organizationType: "سازمان حمایتگر",
    defaultAllocationMethod: "الگوی حنا",
    phone: null,
    email: null,
    address: null,
    representativeName: null,
    representativePhone: null,
    verified: true,
    active: true,
    memberRole: "PORTAL_VIEWER",
  };
}

function applyQuery(url) {
  let items = [...recipients];
  const source = url.searchParams.get("source");
  const matchStatus = url.searchParams.get("matchStatus");
  const selectedProgram = url.searchParams.get("programId");
  const search = url.searchParams.get("search");
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "20");

  if (source) items = items.filter(item => item.source === source);
  if (matchStatus)
    items = items.filter(item => item.matchStatus === matchStatus);
  if (selectedProgram)
    items = items.filter(item => item.program.id === selectedProgram);
  if (search)
    items = items.filter(item =>
      item.displayName.includes(search) ||
      item.referenceMasked.includes(search));

  const total = items.length;
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    total,
    internal: "MUST_NOT_LEAK",
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
    (req, res) => {
      assert.equal(req.headers.cookie, undefined);
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      const auth = req.headers.authorization;

      if (req.url === "/api/v1/organization/me") {
        if (auth === `Bearer ${memberToken}`) {
          res.writeHead(200);
          res.end(JSON.stringify(profile()));
          return;
        }
        if (auth === `Bearer ${outsiderToken}`) {
          res.writeHead(403); res.end("{}"); return;
        }
        res.writeHead(401); res.end("{}"); return;
      }

      if (req.url?.startsWith("/api/v1/organization/recipients")) {
        recipientRequests += 1;
        if (auth === `Bearer ${outsiderToken}`) {
          res.writeHead(403); res.end("{}"); return;
        }
        if (auth !== `Bearer ${memberToken}`) {
          res.writeHead(401); res.end("{}"); return;
        }
        const url = new URL(req.url, "https://127.0.0.1:5206");
        res.writeHead(200);
        res.end(JSON.stringify(applyQuery(url)));
        return;
      }

      res.writeHead(404); res.end("{}");
    },
  );
  await new Promise(resolve =>
    upstream.listen(5206, "127.0.0.1", resolve));

  next = spawn("npm", [
    "run", "start", "--workspace", "@hana/web-marketplace",
    "--", "-p", "3007", "-H", "127.0.0.1",
  ], {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_EXTRA_CA_CERTS: cert,
      HANA_API_BASE_URL: "https://127.0.0.1:5206",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });
  next.stdout.on("data", part => { logs += part.toString(); });
  next.stderr.on("data", part => { logs += part.toString(); });

  const base = "http://127.0.0.1:3007";
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

  const page = await fetch(base + "/organization/people", {
    headers: cookie(memberToken),
  });
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /فرد واقعی یک/);
  assert.match(html, /فرد واقعی دو/);
  assert.match(html, /حساب حنا شناسایی شده/);
  assert.match(html, /نیازمند تطبیق/);
  assert.match(html, /هنوز متصل نشده/);
  assert.match(html, /ثبت فرد در منبع داده سازمان به معنای تخصیص اعتبار نیست/);
  assert.doesNotMatch(html, /فرد نمونه/);
  assert.doesNotMatch(html, /تخصیص‌یافته/);
  assert.doesNotMatch(html, /استفاده شده/);
  assert.doesNotMatch(html, new RegExp(matchedAccountId));
  assert.doesNotMatch(html, /MUST_NOT_LEAK/);

  const filteredPage = await fetch(
    base + "/organization/people?source=MANUAL&matchStatus=NEEDS_MATCH",
    { headers: cookie(memberToken) },
  );
  assert.equal(filteredPage.status, 200);
  const filteredHtml = await filteredPage.text();
  assert.match(filteredHtml, /فرد واقعی دو/);
  assert.doesNotMatch(filteredHtml, /فرد واقعی یک/);

  const api = await fetch(
    base + "/api/organization/recipients?search=" +
      encodeURIComponent("۳۲۱"),
    { headers: cookie(memberToken) },
  );
  assert.equal(api.status, 200);
  assert.equal(api.headers.get("cache-control"), "no-store");
  const apiText = await api.text();
  const apiBody = JSON.parse(apiText);
  assert.equal(apiBody.total, 1);
  assert.equal(apiBody.items[0].displayName, "فرد واقعی یک");
  assert.equal(apiBody.items[0].hanaAccountMatched, true);
  assert.ok(!apiText.includes(orgId));
  assert.ok(!apiText.includes(matchedAccountId));
  assert.ok(!apiText.includes("allocationStatus"));
  assert.ok(!apiText.includes("usageStatus"));
  assert.ok(!apiText.includes("MUST_NOT_LEAK"));
  assert.deepEqual(
    Object.keys(apiBody.items[0]).sort(),
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

  const programFilter = await fetch(
    base + "/api/organization/recipients?programId=" + secondProgramId,
    { headers: cookie(memberToken) },
  );
  assert.equal(programFilter.status, 200);
  const programBody = await programFilter.json();
  assert.equal(programBody.total, 1);
  assert.equal(programBody.items[0].displayName, "فرد واقعی دو");

  const beforeInvalid = recipientRequests;
  const invalid = await fetch(
    base + "/api/organization/recipients?organizationId=" + orgId,
    { headers: cookie(memberToken) },
  );
  assert.equal(invalid.status, 400);
  assert.equal(recipientRequests, beforeInvalid);

  const duplicate = await fetch(
    base + "/api/organization/recipients?source=API&source=MANUAL",
    { headers: cookie(memberToken) },
  );
  assert.equal(duplicate.status, 400);

  const anonymous = await fetch(
    base + "/api/organization/recipients",
  );
  assert.equal(anonymous.status, 401);

  const forbidden = await fetch(
    base + "/api/organization/recipients",
    { headers: cookie(outsiderToken) },
  );
  assert.equal(forbidden.status, 403);

  const addPage = await fetch(base + "/organization/people/add", {
    headers: cookie(memberToken),
  });
  assert.equal(addPage.status, 200);
  const addHtml = await addPage.text();
  assert.match(addHtml, /مجوز افزودن مشمول فعال نیست/);
  assert.doesNotMatch(addHtml, /مثال: محمد امینی/);
  assert.doesNotMatch(addHtml, /افزودن فرد/);

  console.log("Organization recipients UI/BFF CI: real SSR data, filters, DTO allowlist, fail-closed mutation and financial boundaries OK");
} finally {
  if (next?.pid) {
    try { process.kill(-next.pid, "SIGTERM"); } catch {}
  }
  if (upstream)
    await new Promise(resolve => upstream.close(resolve));
  rmSync(dir, { recursive: true, force: true });
}
