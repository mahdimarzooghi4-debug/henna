// CI-only upstream fixtures: no production applicants or credentials.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:https";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const applicationId = "123e4567-e89b-42d3-a456-426614174000";
const malformedId = "123e4567-e89b-42d3-a456-426614174010";
const categoryId = "123e4567-e89b-42d3-a456-426614174005";
const provinceId = "123e4567-e89b-42d3-a456-426614174006";
const cityId = "123e4567-e89b-42d3-a456-426614174007";
const adminId = "123e4567-e89b-42d3-a456-426614174008";
const applicantId = "123e4567-e89b-42d3-a456-426614174009";
const token = "hn1_" + "A".repeat(43);
const nonAdminToken = "hn1_" + "B".repeat(43);
const at = "2026-09-26T10:00:00+00:00";
const dir = mkdtempSync(join(tmpdir(), "hana-admin-apps-bff-"));
const cert = join(dir, "cert.pem"), privateKey = join(dir, "key.pem");
let server, next, output = "", upstreamCalls = 0;
const reviewKeys = [];

const summary = {
  applicationId, storeName: "فروشگاه آزمون", ownerName: "متقاضی آزمون",
  applicantType: "NATURAL", identityStatus: "VERIFIED",
  businessCategoryId: categoryId, businessName: "کسب‌وکار آزمون",
  offeringType: "GOOD", status: "SUBMITTED", revision: 3,
  trackingCode: "HNA-A1B2C3D4E5F60718", reviewStatus: "NEEDS_INFORMATION",
  reviewedAtUtc: at, activatedAtUtc: null, submittedAtUtc: at,
};
const browserSummary = { ...summary };
delete browserSummary.activatedAtUtc;
const detail = {
  ...summary,
  nationalCodeMasked: "******5948", legalNationalIdMasked: null,
  legalName: null, legalRepresentativeName: null,
  legalRepresentativePhoneMasked: null,
  businessDescription: "توضیح آزمون", businessPhone: "02112345678",
  activityProvinceId: provinceId, activityCityId: cityId,
  activityAddress: "نشانی فعالیت آزمون", activityHours: "۸ تا ۲۲",
  sellerDelivery: true, pickup: true, serviceArea: "تهران",
  registrationContactName: "مسئول آزمون", registrationContactRole: null,
  backupPhoneMasked: null, websiteOrSocial: null,
  businessEmail: "review@example.test", responseHours: "۸ تا ۲۲",
  documentsRequired: false, phoneMasked: "0912*******", city: "تهران",
  address: "نشانی آزمون", postalCode: "1234567890",
  reviewReason: "اطلاعات تکمیلی لازم است.", activatedByAccountId: adminId,
  reviewHistory: [{ expectedRevision: 2, decision: "NEEDS_INFORMATION",
    reason: "اطلاعات تکمیلی لازم است.", createdAtUtc: at }],
};

