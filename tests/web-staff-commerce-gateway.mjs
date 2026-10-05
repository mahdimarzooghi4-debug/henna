/** CI-only HTTPS upstream double for staff BFF isolation and command safety. */
import assert from "node:assert/strict";
import { createServer } from "node:https";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temp = mkdtempSync(join(tmpdir(), "henna-staff-gateway-"));
const base = "http://127.0.0.1:3022";
const ID = "60000000-0000-4000-8000-000000000001";
const ORDER = "60000000-0000-4000-8000-000000000002";
const ITEM = "60000000-0000-4000-8000-000000000003";
const PRODUCT = "60000000-0000-4000-8000-000000000004";
const token = "hn1_" + Buffer.alloc(32, 9).toString("base64url");
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
  "base64");
let server, web, logs = "", calls = [], broken = false;

const rawOrder = (state = "PAID", version = 1) => ({
  Id: ORDER, BuyerId: "SECRET-BUYER", SellerId: "SECRET-SELLER",
  State: state, RefundState: "NONE", Version: version, TotalRial: 1000,
  CreatedAtUtc: "2026-10-05T03:00:00Z",
  Items: [{ Id: ITEM, OfferId: ID, ProductId: PRODUCT,
    ProductName: "کالای CI", Quantity: 1, UnitPriceRial: 1000,
    CashRial: 0, CreditRial: 1000, RefundedQuantity: 0 }],
});
const rawIncident = (state = "UNDER_REVIEW") => ({
  Id: ID, OrderId: ORDER, OrderItemId: ITEM,
  BuyerId: "SECRET-BUYER", SellerId: "SECRET-SELLER",
  Type: "DAMAGED_ITEM", Quantity: 1, EvidenceReference: PRODUCT,
  State: state, ReportedAtUtc: "2026-10-05T03:10:00Z",
  ApprovedAtUtc: state === "AWAITING_RETURN" ? "2026-10-05T03:20:00Z" : null,
  ReturnDueAtUtc: state === "AWAITING_RETURN" ? "2026-10-05T04:20:00Z" : null,
  FirstContactAtUtc: null, DoorVisitAtUtc: null, CollectedAtUtc: null,
  PenaltyApplied: false, RefundRial: state === "AWAITING_RETURN" ? 1000 : 0,
});
const rawOffer = (version = 1) => ({
  Id: ID, SellerId: "SECRET-SELLER", ProductId: PRODUCT,
  CategoryId: ITEM, PriceRial: 1400, Stock: 6, Version: version,
  Published: true,
});
const rawSettlement = {
  Id: ID, OrderId: ORDER, SellerId: "SECRET-SELLER",
  GrossRial: 1000, RefundRial: 0, PenaltyRial: 1000,
  FixedFeeRial: 500, FeeVersion: "fee-ci", NetRial: -500,
  State: "FINANCE_REVIEW_REQUIRED",
  CreatedAtUtc: "2026-10-05T03:40:00Z",
};
const rawNotification = (read = false) => ({
  Id: ID, AccountId: "SECRET-SELLER", Code: "SELLER_ORDER_STATE",
  ResourceId: ORDER, CreatedAtUtc: "2026-10-05T03:45:00Z", Read: read,
});
const rawTicket = (state = "OPEN") => ({
  Id: ID, AccountId: "SECRET-SELLER", Subject: "CI support",
  Message: "CI help", State: state,
  CreatedAtUtc: "2026-10-05T03:50:00Z",
  Reply: state === "ANSWERED" ? "CI reply" : null,
});

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
        key: req.headers["idempotency-key"], body,
      });
      assert.equal(req.headers.cookie, undefined);
      assert.equal(req.headers.authorization, "Bearer " + token);
      if (req.url === "/api/v1/evidence/" + PRODUCT) {
        res.writeHead(200, { "Content-Type": "image/png" });
        return res.end(png);
      }
      res.setHeader("Content-Type", "application/json");
      if (broken) return res.end(JSON.stringify({ items: [{ Id: "bad" }],
        page: 1, pageSize: 20 }));
      if (req.method === "GET" && req.url === "/api/v1/seller/orders?page=2")
        return res.end(JSON.stringify({ items: [rawOrder()], page: 2,
          pageSize: 20 }));
      if (req.method === "GET" && req.url === "/api/v1/seller/incidents?page=1")
        return res.end(JSON.stringify({ items: [rawIncident("AWAITING_RETURN")],
          page: 1, pageSize: 20 }));
      if (req.method === "GET" && req.url === "/api/v1/support/incidents?page=1")
        return res.end(JSON.stringify({ items: [rawIncident()],
          page: 1, pageSize: 20 }));
      if (req.method === "GET" && req.url === "/api/v1/seller/offers?page=1")
        return res.end(JSON.stringify({ items: [rawOffer()],
          page: 1, pageSize: 20 }));
      if (req.method === "GET" && req.url === "/api/v1/seller/settlements?page=1")
        return res.end(JSON.stringify({ items: [rawSettlement],
          page: 1, pageSize: 20 }));
      if (req.method === "GET" && req.url === "/api/v1/me/notifications?page=1")
        return res.end(JSON.stringify({ items: [rawNotification()],
          page: 1, pageSize: 20 }));
      if (req.method === "GET" && req.url === "/api/v1/me/tickets?page=1")
        return res.end(JSON.stringify({ items: [rawTicket()],
          page: 1, pageSize: 20 }));
      if (req.method === "POST" && req.url === "/api/v1/seller/offers")
        return res.end(JSON.stringify(rawOffer(2)));
      if (req.method === "POST" &&
          req.url === "/api/v1/me/notifications/" + ID + "/read")
        return res.end(JSON.stringify(rawNotification(true)));
      if (req.method === "POST" && req.url === "/api/v1/support/tickets")
        return res.end(JSON.stringify(rawTicket()));
      if (req.method === "POST" &&
          req.url === "/api/v1/seller/orders/" + ORDER + "/state")
        return res.end(JSON.stringify(rawOrder("PREPARING", 2)));
      if (req.method === "POST" &&
          req.url === "/api/v1/seller/item-returns/" + ID + "/contact")
        return res.end(JSON.stringify({
          incident: {...rawIncident("AWAITING_RETURN"),
            FirstContactAtUtc: "2026-10-05T03:30:00Z"},
          evidence: "call-ci",
        }));
      if (req.method === "POST" &&
          req.url === "/api/v1/support/incidents/" + ID + "/decision") {
        const input = JSON.parse(body);
        return res.end(JSON.stringify({
          incident: rawIncident(
            input.decision === "APPROVE" ? "AWAITING_RETURN" : "REJECTED"),
          reason: input.reason,
        }));
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "missing" }));
    });
  await new Promise(resolve => server.listen(3451, "127.0.0.1", resolve));

  web = spawn("npm", ["run","start","--workspace","@hana/web-marketplace",
    "--","-p","3022","-H","127.0.0.1"], {
      detached: true, stdio: ["ignore","pipe","pipe"],
      env: {...process.env, NEXT_TELEMETRY_DISABLED:"1",
        HANA_API_BASE_URL:"https://127.0.0.1:3451",
        NODE_EXTRA_CA_CERTS:cert},
    });
  web.stdout.on("data", value => logs += value);
  web.stderr.on("data", value => logs += value);
  for (let i = 0; i < 45; i++) {
    if (web.exitCode !== null) throw Error(logs);
    try { if ((await fetch(base + "/auth")).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const cookie = { Cookie: "__Host-hana_session=" + token };
  const sellerGet = path => fetch(base + "/api/seller/commerce/" + path,
    { headers: cookie });
  const supportGet = path => fetch(base + "/api/support/commerce/" + path,
    { headers: cookie });
  const post = (scope, path, body, extra = {}) => fetch(
    base + `/api/${scope}/commerce/${path}`, {
      method: "POST",
      headers: {...cookie, Origin: base, "Content-Type": "application/json",
        "Idempotency-Key": ID, ...extra},
      body: JSON.stringify(body),
    });

  assert.equal((await fetch(base + "/api/seller/commerce/orders")).status, 401);
  assert.equal(calls.length, 0);
  assert.equal((await sellerGet("constructor")).status, 404);
  assert.equal((await sellerGet("orders?page=0")).status, 400);
  assert.equal((await sellerGet("orders?page=1&x=1")).status, 400);
  assert.equal(calls.length, 0);

  const orders = await sellerGet("orders?page=2");
  assert.equal(orders.status, 200);
  const orderBody = await orders.json();
  assert.equal(orderBody[0].state, "PAID");
  assert.equal(JSON.stringify(orderBody).includes("SECRET"), false);
  assert.equal(calls.at(-1).url, "/api/v1/seller/orders?page=2");

  assert.equal((await post("seller", `orders/${ORDER}/state`,
    {expectedVersion:1,state:"PREPARING"},
    {Origin:"https://evil.test"})).status, 403);
  const beforeInvalid = calls.length;
  assert.equal((await post("seller", `orders/${ORDER}/state`,
    {expectedVersion:1,state:"PREPARING"},
    {"Idempotency-Key":"bad"})).status, 400);
  assert.equal(calls.length, beforeInvalid);

  const moved = await post("seller", `orders/${ORDER}/state`,
    {expectedVersion:1,state:"PREPARING"});
  assert.equal(moved.status, 200);
  assert.equal((await moved.json()).version, 2);
  assert.equal(calls.at(-1).key, ID);
  assert.deepEqual(JSON.parse(calls.at(-1).body),
    {expectedVersion:1,state:"PREPARING"});

  const offers = await sellerGet("offers?page=1");
  assert.equal(offers.status, 200);
  const offerBody = await offers.json();
  assert.equal(offerBody[0].stock, 6);
  assert.equal(JSON.stringify(offerBody).includes("SECRET"), false);
  const savedOffer = await post("seller", "offers", {
    offerId: ID, productId: PRODUCT, priceRial: 1400,
    stock: 6, expectedVersion: 1,
  });
  assert.equal(savedOffer.status, 200);
  assert.equal((await savedOffer.json()).version, 2);

  const settlements = await sellerGet("settlements?page=1");
  assert.equal(settlements.status, 200);
  assert.equal((await settlements.json())[0].netRial, -500);

  const alerts = await sellerGet("notifications?page=1");
  assert.equal(alerts.status, 200);
  assert.equal(JSON.stringify(await alerts.json()).includes("SECRET"), false);
  const readAlert = await post("seller", `notifications/${ID}/read`, {});
  assert.equal(readAlert.status, 200);
  assert.equal((await readAlert.json()).read, true);

  const ticketList = await sellerGet("tickets?page=1");
  assert.equal(ticketList.status, 200);
  assert.equal(JSON.stringify(await ticketList.json()).includes("SECRET"), false);
  const openedTicket = await post("seller", "tickets", {
    subject: "CI support", message: "CI help",
  });
  assert.equal(openedTicket.status, 200);
  assert.equal((await openedTicket.json()).state, "OPEN");

  const returns = await sellerGet("returns?page=1");
  assert.equal(returns.status, 200);
  assert.equal((await returns.json())[0].state, "AWAITING_RETURN");
  const contacted = await post("seller", `returns/${ID}/contact`,
    {evidenceReference:"call-ci"});
  assert.equal(contacted.status, 200);
  assert.equal((await contacted.json()).evidence, "call-ci");

  const incidents = await supportGet("incidents?page=1");
  assert.equal(incidents.status, 200);
  const supportBody = await incidents.json();
  assert.equal(supportBody[0].evidenceId, PRODUCT);
  assert.equal(JSON.stringify(supportBody).includes("SECRET"), false);

  const photo = await supportGet("evidence/" + PRODUCT);
  assert.equal(photo.status, 200);
  assert.equal(photo.headers.get("content-type"), "image/png");
  assert.equal(photo.headers.get("x-content-type-options"), "nosniff");
  assert.equal(Buffer.compare(Buffer.from(await photo.arrayBuffer()), png), 0);

  const decided = await post("support", `incidents/${ID}/decision`,
    {decision:"REJECT",reason:"CI reviewed"});
  assert.equal(decided.status, 200);
  assert.equal((await decided.json()).incident.state, "REJECTED");

  broken = true;
  assert.equal((await supportGet("incidents?page=1")).status, 503);

  console.log("Shipping staff BFF passed: cookie isolation, CSRF, scoped seller commerce, finance views, alerts, tickets, private evidence and idempotency.");
}

try { await main(); } finally {
  if (web?.pid) { try { process.kill(-web.pid, "SIGTERM"); } catch {} }
  if (server) await new Promise(resolve => server.close(resolve));
  rmSync(temp, { recursive: true, force: true });
}
