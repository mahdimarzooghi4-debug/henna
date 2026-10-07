import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAllocationOutcomeInput,
  parseAllocationOutcomeResult,
  parseAllocationOutcomes,
  parseOutcomeAssessmentOptions,
} from "../apps/web-marketplace/lib/allocation-outcomes.ts";
import {
  allocationOutcomeDetails,
  clearAllocationOutcomeIntent,
  createAllocationOutcomeIntent,
  persistAllocationOutcomeIntent,
  restoreAllocationOutcomeIntent,
} from "../apps/web-marketplace/lib/web-pending-allocation-outcome.ts";

const eventId = "b8b52eee-b4c3-4ae5-a72a-8a78dd1561c0";
const snapshotId = "c9f0b1f2-7f25-4e88-9ba2-611384e45e90";
const reviewer = "3a1b6d72-487e-4cdc-a834-dc2b4f176cb4";
const start = "2020-10-05T10:00:00.000Z";
const end = "2020-10-05T11:00:00.000Z";
const recorded = "2020-10-05T11:01:00.000Z";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    clear: () => values.clear(),
    key: index => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
}

test("reviewed outcome input keeps unknown values null and requires evidence", () => {
  const input = {
    eventId,
    snapshotId,
    periodStartUtc: start,
    periodEndUtc: end,
    essentialNeedsCoverage: 0.75,
    stockBarrier: true,
    deliveryBarrier: null,
    accessBarrier: false,
    evidenceReference: "  reviewed-case:42  ",
  };
  assert.deepEqual(
    parseAllocationOutcomeInput(input, Date.parse(recorded)),
    { ...input, evidenceReference: "reviewed-case:42" },
  );
  assert.equal(parseAllocationOutcomeInput({
    ...input,
    essentialNeedsCoverage: null,
    stockBarrier: null,
    deliveryBarrier: null,
    accessBarrier: null,
  }, Date.parse(recorded)), null);
  assert.equal(parseAllocationOutcomeInput({
    ...input,
    periodEndUtc: "2030-01-01T00:00:00.000Z",
  }, Date.parse(recorded)), null);
});

test("outcome history distinguishes administrative from human-reviewed evidence", () => {
  const reviewed = {
    id: eventId,
    snapshotId,
    periodStartUtc: start,
    periodEndUtc: end,
    creditUsedRial: null,
    essentialNeedsCoverage: 0.75,
    stockBarrier: true,
    deliveryBarrier: null,
    accessBarrier: false,
    evidence: 3,
    reviewedByAccountId: reviewer,
    evidenceReference: "reviewed-case:42",
    recordedAtUtc: recorded,
  };
  const administrative = {
    ...reviewed,
    id: "d9d52eee-b4c3-4ae5-a72a-8a78dd1561c0",
    creditUsedRial: 500,
    essentialNeedsCoverage: null,
    stockBarrier: null,
    accessBarrier: null,
    evidence: 1,
    reviewedByAccountId: null,
    evidenceReference: null,
  };
  assert.deepEqual(
    parseAllocationOutcomes({
      items: [reviewed, administrative],
      page: 1,
      active: false,
    })?.items,
    [reviewed, administrative],
  );
  assert.equal(parseAllocationOutcomes({
    items: [{ ...reviewed, creditUsedRial: 1 }],
    page: 1,
    active: false,
  }), null);
  assert.deepEqual(parseAllocationOutcomeResult({
    id: eventId,
    snapshotId,
    evidence: "HUMAN_REVIEWED",
    active: false,
    replayed: false,
  }), {
    id: eventId,
    snapshotId,
    evidence: "HUMAN_REVIEWED",
    active: false,
    replayed: false,
  });
});

test("outcome snapshot choices fail closed on missing lineage metadata", () => {
  const payload = {
    items: [{
      id: snapshotId,
      datasetVersion: "henna-v1",
      sourceInstructionReference: "henna-program:one",
      assessedAtUtc: start,
      trainingEligible: true,
    }],
    page: 1,
    active: false,
  };
  assert.deepEqual(parseOutcomeAssessmentOptions(payload), payload);
  assert.equal(parseOutcomeAssessmentOptions({
    ...payload,
    items: [{ ...payload.items[0], trainingEligible: "yes" }],
  }), null);
});

test("pending outcome preserves exact EventId and canonical body", () => {
  const previousWindow = globalThis.window;
  const store = memoryStorage();
  Object.defineProperty(globalThis, "window", {
    value: { sessionStorage: store },
    configurable: true,
    writable: true,
  });
  try {
    const intent = createAllocationOutcomeIntent({
      snapshotId,
      periodStartUtc: start,
      periodEndUtc: end,
      essentialNeedsCoverage: null,
      stockBarrier: true,
      deliveryBarrier: null,
      accessBarrier: false,
      evidenceReference: "case:42",
    });
    const details = allocationOutcomeDetails(intent);
    assert.ok(details);
    assert.match(details.eventId, /^[0-9a-f-]{36}$/i);
    persistAllocationOutcomeIntent(intent);
    assert.deepEqual(restoreAllocationOutcomeIntent(), intent);
    persistAllocationOutcomeIntent(intent);

    const other = createAllocationOutcomeIntent({
      snapshotId,
      periodStartUtc: start,
      periodEndUtc: end,
      essentialNeedsCoverage: 0.5,
      stockBarrier: null,
      deliveryBarrier: null,
      accessBarrier: null,
      evidenceReference: "case:43",
    });
    assert.throws(
      () => persistAllocationOutcomeIntent(other),
      /must be resolved first/,
    );
    assert.equal(clearAllocationOutcomeIntent(other.body), false);
    assert.equal(clearAllocationOutcomeIntent(details.eventId), true);
    assert.equal(restoreAllocationOutcomeIntent(), null);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
