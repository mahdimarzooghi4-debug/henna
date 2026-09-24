import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:https";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const dir = mkdtempSync(join(tmpdir(), "hana-notification-read-ci-"));
const cert = join(dir, "cert.pem");
const key = join(dir, "key.pem");
const id = "09b354b2-edbe-4f91-b6f6-9f72d0ef0d4f";
const token = "hn1_" + Buffer.alloc(32, 111).toString("base64url");
const forbidden = "hn1_" + Buffer.alloc(32, 112).toString("base64url");
let upstream;
let next;
let logs = "";
let calls = 0;

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
      calls++;
      assert.equal(req.method, "POST");
      assert.equal(req.headers.cookie, undefined);
      assert.equal(req.headers.origin, undefined);
      assert.equal(req.url, `/api/v1/organization/notifications/${id}/read`);
      let body = "";
      req.on("data", part => { body += part; });
      req.on("end", () => {
        assert.equal(body, "");
        if (req.headers.authorization === "Bearer " + token) {
          res.writeHead(204); res.end();
        } else if (req.headers.authorization === "Bearer " + forbidden) {
          res.writeHead(403); res.end("{}");
        } else {
          res.writeHead(401); res.end("{}");
        }
      });
    },
  );
  await new Promise(resolve => upstream.listen(5220, "127.0.0.1", resolve));

  next = spawn("npm", ["run", "start", "--workspace", "@hana/web-marketplace",
    "--", "-p", "3017", "-H", "127.0.0.1"], {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NODE_EXTRA_CA_CERTS: cert,
      HANA_API_BASE_URL: "https://127.0.0.1:5220",
      NEXT_TELEMETRY_DISABLED: "1" },
  });
  next.stdout.on("data", part => { logs += part.toString(); });
  next.stderr.on("data", part => { logs += part.toString(); });

  const base = "http://127.0.0.1:3017";
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

  const url = base + `/api/organization/notifications/${id}/read`;
  const headers = value => ({ Origin: base,
    Cookie: "__Host-hana_session=" + value });

  const crossOrigin = await fetch(url, { method: "POST",
    headers: { ...headers(token), Origin: "https://attacker.example" } });
  assert.equal(crossOrigin.status, 403);
  assert.equal(calls, 0);

  const query = await fetch(url + "?organizationId=" + id, {
    method: "POST", headers: headers(token),
  });
  assert.equal(query.status, 400);
  assert.equal(calls, 0);

  const body = await fetch(url, { method: "POST", headers: {
    ...headers(token), "Content-Type": "application/json" }, body: "{}" });
  assert.equal(body.status, 400);
  assert.equal(calls, 0);

  const anonymous = await fetch(url, { method: "POST", headers: { Origin: base } });
  assert.equal(anonymous.status, 401);
  assert.equal(calls, 0);

  const invalidId = await fetch(base + "/api/organization/notifications/bad/read", {
    method: "POST", headers: headers(token),
  });
  assert.equal(invalidId.status, 404);
  assert.equal(calls, 0);

  const denied = await fetch(url, { method: "POST", headers: headers(forbidden) });
  assert.equal(denied.status, 403);
  assert.equal(calls, 1);

  const success = await fetch(url, { method: "POST", headers: headers(token) });
  assert.equal(success.status, 204);
  assert.equal(success.headers.get("cache-control"), "no-store");
  assert.equal(await success.text(), "");
  assert.equal(calls, 2);

  const get = await fetch(url, { headers: headers(token) });
  assert.equal(get.status, 405);

  console.log("Organization notification read BFF: origin, body, auth and 204 boundary OK");
} finally {
  if (next?.pid) { try { process.kill(-next.pid, "SIGTERM"); } catch {} }
  if (upstream) await new Promise(resolve => upstream.close(resolve));
  rmSync(dir, { recursive: true, force: true });
}
