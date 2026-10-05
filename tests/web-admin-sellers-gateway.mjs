import assert from "node:assert/strict";
import { createServer } from "node:https";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temp = mkdtempSync(join(tmpdir(), "henna-admin-seller-"));
const base = "http://127.0.0.1:3024";
const ID = "60000000-0000-4000-8000-000000000041";
const token = "hn1_" + Buffer.alloc(32, 5).toString("base64url");
let server, web, logs = "", calls = [];
let revision = 7, reviewStatus = "UNDER_REVIEW", activatedAtUtc = null;

function application() {
  return {
    applicationId: ID,
    storeName: "فروشگاه CI",
    ownerName: "مالک CI",
    applicantType: "NATURAL",
    identityStatus: "VERIFIED",
    nationalCodeMasked: "******1234",
    legalNationalId: null,
    legalName: null,
    legalRepresentativeName: null,
    legalRepresentativePhoneMasked: null,
    businessCategoryId: "60000000-0000-4000-8000-000000000042",
    businessName: "کسب‌وکار CI",
    businessDescription: "شرح کسب‌وکار",
    businessPhone: "02112345678",
    offeringType: "GOOD",
    activityProvinceId: "60000000-0000-4000-8000-000000000043",
    activityCityId: "60000000-0000-4000-8000-000000000044",
    activityAddress: "نشانی فعالیت",
    activityHours: "شنبه تا پنجشنبه",
    sellerDelivery: false,
    pickup: true,
    serviceArea: "شهر CI",
    registrationContactName: "تماس CI",
    registrationContactRole: "مالک",
    backupPhoneMasked: null,
    websiteOrSocial: null,
    businessEmail: null,
    responseHours: "۹ تا ۱۸",
    documentsRequired: false,
    phoneMasked: "0912*******",
    city: "شهر CI",
    address: "نشانی CI",
    postalCode: "1234567890",
    status: "SUBMITTED",
    revision,
    trackingCode: "HNA-A1B2C3D4E5F60718",
    reviewStatus,
    reviewReason: reviewStatus === "UNDER_REVIEW" ? null : "بررسی CI",
    reviewedAtUtc: reviewStatus === "UNDER_REVIEW" ? null : "2026-10-05T03:20:00Z",
    activatedAtUtc,
    activatedByAccountId: activatedAtUtc
      ? "60000000-0000-4000-8000-000000000045" : null,
    submittedAtUtc: "2026-10-05T03:00:00Z",
    secretInternalNote: "MUST-NOT-LEAK",
  };
}
function listItem() {
  const x = application();
  return {
    applicationId: x.applicationId,
    storeName: x.storeName,
    ownerName: x.ownerName,
    applicantType: x.applicantType,
    identityStatus: x.identityStatus,
    businessCategoryId: x.businessCategoryId,
    businessName: x.businessName,
    offeringType: x.offeringType,
    status: x.status,
    revision: x.revision,
    trackingCode: x.trackingCode,
    reviewStatus: x.reviewStatus,
    reviewedAtUtc: x.reviewedAtUtc,
    activatedAtUtc: x.activatedAtUtc,
    submittedAtUtc: x.submittedAtUtc,
  };
}

