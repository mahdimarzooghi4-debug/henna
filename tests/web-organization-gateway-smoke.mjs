// CI-only organization BFF test. The HTTPS upstream is disposable and never
// registered in production.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:https";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const dir = mkdtempSync(join(tmpdir(), "hana-org-ci-"));
const cert = join(dir, "cert.pem");
const key = join(dir, "key.pem");
const orgId = "6b2bc828-cf5d-4af7-a026-a653739d8509";
const memberToken = "hn1_" + Buffer.alloc(32, 11).toString("base64url");
const outsiderToken = "hn1_" + Buffer.alloc(32, 12).toString("base64url");
const revokedToken = "hn1_" + Buffer.alloc(32, 13).toString("base64url");
const brokenToken = "hn1_" + Buffer.alloc(32, 14).toString("base64url");
let upstream;
let next;
let logs = "";

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
        "browser cookies must never be forwarded upstream");
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      if (req.url !== "/api/v1/organization/me" || req.method !== "GET") {
        res.writeHead(404); res.end("{}"); return;
      }

      const auth = req.headers.authorization;
      if (auth === `Bearer ${memberToken}`) {
        res.writeHead(200);
        res.end(JSON.stringify({
          organizationId: orgId,
          name: "سازمان واقعی تست CI",
          organizationType: "سازمان حمایتگر",
          defaultAllocationMethod: "الگوی حنا",
          phone: "02100000000",
          email: "ci@example.test",
          address: "نشانی تست",
          representativeName: "نماینده تست",
          representativePhone: "09120000000",
          verified: true,
          active: true,
          memberRole: "PORTAL_ADMIN",
          accountId: "must-not-leak",
          internalFlag: "must-not-leak",
        }));
      } else if (auth === `Bearer ${outsiderToken}`) {
        res.writeHead(403); res.end("{}");
      } else if (auth === `Bearer ${revokedToken}`) {
        res.writeHead(401); res.end("{}");
      } else if (auth === `Bearer ${brokenToken}`) {
        res.writeHead(200); res.end(JSON.stringify({
          organizationId: "bad",
          name: "broken",
        }));
      } else {
        res.writeHead(401); res.end("{}");
      }
    },
  );
  await new Promise(resolve => upstream.listen(5202, "127.0.0.1", resolve));

  next = spawn("npm", [
    "run", "start", "--workspace", "@hana/web-marketplace",
    "--", "-p", "3003", "-H", "127.0.0.1",
  ], {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_EXTRA_CA_CERTS: cert,
      HANA_API_BASE_URL: "https://127.0.0.1:5202",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });
  next.stdout.on("data", part => { logs += part.toString(); });
  next.stderr.on("data", part => { logs += part.toString(); });

  const base = "http://127.0.0.1:3003";
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

  const anonymous = await fetch(base + "/api/organization/me");
  assert.equal(anonymous.status, 401);
  assert.equal(anonymous.headers.get("cache-control"), "no-store");

  const outsider = await fetch(
    base + "/api/organization/me", cookie(outsiderToken));
  assert.equal(outsider.status, 403);
  assert.equal(outsider.headers.get("set-cookie"), null,
    "valid session without membership must not be logged out");

  const member = await fetch(
    base + "/api/organization/me", cookie(memberToken));
  assert.equal(member.status, 200);
  assert.equal(member.headers.get("cache-control"), "no-store");
  const body = await member.json();
  assert.deepEqual(body, {
    organizationId: orgId,
    name: "سازمان واقعی تست CI",
    organizationType: "سازمان حمایتگر",
    defaultAllocationMethod: "الگوی حنا",
    phone: "02100000000",
    email: "ci@example.test",
    address: "نشانی تست",
    representativeName: "نماینده تست",
    representativePhone: "09120000000",
    verified: true,
    active: true,
    memberRole: "PORTAL_ADMIN",
  });
  assert.ok(!JSON.stringify(body).includes(memberToken));
  assert.ok(!("accountId" in body));
  assert.ok(!("internalFlag" in body));

  const profilePage = await fetch(
    base + "/organization/profile", cookie(memberToken));
  assert.equal(profilePage.status, 200);
  const html = await profilePage.text();
  assert.match(html, /سازمان واقعی تست CI/);
  assert.match(html, /PORTAL_ADMIN/);
  assert.doesNotMatch(html, /info@org-domain\.ir/);
  assert.doesNotMatch(html, /must-not-leak/);

  const revoked = await fetch(
    base + "/api/organization/me", cookie(revokedToken));
  assert.equal(revoked.status, 401);
  assert.match(revoked.headers.get("set-cookie") ?? "", /expires=/i);

  const broken = await fetch(
    base + "/api/organization/me", cookie(brokenToken));
  assert.equal(broken.status, 503,
    "malformed upstream profile must fail closed");

  console.log("Organization BFF CI: HttpOnly-cookie bearer boundary, 200/401/403/503, allowlist and SSR profile OK");
} finally {
  if (next?.pid) {
    try { process.kill(-next.pid, "SIGTERM"); } catch { /* stopped */ }
  }
  if (upstream)
    await new Promise(resolve => upstream.close(resolve));
  rmSync(dir, { recursive: true, force: true });
}
