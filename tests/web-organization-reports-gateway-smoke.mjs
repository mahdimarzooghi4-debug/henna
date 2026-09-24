import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:https";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const dir = mkdtempSync(join(tmpdir(), "hana-org-reports-ui-ci-"));
const cert = join(dir, "cert.pem");
const key = join(dir, "key.pem");

const orgId = "09b354b2-edbe-4f91-b6f6-9f72d0ef0d4f";
const accountId = "4f066916-5d66-47b5-b8df-17385fcd13d1";
const token = "hn1_" + Buffer.alloc(32, 101).toString("base64url");
const zeroToken = "hn1_" + Buffer.alloc(32, 102).toString("base64url");
const malformedToken = "hn1_" + Buffer.alloc(32, 103).toString("base64url");

let upstream;
let next;
let logs = "";
let reportCalls = 0;

const profile = {
  organizationId: orgId,
  name: "سازمان گزارش CI",
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

function report({
  total = 4,
  matched = 2,
  review = 2,
  rate = 50,
} = {}) {
  return {
    organizationType: "سازمان حمایتگر",
    lastRecordedSyncAtUtc: null,
    matching: {
      available: true,
      scope: "ELIGIBLE_PROGRAM_RECIPIENT_RECORDS",
      eligibleProgramCount: 2,
      totalEnrollmentRecordCount: total,
      matchedRecordCount: matched,
      needsReviewRecordCount: review,
      matchRatePercent: rate,
    },
    usage: {
      available: false,
      usedBudget: null,
      utilizationPercent: null,
    },
    allocationDistributionTrend: {
      available: false,
      points: [],
    },
    capability: {
      financialReportingAvailable: false,
      allocationDistributionTrendAvailable: false,
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
      const url = new URL(req.url, "https://127.0.0.1:5212");

      if (url.pathname === "/api/v1/organization/me") {
        if (![token, zeroToken, malformedToken]
          .some(value => auth === "Bearer " + value)) {
          res.writeHead(401);
          res.end("{}");
          return;
        }
        res.writeHead(200);
        res.end(JSON.stringify(profile));
        return;
      }

      if (url.pathname === "/api/v1/organization/reports/overview") {
        reportCalls += 1;
        assert.equal(url.search, "");

        if (auth === "Bearer " + token) {
          res.writeHead(200);
          res.end(JSON.stringify(report()));
          return;
        }

        if (auth === "Bearer " + zeroToken) {
          res.writeHead(200);
          res.end(JSON.stringify(report({
            total: 0,
            matched: 0,
            review: 0,
            rate: null,
          })));
          return;
        }

        if (auth === "Bearer " + malformedToken) {
          res.writeHead(200);
          res.end(JSON.stringify({
            ...report(),
            matching: {
              ...report().matching,
              matchRatePercent: 75,
            },
            amountIrr: 9000000,
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
    upstream.listen(5212, "127.0.0.1", resolve));

  next = spawn("npm", [
    "run", "start", "--workspace", "@hana/web-marketplace",
    "--", "-p", "3012", "-H", "127.0.0.1",
  ], {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_EXTRA_CA_CERTS: cert,
      HANA_API_BASE_URL: "https://127.0.0.1:5212",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });
  next.stdout.on("data", part => { logs += part.toString(); });
  next.stderr.on("data", part => { logs += part.toString(); });

  const base = "http://127.0.0.1:3012";
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

  const anonymous = await fetch(base + "/organization/reports");
  assert.equal(anonymous.status, 200);
  const anonymousHtml = await anonymous.text();
  assert.match(anonymousHtml, /برای مشاهده گزارش‌ها وارد شوید/);

  const page = await fetch(base + "/organization/reports", {
    headers: cookie(token),
  });
  assert.equal(page.status, 200);
  const html = await page.text();

  assert.match(html, /گزارش‌ها و تحلیل طرح‌ها/);
  assert.match(html, /وضعیت تطبیق افراد/);
  assert.match(html, /کل رکوردهای مشمول طرح‌های مجاز/);
  assert.match(html, /تطبیق‌شده/);
  assert.match(html, /نیازمند بررسی/);
  assert.match(html, /٪ تطبیق/);
  assert.match(html, /role="progressbar"/);
  assert.match(html, /width:50%/);
  assert.match(html, /وضعیت مصرف طرح‌ها/);
  assert.match(html, /بودجه استفاده‌شده/);
  assert.match(html, /در دسترس نیست/);
  assert.match(html, /روند کلی تخصیص و توزیع طرح/);
  assert.match(html, /روند مالی در دسترس نیست/);
  assert.match(html, /financial reporting: unavailable/);

  for (const sample of [
    "وضعیت تطبیق: داده نمونه",
    "وضعیت استفاده: داده نمونه",
    "دوره نمونه ۱",
    "دوره نمونه ۲",
    "دوره مرداد",
    "دوره تیر",
  ])
    assert.ok(!html.includes(sample), sample + " leaked");

  const zeroPage = await fetch(base + "/organization/reports", {
    headers: cookie(zeroToken),
  });
  assert.equal(zeroPage.status, 200);
  const zeroHtml = await zeroPage.text();
  assert.match(zeroHtml, /نرخ قابل محاسبه نیست/);
  assert.match(zeroHtml, /بدون رکورد ورودی/);
  assert.doesNotMatch(zeroHtml, /۰٪ تطبیق/);

  const malformedPage = await fetch(base + "/organization/reports", {
    headers: cookie(malformedToken),
  });
  assert.equal(malformedPage.status, 200);
  const malformedHtml = await malformedPage.text();
  assert.match(
    malformedHtml,
    /گزارش‌های سازمان موقتاً در دسترس نیست/,
  );
  assert.doesNotMatch(malformedHtml, /۷۵٪ تطبیق/);
  assert.doesNotMatch(malformedHtml, /9000000/);

  const api = base + "/api/organization/reports/overview";
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
      "matching",
      "usage",
      "allocationDistributionTrend",
      "capability",
    ].sort(),
  );
  assert.equal(body.matching.totalEnrollmentRecordCount, 4);
  assert.equal(body.matching.matchedRecordCount, 2);
  assert.equal(body.matching.needsReviewRecordCount, 2);
  assert.equal(body.matching.matchRatePercent, 50);
  assert.equal(body.usage.available, false);
  assert.equal(body.usage.usedBudget, null);
  assert.equal(body.usage.utilizationPercent, null);
  assert.equal(body.allocationDistributionTrend.available, false);
  assert.deepEqual(body.allocationDistributionTrend.points, []);

  for (const forbidden of [
    orgId,
    accountId,
    "amountIrr",
    "balance",
    "fundingSource",
    "allocationId",
    "recipientId",
  ])
    assert.ok(!bodyText.includes(forbidden), forbidden + " leaked");

  const beforeQuery = reportCalls;
  const query = await fetch(api + "?organizationId=" + orgId, {
    headers: cookie(token),
  });
  assert.equal(query.status, 400);
  assert.equal(reportCalls, beforeQuery);

  const malformed = await fetch(api, {
    headers: cookie(malformedToken),
  });
  assert.equal(malformed.status, 503);
  const malformedText = await malformed.text();
  assert.ok(!malformedText.includes("9000000"));
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
    "Organization reports UI/BFF CI: real matching progress, null denominator, sample trend removal and strict financial boundary OK",
  );
} finally {
  if (next?.pid) {
    try { process.kill(-next.pid, "SIGTERM"); } catch {}
  }
  if (upstream)
    await new Promise(resolve => upstream.close(resolve));
  rmSync(dir, { recursive: true, force: true });
}
