// CI-only HTTPS upstream for public geography; never used by shipping API.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:https";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const provinceId = "6b2bc828-cf5d-4af7-a026-a653739d8509";
const cityId = "fbf47579-71b4-4b85-996c-842ac497fb12";
const otherId = "4ef06bf5-32f3-4b10-a41e-5bd69f6bb442";
const publicCity = { id: cityId, provinceId,
  name: "شهر تست", slug: "ci-city" };
const dir = mkdtempSync(join(tmpdir(), "hana-geo-ci-"));
const cert = join(dir, "cert.pem");
const key = join(dir, "key.pem");
let server;
let next;
let output = "";

try {
  const result = spawnSync("openssl", ["req", "-x509", "-newkey",
    "rsa:2048", "-nodes", "-keyout", key, "-out", cert, "-days", "1",
    "-subj", "/CN=127.0.0.1",
    "-addext", "subjectAltName=IP:127.0.0.1"], { stdio: "ignore" });
  assert.equal(result.status, 0);

  server = createServer({
    cert: readFileSync(cert), key: readFileSync(key),
  }, async (req, res) => {
    assert.equal(req.headers.cookie, undefined,
      "buyer cookie must not be forwarded to geography");
    assert.equal(req.headers.authorization, undefined,
      "buyer bearer must not be forwarded to geography");
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    if (req.url === "/api/v1/geography/provinces") {
      res.writeHead(200);
      res.end(JSON.stringify({ items: [{
        id: provinceId, name: "استان تست", slug: "ci-province",
        state: "SELECTABLE", launched: true,
      }] }));
    } else if (req.url?.startsWith("/api/v1/geography/cities?")) {
      const query = new URL(req.url, "https://geo.test").searchParams;
      assert.deepEqual(query.getAll("provinceId").length, 1);
      const id = query.get("provinceId");
      res.writeHead(200);
      if (id === provinceId) {
        res.end(JSON.stringify({ items: [{
          ...publicCity, delivered: true, sellerCount: 10,
        }] }));
      } else if (id === cityId) {
        res.end(JSON.stringify({ items: [publicCity] }));
      } else {
        res.end(JSON.stringify({ items: [] }));
      }
    } else if (req.url === "/api/v1/geography/cities/" + cityId) {
      res.writeHead(200);
      res.end(JSON.stringify({ ...publicCity, stock: 5, state: "SELECTABLE" }));
    } else {
      res.writeHead(404);
      res.end("{}");
    }
  });
  await new Promise(resolve => server.listen(5201, "127.0.0.1", resolve));

  next = spawn("npm", ["run", "start",
    "--workspace", "@hana/web-marketplace",
    "--", "-p", "3002", "-H", "127.0.0.1",
  ], { detached: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env,
      NODE_EXTRA_CA_CERTS: cert,
      HANA_API_BASE_URL: "https://127.0.0.1:5201",
      NEXT_TELEMETRY_DISABLED: "1",
    } });
  next.stdout.on("data", part => { output += part.toString(); });
  next.stderr.on("data", part => { output += part.toString(); });

  const base = "http://127.0.0.1:3002";
  let ready = false;
  for (let count = 0; count < 45; count++) {
    if (next.exitCode !== null) break;
    try {
      if ((await fetch(base + "/auth", {
        signal: AbortSignal.timeout(1000),
      })).ok) { ready = true; break; }
    } catch { /* retry */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(ready, "Next did not start: " + output);

  const sessionCookie = "hana_session=opaque_ci_only_cookie";
  const withCookie = { headers: { Cookie: sessionCookie } };
  const provinces = await fetch(base + "/api/geography/provinces", withCookie);
  assert.equal(provinces.status, 200);
  assert.equal(provinces.headers.get("cache-control"), "no-store");
  assert.deepEqual(await provinces.json(), { items: [{
    id: provinceId, name: "استان تست", slug: "ci-province",
  }] });

  const cities = await fetch(
    base + "/api/geography/cities?provinceId=" + provinceId, withCookie);
  assert.equal(cities.status, 200);
  assert.equal(cities.headers.get("cache-control"), "no-store");
  assert.deepEqual(await cities.json(), { items: [publicCity] });

  const detail = await fetch(
    base + "/api/geography/cities/" + cityId, withCookie);
  assert.equal(detail.status, 200);
  assert.deepEqual(await detail.json(), publicCity);
  assert.equal((await fetch(
    base + "/api/geography/cities/" + provinceId)).status, 404);

  const empty = await fetch(
    base + "/api/geography/cities?provinceId=" + otherId);
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), { items: [] });
  assert.equal((await fetch(
    base + "/api/geography/cities?provinceId=" + cityId)).status, 503,
    "unexpected province must not be treated as an empty location list");

  for (const path of [
    "/api/geography/provinces?unexpected=1",
    "/api/geography/cities",
    "/api/geography/cities?provinceId=bad",
    "/api/geography/cities?provinceId=" + provinceId +
      "&provinceId=" + cityId,
    "/api/geography/cities?provinceId=" + provinceId + "&extra=1",
    "/api/geography/cities?provinceId=" +
      "00000000-0000-0000-0000-000000000000",
    "/api/geography/cities/" + cityId + "?extra=1",
  ]) {
    assert.equal((await fetch(base + path)).status, 400, path);
  }
  assert.equal((await fetch(
    base + "/api/geography/cities/not-a-uuid")).status, 404);
  console.log("Geography web CI: public field allowlist, zero credential forwarding, no-store, 200/400/404/503 OK");
} finally {
  if (next?.pid) {
    try { process.kill(-next.pid, "SIGTERM"); } catch { /* exited */ }
  }
  if (server)
    await new Promise(resolve => server.close(resolve));
  rmSync(dir, { recursive: true, force: true });
}
