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
const offer = {
  Id: ID, SellerId: "SECRET-SELLER", ProductId: PRODUCT,
  CategoryId: ITEM, PriceRial: 1500, Stock: 4, Version: 2, Published: true,
};
const serviceListing = {
  Id: ORDER, SellerId: "SECRET-SELLER", ProductId: PRODUCT,
  CategoryId: ITEM, PriceRial: 2500,
  AvailabilityNote: "شنبه تا چهارشنبه با هماهنگی",
  Version: 3, Published: true,
};
const settlement = {
  Id: ID, OrderId: ORDER, SellerId: "SECRET-SELLER",
  GrossRial: 1000, RefundRial: 0, PenaltyRial: 1000,
  FixedFeeRial: 500, FeeVersion: "fee-v1", NetRial: -500,
  State: "FINANCE_REVIEW_REQUIRED",
  CreatedAtUtc: "2026-10-05T03:30:00Z",
};
const notification = {
  Id: ID, AccountId: "SECRET-SELLER", Code: "SELLER_ORDER_STATE",
  ResourceId: ORDER, CreatedAtUtc: "2026-10-05T03:40:00Z", Read: false,
};
const ticket = {
  Id: ID, AccountId: "SECRET-SELLER", Subject: "کمک",
  Message: "متن درخواست", State: "OPEN",
  CreatedAtUtc: "2026-10-05T03:50:00Z", Reply: null,
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

  const offers = parseStaffCommerce("seller", "offers", "GET", page([offer]));
  assert.equal(offers?.[0].stock, 4);
  const services = parseStaffCommerce(
    "seller", "service-listings", "GET", page([serviceListing]));
  assert.equal(services?.[0].availabilityNote,
    "شنبه تا چهارشنبه با هماهنگی");
  assert.equal(JSON.stringify(services).includes("SECRET"), false);
  assert.equal(JSON.stringify(offers).includes("SECRET"), false);
  const settlements = parseStaffCommerce(
    "seller", "settlements", "GET", page([settlement]));
  assert.equal(settlements?.[0].netRial, -500);
  const notifications = parseStaffCommerce(
    "seller", "notifications", "GET", page([notification]));
  assert.equal(notifications?.[0].read, false);
  const tickets = parseStaffCommerce(
    "seller", "tickets", "GET", page([ticket]));
  assert.equal(tickets?.[0].subject, "کمک");
  assert.equal(JSON.stringify(tickets).includes("SECRET"), false);

  const report = parseStaffCommerce("seller", "report", "GET", {
    orders: 5, paid: 1, preparing: 1, readyForPickup: 1, collected: 1,
    cancelled: 1, grossRial: 9000, openIncidents: 1,
    incidentRefundRial: 1000, preparedSettlements: 2,
    settlementGrossRial: 7000, settlementRefundRial: 1000,
    settlementPenaltyRial: 500, settlementFeeRial: 200,
    settlementNetRial: 5300, financeReviewRequired: 1,
    buyerIds: ["SECRET-BUYER"],
  });
  assert.equal(report?.settlementNetRial, 5300);
  assert.equal(JSON.stringify(report).includes("SECRET"), false);
  assert.equal(parseStaffCommerce("seller", "report", "GET", {
    orders: 1, paid: 1, preparing: 1, readyForPickup: 0, collected: 0,
    cancelled: 0, grossRial: 1, openIncidents: 0, incidentRefundRial: 0,
    preparedSettlements: 0, settlementGrossRial: 0, settlementRefundRial: 0,
    settlementPenaltyRial: 0, settlementFeeRial: 0,
    settlementNetRial: 0, financeReviewRequired: 0,
  }), null);
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

  assert.equal(parseStaffCommerce(
    "seller", "offers", "POST", {...offer, Version: 3})?.version, 3);
  assert.equal(parseStaffCommerce(
    "seller", "service-listings", "POST",
    {...serviceListing, Version: 4})?.version, 4);
  assert.equal(parseStaffCommerce(
    "seller", "tickets", "POST", {...ticket, State: "ANSWERED",
      Reply: "پاسخ"})?.state, "ANSWERED");
  assert.equal(parseStaffCommerce(
    "seller", `notifications/${ID}/read`, "POST",
    {...notification, Read: true})?.read, true);
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