async function main() {
  const cert = join(temp, "tls.crt"), key = join(temp, "tls.key");
  assert.equal(spawnSync("openssl", [
    "req","-x509","-newkey","rsa:2048","-nodes","-keyout",key,"-out",cert,
    "-days","1","-subj","/CN=127.0.0.1",
    "-addext","subjectAltName=IP:127.0.0.1",
  ], { stdio: "ignore" }).status, 0);

  server = createServer({ key: readFileSync(key), cert: readFileSync(cert) },
    async (req, res) => {
      let body = "";
      for await (const chunk of req) body += chunk;
      calls.push({
        url: req.url, method: req.method,
        cookie: req.headers.cookie,
        authorization: req.headers.authorization,
        key: req.headers["idempotency-key"],
        body,
      });
      assert.equal(req.headers.cookie, undefined);
      assert.equal(req.headers.authorization, "Bearer " + token);
      res.setHeader("Content-Type", "application/json");
      if (req.method === "GET" &&
          req.url === "/api/v1/admin/seller-applications?page=1&pageSize=20")
        return res.end(JSON.stringify({
          items: [listItem()], page: 1, pageSize: 20, total: 1,
        }));
      if (req.method === "GET" &&
          req.url === "/api/v1/admin/seller-applications/" + ID)
        return res.end(JSON.stringify(application()));
      if (req.method === "POST" &&
          req.url === "/api/v1/admin/seller-applications/" + ID + "/review") {
        const input = JSON.parse(body);
        assert.deepEqual(input, {
          revision: 7, decision: "APPROVED", reason: "بررسی CI",
        });
        revision = 8;
        reviewStatus = "APPROVED";
        return res.end(JSON.stringify({
          applicationId: ID, status: "SUBMITTED", revision,
          trackingCode: "HNA-A1B2C3D4E5F60718",
          reviewStatus, reviewReason: "بررسی CI",
          reviewedAtUtc: "2026-10-05T03:20:00Z",
          sellerActivated: false,
        }));
      }
      if (req.method === "POST" &&
          req.url === "/api/v1/admin/seller-applications/" + ID + "/activate") {
        assert.deepEqual(JSON.parse(body), { revision: 8 });
        revision = 9;
        activatedAtUtc = "2026-10-05T03:30:00Z";
        return res.end(JSON.stringify({
          applicationId: ID, revision,
          trackingCode: "HNA-A1B2C3D4E5F60718",
          reviewStatus,
          activatedAtUtc,
          sellerRoleGranted: true,
          sellerAccessEnabled: true,
          sellerPanelEnabled: true,
        }));
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ message: "missing" }));
    });
  await new Promise(resolve => server.listen(3453, "127.0.0.1", resolve));

  web = spawn("npm", ["run","start","--workspace","@hana/web-marketplace",
    "--","-p","3024","-H","127.0.0.1"], {
      detached: true, stdio: ["ignore","pipe","pipe"],
      env: {...process.env, NEXT_TELEMETRY_DISABLED:"1",
        HANA_API_BASE_URL:"https://127.0.0.1:3453",
        NODE_EXTRA_CA_CERTS:cert},
    });
  web.stdout.on("data", value => logs += value);
  web.stderr.on("data", value => logs += value);
  for (let i = 0; i < 45; i++) {
    if (web.exitCode !== null) throw Error(logs);
    try { if ((await fetch(base + "/auth")).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  assert.equal((await fetch(base + "/api/admin/seller-applications")).status, 401);
  assert.equal(calls.length, 0);

  const cookie = { Cookie: "__Host-hana_session=" + token };
  assert.equal((await fetch(
    base + "/api/admin/seller-applications?page=0",
    { headers: cookie })).status, 400);
  assert.equal(calls.length, 0);

  const list = await fetch(base + "/api/admin/seller-applications?page=1",
    { headers: cookie });
  assert.equal(list.status, 200);
  const listBody = await list.json();
  assert.equal(listBody.items[0].id, ID);
  assert.equal(JSON.stringify(listBody).includes("MUST-NOT-LEAK"), false);

  const detail = await fetch(base + "/api/admin/seller-applications/" + ID,
    { headers: cookie });
  assert.equal(detail.status, 200);
  const detailBody = await detail.json();
  assert.equal(detailBody.ownerName, "مالک CI");
  assert.equal(JSON.stringify(detailBody).includes("MUST-NOT-LEAK"), false);

  const badOrigin = await fetch(
    base + "/api/admin/seller-applications/" + ID + "/review", {
      method: "POST",
      headers: {...cookie, Origin:"https://evil.test",
        "Content-Type":"application/json","Idempotency-Key":ID},
      body: JSON.stringify({
        revision:7, decision:"APPROVED", reason:"بررسی CI",
      }),
    });
  assert.equal(badOrigin.status, 403);

  const review = await fetch(
    base + "/api/admin/seller-applications/" + ID + "/review", {
      method: "POST",
      headers: {...cookie, Origin:base,
        "Content-Type":"application/json","Idempotency-Key":ID},
      body: JSON.stringify({
        revision:7, decision:"APPROVED", reason:"بررسی CI",
      }),
    });
  assert.equal(review.status, 200);
  assert.equal((await review.json()).reviewStatus, "APPROVED");
  assert.equal(calls.at(-1).key, ID);

  const activate = await fetch(
    base + "/api/admin/seller-applications/" + ID + "/activate", {
      method: "POST",
      headers: {...cookie, Origin:base,
        "Content-Type":"application/json","Idempotency-Key":
          "60000000-0000-4000-8000-000000000046"},
      body: JSON.stringify({ revision:8 }),
    });
  assert.equal(activate.status, 200);
  const activated = await activate.json();
  assert.equal(activated.sellerPanelEnabled, true);
  assert.equal(activated.revision, 9);

  console.log("Admin seller BFF passed: cookie isolation, CSRF, bounded DTO and review/activation idempotency.");
}

try { await main(); } finally {
  if (web?.pid) { try { process.kill(-web.pid, "SIGTERM"); } catch {} }
  if (server) await new Promise(resolve => server.close(resolve));
  rmSync(temp, { recursive: true, force: true });
}
