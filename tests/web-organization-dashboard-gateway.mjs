import assert from "node:assert/strict";
import { createServer } from "node:https";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temp = mkdtempSync(join(tmpdir(), "henna-org-gateway-"));
const base = "http://127.0.0.1:3023";
const token = "hn1_" + Buffer.alloc(32, 7).toString("base64url");
const ORG = "60000000-0000-4000-8000-000000000031";
const PROGRAM = "60000000-0000-4000-8000-000000000032";
let server, web, logs = "", calls = 0;

async function main() {
  const cert = join(temp, "tls.crt"), key = join(temp, "tls.key");
  assert.equal(spawnSync("openssl", [
    "req","-x509","-newkey","rsa:2048","-nodes","-keyout",key,"-out",cert,
    "-days","1","-subj","/CN=127.0.0.1",
    "-addext","subjectAltName=IP:127.0.0.1",
  ], { stdio: "ignore" }).status, 0);

  server = createServer({ key: readFileSync(key), cert: readFileSync(cert) },
    async (req, res) => {
      calls++;
      assert.equal(req.url, "/api/v1/organization/dashboard");
      assert.equal(req.method, "GET");
      assert.equal(req.headers.cookie, undefined);
      assert.equal(req.headers.authorization, "Bearer " + token);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        organizations: [{
          id: ORG, name: "سازمان CI",
          managerCount: 1, beneficiaryCount: 2, programCount: 1,
          registrationReference: "MUST-NOT-LEAK",
        }],
        programs: [{
          id: PROGRAM, organizationId: ORG, name: "طرح CI",
          fundedRial: 5000, unallocatedRial: 2000,
          expiresAtUtc: "2026-11-05T00:00:00Z", categoryCount: 1,
          fundingReference: "MUST-NOT-LEAK",
        }],
        unreadNotifications: 1,
        openTickets: 0,
      }));
    });
  await new Promise(resolve => server.listen(3452, "127.0.0.1", resolve));

  web = spawn("npm", ["run","start","--workspace","@hana/web-marketplace",
    "--","-p","3023","-H","127.0.0.1"], {
      detached: true, stdio: ["ignore","pipe","pipe"],
      env: {...process.env, NEXT_TELEMETRY_DISABLED:"1",
        HANA_API_BASE_URL:"https://127.0.0.1:3452",
        NODE_EXTRA_CA_CERTS:cert},
    });
  web.stdout.on("data", value => logs += value);
  web.stderr.on("data", value => logs += value);
  for (let i = 0; i < 45; i++) {
    if (web.exitCode !== null) throw Error(logs);
    try { if ((await fetch(base + "/auth")).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const anonymous = await fetch(base + "/api/organization/dashboard");
  assert.equal(anonymous.status, 401);
  assert.equal(calls, 0);

  const invalidQuery = await fetch(base + "/api/organization/dashboard?x=1", {
    headers: { Cookie: "__Host-hana_session=" + token },
  });
  assert.equal(invalidQuery.status, 400);
  assert.equal(calls, 0);

  const response = await fetch(base + "/api/organization/dashboard", {
    headers: { Cookie: "__Host-hana_session=" + token },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.equal(body.organizations[0].name, "سازمان CI");
  assert.equal(body.programs[0].unallocatedRial, 2000);
  assert.equal(JSON.stringify(body).includes("MUST-NOT-LEAK"), false);
  assert.equal(calls, 1);

  console.log("Organization BFF passed: cookie isolation, strict route and bounded safe DTO.");
}

try { await main(); } finally {
  if (web?.pid) { try { process.kill(-web.pid, "SIGTERM"); } catch {} }
  if (server) await new Promise(resolve => server.close(resolve));
  rmSync(temp, { recursive: true, force: true });
}
