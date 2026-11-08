import assert from "node:assert/strict";
import { createServer } from "node:https";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temp = mkdtempSync(join(tmpdir(), "henna-app-links-ci-"));
const webOrigin = "http://127.0.0.1:3073";
const token = "hn1_" + Buffer.alloc(32, 7).toString("base64url");
const cookie = { Cookie: "__Host-hana_session=" + token };
const buyerUrl = "https://releases.example.com/hana-buyer.apk";
const sellerUrl = "https://releases.example.com/hana-seller.apk";
let upstream;
let web;
let logs = "";
let upstreamCalls = 0;
let approved = false;
let activated = false;
let suspended = false;
let valid = true;

function status() {
  return {
    trackingCode: "HNA-A1B2C3D4E5F60718",
    overallStatus: approved ? "APPROVED" : "UNDER_REVIEW",
    reviewedAtUtc: approved ? "2026-11-01T12:00:00Z" : null,
    activatedAtUtc: activated ? "2026-11-02T12:00:00Z" : null,
    sellerAccessEnabled: activated && approved && !suspended,
    sellerPanelEnabled: activated && approved && !suspended,
    steps: [
      { key: "IDENTITY", status: "COMPLETED" },
      { key: "BUSINESS", status: "COMPLETED" },
      { key: "ACTIVITY", status: "COMPLETED" },
      { key: "ADDITIONAL", status: "COMPLETED" },
      { key: "REVIEW", status: approved ? "APPROVED" : "UNDER_REVIEW" },
    ],
  };
}

async function run() {
  const key = join(temp, "key.pem");
  const cert = join(temp, "cert.pem");
  assert.equal(spawnSync("openssl", [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes",
    "-keyout", key, "-out", cert, "-days", "1",
    "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1",
  ], { stdio: "ignore" }).status, 0);

  upstream = createServer({ key: readFileSync(key), cert: readFileSync(cert) },
    (req, res) => {
      upstreamCalls++;
      assert.equal(req.method, "GET");
      assert.equal(req.url, "/api/v1/seller/registration/status");
      assert.equal(req.headers.authorization, "Bearer " + token);
      assert.equal(req.headers.cookie, undefined);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(valid ? status() : { sellerAccessEnabled: true }));
    });
  await new Promise(resolve => upstream.listen(3473, "127.0.0.1", resolve));
  web = spawn("npm",
    ["run", "start", "--workspace", "@hana/web-marketplace",
      "--", "-p", "3073", "-H", "127.0.0.1"], {
      detached: true, stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: "1",
        HANA_API_BASE_URL: "https://127.0.0.1:3473",
        NODE_EXTRA_CA_CERTS: cert,
        HANA_BUYER_ANDROID_APPROVED_URL: "",
        HANA_SELLER_ANDROID_APPROVED_URL: "",
        HANA_BUYER_ANDROID_PREVIEW_URL: buyerUrl,
        HANA_SELLER_ANDROID_PREVIEW_URL: sellerUrl,
      },
    });
  web.stdout.on("data", chunk => logs += chunk);
  web.stderr.on("data", chunk => logs += chunk);
  let started = false;
  for (let i = 0; i < 60; i++) {
    if (web.exitCode !== null) throw Error("Next exited: " + logs.slice(-3000));
    try {
      const response = await fetch(webOrigin + "/download");
      if (response.ok) { started = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(started, "Next server did not start: " + logs.slice(-3000));

  const home = await (await fetch(webOrigin)).text();
  assert.match(home, /دریافت اپلیکیشن خریدار/);
  assert.match(home, /href="\/download"/);
  const buyer = await (await fetch(webOrigin + "/download")).text();
  assert.match(buyer, /دانلود اپلیکیشن خریدار حنا/);
  assert.match(buyer, /نسخه آزمایشی/);
  assert.match(buyer, /دانلود APK خریدار/);
  assert.match(buyer, /href="\/api\/mobile-apk\/buyer"/);
  assert.match(buyer, /href="\/seller\/app"/);
  assert.doesNotMatch(buyer, /href="\/api\/mobile-apk\/seller"/);
  assert.equal(buyer.includes(sellerUrl), false, "public page must not reveal seller APK URL");
  assert.equal(buyer.includes(buyerUrl), false, "public page must not embed server-only APK URL");

  const buyerRedirect = await fetch(webOrigin + "/api/mobile-apk/buyer", { redirect: "manual" });
  assert.equal(buyerRedirect.status, 302);
  assert.equal(buyerRedirect.headers.get("location"), buyerUrl);
  assert.match(buyerRedirect.headers.get("cache-control") ?? "", /no-store/);
  for (const name of ["seller", "unknown"]) {
    const publicSeller = await fetch(webOrigin + "/api/mobile-apk/" + name, { redirect: "manual" });
    assert.equal(publicSeller.status, 404, "public APK endpoint must never serve " + name);
    assert.equal(publicSeller.headers.get("location"), null);
    assert.match(publicSeller.headers.get("cache-control") ?? "", /no-store/);
  }
  assert.equal(upstreamCalls, 0, "public download must not call seller API");

  const noAuth = await fetch(webOrigin + "/api/seller/mobile-download");
  assert.equal(noAuth.status, 401);
  assert.equal(upstreamCalls, 0);
  assert.match(noAuth.headers.get("cache-control") ?? "", /no-store/);

  let res = await fetch(webOrigin + "/api/seller/mobile-download",
    { headers: cookie });
  assert.equal(res.status, 403, "under review cannot access seller download");
  approved = true;
  res = await fetch(webOrigin + "/api/seller/mobile-download", { headers: cookie });
  assert.equal(res.status, 403, "review approval cannot bypass activation");
  activated = true;
  res = await fetch(webOrigin + "/api/seller/mobile-download", { headers: cookie });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { available: true, url: sellerUrl, channel: "PREVIEW" });
  assert.match(res.headers.get("cache-control") ?? "", /no-store/);
  suspended = true;
  res = await fetch(webOrigin + "/api/seller/mobile-download", { headers: cookie });
  assert.equal(res.status, 403, "suspended seller must lose download access");
  suspended = false;
  valid = false;
  res = await fetch(webOrigin + "/api/seller/mobile-download", { headers: cookie });
  assert.equal(res.status, 403, "malformed role response cannot enable access");
  console.log("PASS: public buyer entry and gated seller release link");
}

try { await run(); } finally {
  if (web?.pid) {
    try { process.kill(-web.pid, "SIGTERM"); } catch {}
  }
  if (upstream) await new Promise(resolve => upstream.close(resolve));
  rmSync(temp, { recursive: true, force: true });
}
