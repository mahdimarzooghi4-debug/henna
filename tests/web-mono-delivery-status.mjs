import assert from "node:assert/strict";
import test from "node:test";
import { parseMonoDeliveryStatusView } from
  "../apps/web-marketplace/lib/mono-delivery-status.ts";

const orderId = "01234567-89ab-4cde-8fab-0123456789ab";
const valid = {
  orderId,
  correlationState: "REQUEST_RECEIVED",
  deliveryRequestId: "drq_0123456789abcdef0123456789abcdef",
  providerStatus: "RECEIVED",
  missionId: null,
  missionStatus: null,
  committedDeliveryAt: null,
  correlationUpdatedAtUtc: "2026-10-25T12:00:00Z",
  correlationRevision: 2,
  quote: {
    quoteId: "qte_0123456789abcdef0123456789abcdef",
    version: 1,
    expiresAt: "2026-10-25T12:15:00Z",
    isExpired: false,
    distanceMeters: 1500,
    fareToman: 35000,
    buyerShareToman: 17500,
    sellerShareToman: 17500,
  },
  promise: {
    promiseId: "prm_0123456789abcdef0123456789abcdef",
    version: 1,
    committedDeliveryAt: "2026-10-25T15:00:00Z",
    outcome: "ACCEPTED",
  },
};

test("Mono delivery status parser returns only bounded operational fields", () => {
  const parsed = parseMonoDeliveryStatusView({
    ...valid,
    pickup: { address_text: "private address" },
    contact_phone: "+989000000000",
    secret: "never forward",
  });
  assert.deepEqual(parsed, valid);
});

test("Mono delivery status parser rejects mismatched ids, bad state and invalid quote totals", () => {
  assert.equal(parseMonoDeliveryStatusView({
    ...valid, orderId: "not-an-order",
  }), null);
  assert.equal(parseMonoDeliveryStatusView({
    ...valid, correlationState: "DISPATCHED",
  }), null);
  assert.equal(parseMonoDeliveryStatusView({
    ...valid, deliveryRequestId: "drq_invalid",
  }), null);
  assert.equal(parseMonoDeliveryStatusView({
    ...valid, quote: { ...valid.quote, sellerShareToman: 1000 },
  }), null);
  assert.equal(parseMonoDeliveryStatusView({
    ...valid, promise: { ...valid.promise, committedDeliveryAt: "soon" },
  }), null);
});

test("Mono delivery status parser keeps a prepared local correlation distinguishable", () => {
  const parsed = parseMonoDeliveryStatusView({
    ...valid,
    correlationState: "PREPARED",
    deliveryRequestId: null,
    providerStatus: null,
    missionId: null,
    missionStatus: null,
    quote: null,
    promise: null,
  });
  assert.equal(parsed?.correlationState, "PREPARED");
  assert.equal(parsed?.deliveryRequestId, null);
});
