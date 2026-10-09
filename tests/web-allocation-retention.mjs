import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAllocationRetentionEvents,
  parseAllocationRetentionPreview,
  parseAllocationRetentionResult,
} from "../apps/web-marketplace/lib/allocation-retention.ts";
import {
  allocationRetentionDetails,
  clearAllocationRetentionIntent,
  createAllocationRetentionIntent,
  persistAllocationRetentionIntent,
  restoreAllocationRetentionIntent,
} from "../apps/web-marketplace/lib/web-pending-allocation-retention.ts";

const id = "b8b52eee-b4c3-4ae5-a72a-8a78dd1561c0";
const actor = "c9f0b1f2-7f25-4e88-9ba2-611384e45e90";
const cutoff = "2026-10-05T10:30:00.000Z";
const digest = "a".repeat(64);

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

test("retention DTOs reject active, malformed or non-canonical responses", () => {
  const preview = {
    scope: "ATTRIBUTED_RESEARCH",
    cutoffUtc: cutoff,
    totalEligibleSnapshotCount: 7,
    selectedSnapshotCount: 5,
    selectedOutcomeCount: 2,
    truncated: true,
    previewDigest: digest,
    active: false,
  };
  assert.deepEqual(parseAllocationRetentionPreview(preview), preview);
  assert.equal(parseAllocationRetentionPreview({ ...preview, active: true }), null);
  assert.equal(parseAllocationRetentionPreview({
    ...preview, selectedSnapshotCount: 8,
  }), null);
  assert.equal(parseAllocationRetentionPreview({
    ...preview, previewDigest: "A".repeat(64),
  }), null);
  assert.deepEqual(parseAllocationRetentionPreview({
    ...preview, cutoffUtc: "2026-10-05T10:30:00+00:00",
  })?.cutoffUtc, "2026-10-05T10:30:00+00:00");
  assert.equal(parseAllocationRetentionPreview({
    ...preview, cutoffUtc: "2026-10-05T14:30:00+04:00",
  }), null);

  const result = {
    eventId: id,
    deletedSnapshotCount: 5,
    deletedOutcomeCount: 2,
    previewDigest: digest,
    active: false,
  };
  assert.deepEqual(parseAllocationRetentionResult(result), result);
  assert.equal(parseAllocationRetentionResult({
    ...result, deletedSnapshotCount: 0,
  }), null);

  const events = {
    items: [{
      id,
      actorAccountId: actor,
      scope: "ATTRIBUTED_RESEARCH",
      cutoffUtc: cutoff,
      deletedSnapshotCount: 5,
      deletedOutcomeCount: 2,
      reason: "مصوب",
      recordedAtUtc: "2026-10-06T10:30:00.000Z",
    }],
    page: 1,
    active: false,
  };
  assert.deepEqual(parseAllocationRetentionEvents(events), events);
  assert.equal(parseAllocationRetentionEvents({
    ...events,
    items: [{ ...events.items[0], actorAccountId: "not-a-uuid" }],
  }), null);
});

test("durable retention intent preserves exact key and canonical body", () => {
  const store = memoryStorage();
  globalThis.window = { sessionStorage: store };
  const intent = createAllocationRetentionIntent(
    cutoff,
    digest,
    "  حذف پژوهشی مصوب  ",
  );
  const details = allocationRetentionDetails(intent);
  assert.deepEqual(details, {
    cutoffUtc: cutoff,
    previewDigest: digest,
    reason: "حذف پژوهشی مصوب",
  });

  persistAllocationRetentionIntent(intent);
  assert.deepEqual(restoreAllocationRetentionIntent(), intent);
  persistAllocationRetentionIntent(intent);

  const other = createAllocationRetentionIntent(
    cutoff,
    digest,
    "درخواست دیگر",
  );
  assert.throws(
    () => persistAllocationRetentionIntent(other),
    /must be resolved first/,
  );

  assert.equal(clearAllocationRetentionIntent(other.key), false);
  assert.equal(clearAllocationRetentionIntent(intent.key), true);
  assert.equal(restoreAllocationRetentionIntent(), null);
});

test("corrupt or divergent local retention state fails closed", () => {
  const store = memoryStorage();
  globalThis.window = { sessionStorage: store };
  store.setItem("hana.admin.allocation-retention.pending.v1", "{bad");
  assert.throws(
    () => restoreAllocationRetentionIntent(),
    /invalid/,
  );

  store.clear();
  const intent = {
    key: crypto.randomUUID(),
    body: JSON.stringify({
      previewDigest: digest,
      cutoffUtc: cutoff,
      reason: "wrong key order",
    }),
  };
  assert.equal(allocationRetentionDetails(intent), null);
  assert.throws(
    () => persistAllocationRetentionIntent(intent),
    /invalid/,
  );
});
