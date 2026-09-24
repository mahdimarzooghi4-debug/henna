import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:https";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const dir = mkdtempSync(join(tmpdir(), "hana-org-usage-status-ui-ci-"));
const cert = join(dir, "cert.pem");
const key = join(dir, "key.pem");

const orgId = "52c50a4a-7827-4f7c-a900-13201ef3bb55";
const accountId = "f449891b-7934-4b2e-99ed-3e88eb4c5d97";
const token = "hn1_" + Buffer.alloc(32, 91).toString("base64url");
const malformedToken =
  "hn1_" + Buffer.alloc(32, 92).toString("base64url");

let upstream;
let next;
let logs = "";
let usageCalls = 0;

const profile = {
  organizationId: orgId,
  name: "سازمان وضعیت استفاده CI",
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

const validUsage = {
  organizationType: "سازمان حمایتگر",
  lastRecordedSyncAtUtc: null,
  summary: {
    available: false,
    totalAllocated: null,
    activeInUse: null,
    consumed: null,
    idleOrUnused: null,
  },
  beneficiaryUsage: {
    available: false,
    items: [],
  },
  capability: {
    state: "NOT_CONFIGURED",
    monetaryUsageReadModelAvailable: false,
    ledgerAvailable: false,
  },
};

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
      const url = new URL(req.url, "https://127.0.0.1:5211");

      if (url.pathname === "/api/v1/organization/me") {
        if (auth !== "Bearer " + token &&
          auth !== "Bearer " + malformedToken) {
          res.writeHead(401);
          res.end("{}");
          return;
        }
        res.writeHead(200);
        res.end(JSON.stringify(profile));
        return;
      }

      if (url.pathname === "/api/v1/organization/usage/status") {
        usageCalls += 1;
        assert.equal(url.search, "");
        if (auth === "Bearer " + token) {
          res.writeHead(200);
          res.end(JSON.stringify(validUsage));
          return;
        }
        if (auth === "Bearer " + malformedToken) {
          res.writeHead(200);
          res.end(JSON.stringify({
            ...validUsage,
            summary: {
              ...validUsage.summary,
              totalAllocated: 0,
            },
            amountIrr: 5000000,
            organizationId: orgId,
            accountId,
          }));
          return;
        }
        res.writeHead(401);
        res.end("{}");
        return;
      }

      res.writeHead(404);
      res.end("{}");
    },
  );
  await new Promise(resolve =>
    upstream.listen(5211, "127.0.0.1", resolve));

  next = spawn("npm", [
    "run", "start", "--workspace", "@hana/web-marketplace",
    "--", "-p", "3011", "-H", "127.0.0.1",
  ], {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_EXTRA_CA_CERTS: cert,
      HANA_API_BASE_URL: "https://127.0.0.1:5211",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });
  next.stdout.on("data", part => { logs += part.toString(); });
  next.stderr.on("data", part => { logs += part.toString(); });

  const base = "http://127.0.0.1:3011";
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

  const cookie = value => ({
    Cookie: "__Host-hana_session=" + value,
  });

  const anonymous = await fetch(base + "/organization/usage");
  assert.equal(anonymous.status, 200);
  const anonymousHtml = await anonymous.text();
  assert.match(
    anonymousHtml,
    /برای مشاهده وضعیت استفاده وارد شوید/,
  );
  assert.doesNotMatch(
    anonymousHtml,
    /داده مالی وضعیت استفاده هنوز در هسته حنا فعال نشده است/,
  );

  const page = await fetch(base + "/organization/usage", {
    headers: cookie(token),
  });
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /وضعیت استفاده و عملکرد اعتبارات/);
  assert.match(html, /سازمان حمایتگر/);
  assert.match(
    html,
    /آخرین همگام‌سازی مالی ثبت‌شده/,
  );
  assert.match(html, /هنوز پیکربندی نشده/);
  assert.match(html, /کل اعتبارات تخصیص یافته/);
  assert.match(html, /اعتبار فعال در حال استفاده/);
  assert.match(html, /اعتبار مصرف شده/);
  assert.match(html, /اعتبار راکد یا استفاده نشده/);
  assert.match(html, /در دسترس نیست/);
  assert.match(html, /لیست وضعیت مصرف مشمولان/);
  assert.match(html, /داده مصرف موجود نیست/);
  assert.match(html, /NOT_CONFIGURED/);
  assert.doesNotMatch(html, /مقدار نمونه/);
  assert.doesNotMatch(html, /تاریخ نمونه/);
  assert.doesNotMatch(html, /فرد نمونه/);
  assert.doesNotMatch(html, /استفاده شده/);
  assert.doesNotMatch(html, /بخشی استفاده شده/);
  assert.doesNotMatch(html, /پایان‌یافته \/ غیرفعال/);
  assert.doesNotMatch(html, />۰</);

  const malformedPage = await fetch(
    base + "/organization/usage",
    { headers: cookie(malformedToken) },
  );
  assert.equal(malformedPage.status, 200);
  const malformedHtml = await malformedPage.text();
  assert.match(
    malformedHtml,
    /وضعیت استفاده موقتاً در دسترس نیست/,
  );
  assert.doesNotMatch(malformedHtml, /۵٬۰۰۰٬۰۰۰/);
  assert.doesNotMatch(malformedHtml, /5000000/);

  const api = base + "/api/organization/usage/status";
  const response = await fetch(api, {
    headers: cookie(token),
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const bodyText = await response.text();
  const body = JSON.parse(bodyText);
  assert.deepEqual(
    Object.keys(body).sort(),
    [
      "organizationType",
      "lastRecordedSyncAtUtc",
      "summary",
      "beneficiaryUsage",
      "capability",
    ].sort(),
  );
  assert.equal(body.organizationType, "سازمان حمایتگر");
  assert.equal(body.lastRecordedSyncAtUtc, null);
  assert.equal(body.summary.available, false);
  assert.equal(body.summary.totalAllocated, null);
  assert.equal(body.summary.activeInUse, null);
  assert.equal(body.summary.consumed, null);
  assert.equal(body.summary.idleOrUnused, null);
  assert.equal(body.beneficiaryUsage.available, false);
  assert.deepEqual(body.beneficiaryUsage.items, []);
  assert.equal(body.capability.state, "NOT_CONFIGURED");
  assert.equal(
    body.capability.monetaryUsageReadModelAvailable,
    false,
  );
  assert.equal(body.capability.ledgerAvailable, false);

  for (const forbidden of [
    orgId,
    accountId,
    "amountIrr",
    "balance",
    "fundingSource",
    "allocationId",
    "recipientId",
    "matchedAccountId",
    "phone",
  ])
    assert.ok(!bodyText.includes(forbidden), forbidden + " leaked");

  const callsBeforeQuery = usageCalls;
  const query = await fetch(api + "?organizationId=" + orgId, {
    headers: cookie(token),
  });
  assert.equal(query.status, 400);
  assert.equal(usageCalls, callsBeforeQuery);

  const malformed = await fetch(api, {
    headers: cookie(malformedToken),
  });
  assert.equal(malformed.status, 503);
  const malformedText = await malformed.text();
  assert.ok(!malformedText.includes("5000000"));
  assert.ok(!malformedText.includes("amountIrr"));
  assert.ok(!malformedText.includes(orgId));
  assert.ok(!malformedText.includes(accountId));

  const post = await fetch(api, {
    method: "POST",
    headers: {
      ...cookie(token),
      Origin: base,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(post.status, 405);

  console.log(
    "Organization usage status UI/BFF CI: Figma sample removal, null-not-zero state, strict financial boundary and fail-closed parsing OK",
  );
} finally {
  if (next?.pid) {
    try { process.kill(-next.pid, "SIGTERM"); } catch {}
  }
  if (upstream)
    await new Promise(resolve => upstream.close(resolve));
  rmSync(dir, { recursive: true, force: true });
}