try {
  const certResult = spawnSync("openssl", ["req", "-x509", "-newkey", "rsa:2048",
    "-nodes", "-keyout", privateKey, "-out", cert, "-days", "1",
    "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1"],
    { stdio: "ignore" });
  assert.equal(certResult.status, 0);
  server = createServer({ cert: readFileSync(cert), key: readFileSync(privateKey) },
    async (req, res) => {
      upstreamCalls++;
      assert.equal(req.headers.cookie, undefined, "browser cookie must not reach API");
      assert.equal(req.headers.accept, "application/json");
      const url = new URL(req.url, "https://127.0.0.1:5202");
      if (req.headers.authorization === `Bearer ${nonAdminToken}`) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Admin role missing" }));
        return;
      }
      assert.equal(req.headers.authorization, `Bearer ${token}`);
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      if (req.method === "GET" && url.pathname === "/api/v1/admin/seller-applications") {
        assert.equal(url.searchParams.get("page"), "2");
        assert.equal(url.searchParams.get("pageSize"), "10");
        assert.equal(url.searchParams.get("reviewStatus"), "NEEDS_INFORMATION");
        res.writeHead(200);
        res.end(JSON.stringify({ items: [summary], page: 2, pageSize: 10, total: 1 }));
        return;
      }
      if (req.method === "GET" &&
        url.pathname.startsWith("/api/v1/admin/seller-applications/")) {
        res.writeHead(200);
        res.end(JSON.stringify(url.pathname.endsWith(malformedId)
          ? { ...detail, naturalNationalCode: "0084575948" }
          : detail));
        return;
      }
      if (req.method === "POST" &&
        url.pathname === `/api/v1/admin/seller-applications/${applicationId}/review`) {
        assert.match(req.headers["idempotency-key"] ?? "",
          /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        reviewKeys.push(req.headers["idempotency-key"]);
        let raw = "";
        for await (const part of req) raw += part.toString();
        assert.deepEqual(JSON.parse(raw), {
          revision: 3, decision: "NEEDS_INFORMATION",
          reason: "اطلاعات تکمیلی لازم است.",
        });
        res.writeHead(200);
        res.end(JSON.stringify({
          applicationId, status: "SUBMITTED", revision: 4,
          trackingCode: summary.trackingCode,
          reviewStatus: "NEEDS_INFORMATION",
          reviewReason: "اطلاعات تکمیلی لازم است.", reviewedAtUtc: at,
          sellerActivated: false,
        }));
        return;
      }
      res.writeHead(404); res.end("{}");
    });
  await new Promise(resolve => server.listen(5202, "127.0.0.1", resolve));
  next = spawn("npm", ["run", "start", "--workspace", "@hana/web-marketplace",
    "--", "-p", "3003", "-H", "127.0.0.1"], { detached: true,
    stdio: ["ignore", "pipe", "pipe"], env: { ...process.env,
      NODE_EXTRA_CA_CERTS: cert, HANA_API_BASE_URL: "https://127.0.0.1:5202",
      NEXT_TELEMETRY_DISABLED: "1" } });
  next.stdout.on("data", part => output += part.toString());
  next.stderr.on("data", part => output += part.toString());
  const base = "http://127.0.0.1:3003";
  let ready = false;
  for (let n = 0; n < 45; n++) {
    if (next.exitCode !== null) break;
    try {
      if ((await fetch(base + "/auth", { signal: AbortSignal.timeout(1000) })).ok) {
        ready = true; break;
      }
    } catch { }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(ready, "Next did not start: " + output);
  const cookie = `__Host-hana_session=${token}`;
  const list = await fetch(base + "/api/admin/seller-applications?page=2&pageSize=10&reviewStatus=needs_information",
    { headers: { Cookie: cookie } });
  assert.equal(list.status, 200);
  assert.equal(list.headers.get("cache-control"), "no-store");
  assert.deepEqual(await list.json(), {
    items: [browserSummary], page: 2, pageSize: 10, total: 1,
  });

  const application = await fetch(base + "/api/admin/seller-applications/" + applicationId,
    { headers: { Cookie: cookie } });
  assert.equal(application.status, 200);
  assert.equal(application.headers.get("cache-control"), "no-store");
  const body = await application.json();
  assert.equal(body.nationalCodeMasked, "******5948");
  assert.equal(body.reviewHistory[0].reason, "اطلاعات تکمیلی لازم است.");
  assert.equal(body.documentsRequired, false);
  assert.equal(Object.hasOwn(body, "legalNationalId"), false);
  assert.equal(Object.hasOwn(body, "activatedByAccountId"), false);
  assert.equal(Object.hasOwn(body, "activatedAtUtc"), false);
  assert.equal(Object.hasOwn(body.reviewHistory[0], "decisionKey"), false);
  assert.equal(JSON.stringify(body).includes(token), false);

  const reviewPath = base + "/api/admin/seller-applications/" +
    applicationId + "/review";
  const submitReview = () => fetch(reviewPath, { method: "POST",
    headers: { Cookie: cookie, Origin: base, "Content-Type": "application/json",
    },
    body: JSON.stringify({ revision: 3, decision: "NEEDS_INFORMATION",
      reason: "اطلاعات تکمیلی لازم است." }) });
  const reviewed = await submitReview();
  assert.equal(reviewed.status, 200);
  assert.equal(reviewed.headers.get("cache-control"), "no-store");
  const reviewResult = await reviewed.json();
  assert.equal(reviewResult.reviewStatus, "NEEDS_INFORMATION");
  assert.equal(reviewed.headers.get("cache-control"), "no-store");
  assert.equal(Object.hasOwn(reviewResult, "sellerActivated"), false);
  assert.equal(Object.hasOwn(reviewResult, "idempotencyKey"), false);
  assert.equal(JSON.stringify(reviewResult).includes(reviewKeys[0]), false,
    "the server-only idempotency key must not be returned to the browser");
  assert.deepEqual(await (await submitReview()).json(), reviewResult,
    "same-key retry must preserve the confirmed response");
  assert.equal(reviewKeys.length, 2);
  assert.equal(reviewKeys[0], reviewKeys[1],
    "the BFF must derive one stable server-only key for an identical retry");
  const malformed = await fetch(
    base + "/api/admin/seller-applications/" + malformedId,
    { headers: { Cookie: cookie } });
  assert.equal(malformed.status, 503,
    "unexpected raw identifier fields must fail closed");
  assert.equal(malformed.headers.get("cache-control"), "no-store");

  const beforeRejected = upstreamCalls;
  for (const path of [
    "/api/admin/seller-applications?reviewStatus=INCOMPLETE",
    "/api/admin/seller-applications?page=1&page=2",
    "/api/admin/seller-applications?accountId=" + applicantId,
    "/api/admin/seller-applications/" + applicationId + "?debug=true",
  ]) {
    const response = await fetch(base + path, { headers: { Cookie: cookie } });
    assert.equal(response.status, 400, path);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  assert.equal((await fetch(base + "/api/admin/seller-applications")).status, 401);
  assert.equal((await fetch(base + "/api/admin/seller-applications",
    { headers: { Cookie: `__Host-hana_session=${nonAdminToken}` } })).status, 403);
  const invalidReview = await fetch(reviewPath, { method: "POST",
    headers: { Cookie: cookie, Origin: "https://malicious.test",
      "Content-Type": "application/json" },
    body: JSON.stringify({ revision: 3, decision: "NEEDS_INFORMATION",
      reason: "اطلاعات تکمیلی لازم است." }) });
  assert.equal(invalidReview.status, 403);
  const missingReason = await fetch(reviewPath, { method: "POST",
    headers: { Cookie: cookie, Origin: base, "Content-Type": "application/json",
    },
    body: JSON.stringify({ revision: 3, decision: "NEEDS_INFORMATION" }) });
  assert.equal(missingReason.status, 400);
  assert.equal(upstreamCalls, beforeRejected + 1,
    "invalid and anonymous requests must not reach upstream");
  console.log("Admin Seller Applications BFF CI: HttpOnly cookie isolation, Admin authorization, DTO allowlists, masked identifiers and no-store verified");
} finally {
  if (next?.pid) { try { process.kill(-next.pid, "SIGTERM"); } catch { } }
  if (server) await new Promise(resolve => server.close(resolve));
  rmSync(dir, { recursive: true, force: true });
}
