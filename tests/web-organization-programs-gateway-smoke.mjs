// CI-only secure Organization Programs BFF + SSR test.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:https";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const dir = mkdtempSync(join(tmpdir(), "hana-org-programs-ci-"));
const cert = join(dir, "cert.pem");
const key = join(dir, "key.pem");
const orgId = "6b2bc828-cf5d-4af7-a026-a653739d8509";
const activeId = "fbf47579-71b4-4b85-996c-842ac497fb12";
const draftId = "4ef06bf5-32f3-4b10-a41e-5bd69f6bb442";
const foreignId = "298a02d2-9a38-41e6-9a15-65f433f5ba17";
const memberToken = "hn1_" + Buffer.alloc(32, 21).toString("base64url");
const outsiderToken = "hn1_" + Buffer.alloc(32, 22).toString("base64url");
const revokedToken = "hn1_" + Buffer.alloc(32, 23).toString("base64url");
let upstream;
let next;
let logs = "";

const summary = (id, name, status, createdAtUtc) => ({
  id, name, kind: "برنامه سلامت",
  allocationMethod: "الگوی حنا",
  beneficiarySource: "API_OR_MANUAL",
  status, createdAtUtc, updatedAtUtc: createdAtUtc,
  organizationId: orgId,
  internalNote: "must-not-leak",
});

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
      assert.equal(req.headers.cookie, undefined,
        "browser cookies must not be forwarded upstream");
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");

      const auth = req.headers.authorization;
      if (req.url === "/api/v1/organization/me") {
        if (auth === `Bearer ${memberToken}`) {
          res.writeHead(200);
          res.end(JSON.stringify({
            organizationId: orgId,
            name: "سازمان برنامه‌های CI",
            organizationType: "سازمان حمایتگر",
            defaultAllocationMethod: "الگوی حنا",
            phone: null, email: null, address: null,
            representativeName: null, representativePhone: null,
            verified: true, active: true, memberRole: "PORTAL_ADMIN",
          }));
        } else if (auth === `Bearer ${outsiderToken}`) {
          res.writeHead(403); res.end("{}");
        } else {
          res.writeHead(401); res.end("{}");
        }
        return;
      }

      if (req.url?.startsWith("/api/v1/organization/programs")) {
        if (auth === `Bearer ${outsiderToken}`) {
          res.writeHead(403); res.end("{}"); return;
        }
        if (auth === `Bearer ${revokedToken}`) {
          res.writeHead(401); res.end("{}"); return;
        }
        if (auth !== `Bearer ${memberToken}`) {
          res.writeHead(401); res.end("{}"); return;
        }

        if (req.url === "/api/v1/organization/programs/" + activeId) {
          res.writeHead(200);
          res.end(JSON.stringify({
            ...summary(activeId, "طرح واقعی سلامت", "ACTIVE",
              "2026-09-20T10:00:00+00:00"),
            description: "شرح واقعی تست CI",
            revision: 1,
          }));
          return;
        }
        if (req.url === "/api/v1/organization/programs/" + draftId) {
          res.writeHead(200);
          res.end(JSON.stringify({
            ...summary(draftId, "طرح پیش‌نویس واقعی", "DRAFT",
              "2026-09-21T10:00:00+00:00"),
            description: null,
            revision: 1,
          }));
          return;
        }
        if (req.url === "/api/v1/organization/programs/" + foreignId) {
          res.writeHead(404); res.end("{}"); return;
        }

        const url = new URL(req.url, "https://programs.test");
        if (url.pathname === "/api/v1/organization/programs") {
          const status = url.searchParams.get("status");
          const page = Number(url.searchParams.get("page") ?? "1");
          const pageSize = Number(url.searchParams.get("pageSize") ?? "20");
          const all = [
            summary(draftId, "طرح پیش‌نویس واقعی", "DRAFT",
              "2026-09-21T10:00:00+00:00"),
            summary(activeId, "طرح واقعی سلامت", "ACTIVE",
              "2026-09-20T10:00:00+00:00"),
          ];
          const filtered = status
            ? all.filter(item => item.status === status)
            : all;
          const start = (page - 1) * pageSize;
          res.writeHead(200);
          res.end(JSON.stringify({
            items: filtered.slice(start, start + pageSize),
            page, pageSize, total: filtered.length,
          }));
          return;
        }
      }

      res.writeHead(404);
      res.end("{}");
    },
  );
  await new Promise(resolve =>
    upstream.listen(5203, "127.0.0.1", resolve));

  next = spawn("npm", [
    "run", "start", "--workspace", "@hana/web-marketplace",
    "--", "-p", "3004", "-H", "127.0.0.1",
  ], {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_EXTRA_CA_CERTS: cert,
      HANA_API_BASE_URL: "https://127.0.0.1:5203",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });
  next.stdout.on("data", part => { logs += part.toString(); });
  next.stderr.on("data", part => { logs += part.toString(); });

  const base = "http://127.0.0.1:3004";
  let ready = false;
  for (let i = 0; i < 45; i++) {
    if (next.exitCode !== null) break;
    try {
      if ((await fetch(base + "/auth", {
        signal: AbortSignal.timeout(1000),
      })).ok) { ready = true; break; }
    } catch { /* retry */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(ready, "Next did not start: " + logs);

  const cookie = token => ({
    headers: { Cookie: `__Host-hana_session=${token}` },
  });

  const anonymous = await fetch(base + "/api/organization/programs");
  assert.equal(anonymous.status, 401);
  assert.equal(anonymous.headers.get("cache-control"), "no-store");

  const invalid = await fetch(
    base + "/api/organization/programs?organizationId=" + orgId,
    cookie(memberToken));
  assert.equal(invalid.status, 400);

  const outsider = await fetch(
    base + "/api/organization/programs", cookie(outsiderToken));
  assert.equal(outsider.status, 403);
  assert.equal(outsider.headers.get("set-cookie"), null);

  const list = await fetch(
    base + "/api/organization/programs", cookie(memberToken));
  assert.equal(list.status, 200);
  const listBody = await list.json();
  assert.equal(listBody.total, 2);
  assert.equal(listBody.items.length, 2);
  assert.ok(!JSON.stringify(listBody).includes("must-not-leak"));
  assert.ok(!JSON.stringify(listBody).includes(orgId),
    "organizationId must be stripped from program response");

  const filtered = await fetch(
    base + "/api/organization/programs?status=ACTIVE",
    cookie(memberToken));
  assert.equal(filtered.status, 200);
  assert.equal((await filtered.json()).items.length, 1);

  const detail = await fetch(
    base + "/api/organization/programs/" + activeId,
    cookie(memberToken));
  assert.equal(detail.status, 200);
  const detailBody = await detail.json();
  assert.equal(detailBody.name, "طرح واقعی سلامت");
  assert.equal(detailBody.description, "شرح واقعی تست CI");
  assert.ok(!("organizationId" in detailBody));
  assert.ok(!("internalNote" in detailBody));

  const foreign = await fetch(
    base + "/api/organization/programs/" + foreignId,
    cookie(memberToken));
  assert.equal(foreign.status, 404);

  const listPage = await fetch(
    base + "/organization/programs", cookie(memberToken));
  assert.equal(listPage.status, 200);
  const listHtml = await listPage.text();
  assert.match(listHtml, /طرح واقعی سلامت/);
  assert.match(listHtml, /طرح پیش‌نویس واقعی/);
  assert.doesNotMatch(listHtml, /طرح نمونه ۱/);
  assert.doesNotMatch(listHtml, /must-not-leak/);

  const filteredPage = await fetch(
    base + "/organization/programs?status=ACTIVE",
    cookie(memberToken));
  const filteredHtml = await filteredPage.text();
  assert.match(filteredHtml, /طرح واقعی سلامت/);
  assert.doesNotMatch(filteredHtml, /طرح پیش‌نویس واقعی/);

  const detailPage = await fetch(
    base + "/organization/programs/" + activeId,
    cookie(memberToken));
  assert.equal(detailPage.status, 200);
  const detailHtml = await detailPage.text();
  assert.match(detailHtml, /شرح واقعی تست CI/);
  assert.match(detailHtml, /سازمان برنامه‌های CI/);
  assert.doesNotMatch(detailHtml, /جمعیت ثبت‌شده: داده نمونه/);

  const foreignPage = await fetch(
    base + "/organization/programs/" + foreignId,
    cookie(memberToken));
  assert.equal(foreignPage.status, 404);

  const revoked = await fetch(
    base + "/api/organization/programs", cookie(revokedToken));
  assert.equal(revoked.status, 401);
  assert.match(revoked.headers.get("set-cookie") ?? "", /expires=/i);

  console.log("Organization Programs web CI: secure BFF, real SSR list/detail, filtering, tenant 404 and field allowlist OK");
} finally {
  if (next?.pid) {
    try { process.kill(-next.pid, "SIGTERM"); } catch { /* stopped */ }
  }
  if (upstream)
    await new Promise(resolve => upstream.close(resolve));
  rmSync(dir, { recursive: true, force: true });
}
