import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:https";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const dir = mkdtempSync(join(tmpdir(), "hana-org-allocation-readiness-ui-ci-"));
const cert = join(dir, "cert.pem");
const key = join(dir, "key.pem");

const orgId = "5ccf8f5d-e40c-4e54-a0c4-245a6a6e32ef";
const registeredId = "9a58cc3b-b52b-46e5-8e69-491c87509ed6";
const activeId = "88117e90-71bb-4a1a-879d-ff83f2fd4daf";
const foreignId = "e8e83ab4-0eb8-42b0-bae2-683bb281c629";
const malformedId = "e62d3307-eec3-48db-bebd-a16c9d866a23";

const token = "hn1_" + Buffer.alloc(32, 81).toString("base64url");
let upstream;
let next;
let logs = "";
let overviewCalls = 0;
let detailCalls = 0;

const profile = {
  organizationId: orgId,
  name: "سازمان آمادگی تخصیص CI",
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

const registered = {
  id: registeredId,
  name: "طرح ثبت‌شده واقعی",
  status: "REGISTERED",
  allocationMethod: "الگوی حنا",
  inputRecordCount: 3,
  readyRecordCount: 1,
  needsReviewRecordCount: 2,
  sources: {
    manualRecordCount: 2,
    apiRecordCount: 1,
  },
};

const active = {
  id: activeId,
  name: "طرح فعال واقعی",
  status: "ACTIVE",
  allocationMethod: "الگوی حنا",
  inputRecordCount: 2,
  readyRecordCount: 2,
  needsReviewRecordCount: 0,
  sources: {
    manualRecordCount: 1,
    apiRecordCount: 1,
  },
};

const overview = {
  organizationType: "سازمان حمایتگر",
  allocationMethod: "الگوی حنا",
  targetPeriod: null,
  eligibleProgramCount: 2,
  inputRecordCount: 5,
  readyRecordCount: 3,
  needsReviewRecordCount: 2,
  sources: {
    manualRecordCount: 3,
    apiRecordCount: 2,
  },
  programs: [active, registered],
  execution: {
    enabled: false,
    state: "NOT_CONFIGURED",
    monetaryMutationSupported: false,
  },
  processHistory: {
    available: false,
    items: [],
  },
};

function detail(program) {
  return {
    program,
    targetPeriod: null,
    execution: {
      enabled: false,
      state: "NOT_CONFIGURED",
      monetaryMutationSupported: false,
    },
    result: {
      available: false,
      allocatedRecordCount: null,
      needsReviewRecordCount: program.needsReviewRecordCount,
    },
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
      if (auth !== "Bearer " + token) {
        res.writeHead(401);
        res.end("{}");
        return;
      }

      const url = new URL(req.url, "https://127.0.0.1:5210");
      if (url.pathname === "/api/v1/organization/me") {
        res.writeHead(200);
        res.end(JSON.stringify(profile));
        return;
      }

      if (url.pathname === "/api/v1/organization/allocation/readiness") {
        overviewCalls += 1;
        assert.equal(url.search, "");
        res.writeHead(200);
        res.end(JSON.stringify(overview));
        return;
      }

      const prefix = "/api/v1/organization/allocation/readiness/";
      if (url.pathname.startsWith(prefix)) {
        detailCalls += 1;
        assert.equal(url.search, "");
        const id = url.pathname.slice(prefix.length);
        if (id === registeredId) {
          res.writeHead(200);
          res.end(JSON.stringify(detail(registered)));
          return;
        }
        if (id === activeId) {
          res.writeHead(200);
          res.end(JSON.stringify(detail(active)));
          return;
        }
        if (id === malformedId) {
          res.writeHead(200);
          res.end(JSON.stringify({
            ...detail(active),
            amountIrr: 999999999,
          }));
          return;
        }
        res.writeHead(404);
        res.end("{}");
        return;
      }

      res.writeHead(404);
      res.end("{}");
    },
  );
  await new Promise(resolve =>
    upstream.listen(5210, "127.0.0.1", resolve));

  next = spawn("npm", [
    "run", "start", "--workspace", "@hana/web-marketplace",
    "--", "-p", "3010", "-H", "127.0.0.1",
  ], {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_EXTRA_CA_CERTS: cert,
      HANA_API_BASE_URL: "https://127.0.0.1:5210",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });
  next.stdout.on("data", part => { logs += part.toString(); });
  next.stderr.on("data", part => { logs += part.toString(); });

  const base = "http://127.0.0.1:3010";
  let ready = false;
  for (let i = 0; i < 45; i++) {
    if (next.exitCode !== null) break;
    try {
      if ((await fetch(base + "/auth", {
        signal: AbortSignal.timeout(1000),
      })).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(ready, "Next did not start: " + logs);

  const cookie = { Cookie: "__Host-hana_session=" + token };

  const anonymous = await fetch(base + "/organization/allocation");
  assert.equal(anonymous.status, 200);
  const anonymousHtml = await anonymous.text();
  assert.match(anonymousHtml, /برای مشاهده آمادگی تخصیص وارد شوید/);
  assert.doesNotMatch(anonymousHtml, /طرح ثبت‌شده واقعی/);

  const page = await fetch(base + "/organization/allocation", {
    headers: cookie,
  });
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /مدیریت تخصیص اعتبار/);
  assert.match(html, /نوع سازمان فعال:.*سازمان حمایتگر/);
  assert.match(html, /رکوردهای آماده برای بررسی تخصیص/);
  assert.match(html, /تاریخچه فعال نیست/);
  assert.match(html, /NOT_CONFIGURED/);
  assert.match(html, /طرح ثبت‌شده واقعی/);
  assert.match(html, /طرح فعال واقعی/);
  assert.match(
    html,
    new RegExp("/organization/allocation/" + registeredId),
  );
  assert.match(
    html,
    /<button[^>]*disabled[^>]*>\s*شروع فرایند تخصیص\s*<\/button>/,
  );
  assert.doesNotMatch(html, /داده نمونه/);
  assert.doesNotMatch(html, /تاریخ نمونه/);
  assert.doesNotMatch(html, /ALC-/);
  assert.doesNotMatch(html, /توزیع شده/);
  assert.doesNotMatch(html, /در حال پردازش/);

  const detailPage = await fetch(
    base + "/organization/allocation/" + registeredId,
    { headers: cookie },
  );
  assert.equal(detailPage.status, 200);
  const detailHtml = await detailPage.text();
  assert.match(detailHtml, /جزئیات تخصیص اعتبار/);
  assert.match(detailHtml, /طرح ثبت‌شده واقعی/);
  assert.match(detailHtml, /اجرای مالی غیرفعال/);
  assert.match(detailHtml, /تخصیص اجرا نشده/);
  assert.match(detailHtml, /شناسه طرح:/);
  assert.match(detailHtml, /NOT_CONFIGURED/);
  assert.doesNotMatch(detailHtml, /شناسه تخصیص:/);
  assert.doesNotMatch(detailHtml, /داده نمونه/);
  assert.doesNotMatch(detailHtml, /پردازش‌شده/);

  const foreignPage = await fetch(
    base + "/organization/allocation/" + foreignId,
    { headers: cookie, redirect: "manual" },
  );
  assert.equal(foreignPage.status, 404);

  const apiUrl = base + "/api/organization/allocation/readiness";
  const api = await fetch(apiUrl, { headers: cookie });
  assert.equal(api.status, 200);
  assert.equal(api.headers.get("cache-control"), "no-store");
  const apiBody = await api.json();
  assert.deepEqual(
    Object.keys(apiBody).sort(),
    [
      "organizationType",
      "allocationMethod",
      "targetPeriod",
      "eligibleProgramCount",
      "inputRecordCount",
      "readyRecordCount",
      "needsReviewRecordCount",
      "sources",
      "programs",
      "execution",
      "processHistory",
    ].sort(),
  );
  assert.equal(apiBody.inputRecordCount, 5);
  assert.equal(apiBody.execution.enabled, false);
  assert.equal(apiBody.execution.state, "NOT_CONFIGURED");
  assert.equal(apiBody.processHistory.available, false);
  assert.deepEqual(apiBody.processHistory.items, []);
  for (const forbidden of [
    "amountIrr",
    "balance",
    "fundingSource",
    "ledger",
    "allocationId",
    "beneficiaryAccountId",
    orgId,
  ])
    assert.ok(!JSON.stringify(apiBody).includes(forbidden), forbidden + " leaked");

  const beforeQuery = overviewCalls;
  const query = await fetch(apiUrl + "?x=1", { headers: cookie });
  assert.equal(query.status, 400);
  assert.equal(overviewCalls, beforeQuery);

  const apiDetail = await fetch(
    apiUrl + "/" + registeredId,
    { headers: cookie },
  );
  assert.equal(apiDetail.status, 200);
  const apiDetailBody = await apiDetail.json();
  assert.equal(apiDetailBody.program.id, registeredId);
  assert.equal(apiDetailBody.result.available, false);
  assert.equal(apiDetailBody.result.allocatedRecordCount, null);
  assert.equal(apiDetailBody.execution.enabled, false);

  const malformed = await fetch(
    apiUrl + "/" + malformedId,
    { headers: cookie },
  );
  assert.equal(malformed.status, 503);
  const malformedText = await malformed.text();
  assert.ok(!malformedText.includes("999999999"));
  assert.ok(!malformedText.includes("amountIrr"));

  const beforeInvalid = detailCalls;
  const invalid = await fetch(
    apiUrl + "/not-a-guid",
    { headers: cookie },
  );
  assert.equal(invalid.status, 404);
  assert.equal(detailCalls, beforeInvalid);

  const post = await fetch(apiUrl, {
    method: "POST",
    headers: {
      ...cookie,
      Origin: base,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(post.status, 405);

  console.log(
    "Organization allocation readiness UI/BFF CI: real counts, per-program detail, disabled execution, no sample financial state and fail-closed parsing OK",
  );
} finally {
  if (next?.pid) {
    try { process.kill(-next.pid, "SIGTERM"); } catch {}
  }
  if (upstream)
    await new Promise(resolve => upstream.close(resolve));
  rmSync(dir, { recursive: true, force: true });
}
