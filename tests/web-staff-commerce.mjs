import assert from "node:assert/strict";
import test from "node:test";
import {
  parseStaffCommerce,
  staffIntent,
  supportEvidenceUrl,
} from "../apps/web-marketplace/lib/staff-commerce.ts";

const ID = "60000000-0000-4000-8000-000000000001";
const ORDER = "60000000-0000-4000-8000-000000000002";
const ITEM = "60000000-0000-4000-8000-000000000003";
const PRODUCT = "60000000-0000-4000-8000-000000000004";
const page = items => ({ items, page: 1, pageSize: 20 });
const order = {
  Id: ORDER,
  BuyerId: "SECRET-BUYER",
  SellerId: "SECRET-SELLER",
  State: "PAID",
  RefundState: "NONE",
  Version: 1,
  TotalRial: 2000,
  CreatedAtUtc: "2026-10-05T03:00:00Z",
  Items: [{
    Id: ITEM,
    OfferId: ID,
    ProductId: PRODUCT,
    ProductName: "کالای تست",
    Quantity: 2,
    UnitPriceRial: 1000,
    RefundedQuantity: 0,
    CashRial: 0,
    CreditRial: 2000,
  }],
};
const incident = {
  Id: ID,
  OrderId: ORDER,
  OrderItemId: ITEM,
  BuyerId: "SECRET-BUYER",
  SellerId: "SECRET-SELLER",
  Type: "DAMAGED_ITEM",
  Quantity: 1,
  EvidenceReference: PRODUCT,
  State: "UNDER_REVIEW",
  ReportedAtUtc: "2026-10-05T03:10:00Z",
  ApprovedAtUtc: null,
  ReturnDueAtUtc: null,
  FirstContactAtUtc: null,
  DoorVisitAtUtc: null,
  CollectedAtUtc: null,
  PenaltyApplied: false,
  RefundRial: 0,
};

test("staff DTOs are bounded and omit private owner fields", () => {
  const orders = parseStaffCommerce("seller", "orders", "GET", page([order]));
  assert.equal(JSON.stringify(orders).includes("SECRET"), false);
  assert.equal(orders?.[0].version, 1);
  const incidents = parseStaffCommerce(
    "support", "incidents", "GET", page([incident]));
  assert.equal(JSON.stringify(incidents).includes("SECRET"), false);
  assert.equal(incidents?.[0].evidenceId, PRODUCT);
  assert.equal(parseStaffCommerce(
    "seller", "orders", "GET", {...page([order]), page: 2}), null);
  assert.equal(parseStaffCommerce(
    "seller", "orders", "GET",
    page([{...order, TotalRial: 1}])), null);
});

test("staff command responses validate the exact shipping shapes", () => {
  const moved = parseStaffCommerce(
    "seller", `orders/${ORDER}/state`, "POST",
    {...order, State: "PREPARING", Version: 2});
  assert.equal(moved?.state, "PREPARING");

  const contacted = parseStaffCommerce(
    "seller", `returns/${ID}/contact`, "POST",
    { incident: {...incident, State: "AWAITING_RETURN",
      FirstContactAtUtc: "2026-10-05T03:20:00Z"}, evidence: "call-log" });
  assert.equal(contacted?.incident.firstContactAtUtc,
    "2026-10-05T03:20:00Z");

  const decision = parseStaffCommerce(
    "support", `incidents/${ID}/decision`, "POST",
    { incident: {...incident, State: "REJECTED"}, reason: "بررسی شد" });
  assert.equal(decision?.incident.state, "REJECTED");
  assert.equal(parseStaffCommerce(
    "support", `incidents/${ID}/decision`, "POST",
    { incident: {...incident, State: "REJECTED"}, reason: "" }), null);
});

test("ambiguous retry intent preserves key and body until input changes", () => {
  const first = staffIntent(null, `orders/${ORDER}/state`,
    { expectedVersion: 1, state: "PREPARING" });
  const same = staffIntent(first, `orders/${ORDER}/state`,
    { expectedVersion: 1, state: "PREPARING" });
  assert.deepEqual(same, first);
  const changed = staffIntent(first, `orders/${ORDER}/state`,
    { expectedVersion: 1, state: "READY_FOR_PICKUP" });
  assert.notEqual(changed.key, first.key);
  assert.equal(supportEvidenceUrl(PRODUCT),
    `/api/support/commerce/evidence/${PRODUCT}`);
  assert.throws(() => supportEvidenceUrl("invalid"));
});
