import test from "node:test";
import assert from "node:assert/strict";
import {
  demoSettlementRows, demoSettlementStatusLabels,
  demoSettlementSummary, formatDemoToman,
} from "../apps/web-marketplace/lib/seller-settlements-preview.ts";

test("synthetic settlement statuses, labels, and summary remain internally consistent", () => {
  assert.equal(demoSettlementRows.length, 4);
  assert.equal(new Set(demoSettlementRows.map((row) => row.id)).size, demoSettlementRows.length);
  assert.deepEqual(demoSettlementSummary, {
    settledToman: 1_890_000,
    pendingToman: 640_000,
    eligibleOrders: 4,
  });
  for (const row of demoSettlementRows) {
    assert.ok(row.id.startsWith("ST-1405-"));
    assert.ok(Number.isSafeInteger(row.amountToman) && row.amountToman > 0);
    assert.ok(demoSettlementStatusLabels[row.status]);
    assert.equal(row.status === "ELIGIBLE", row.eligibleOrderCount > 0);
  }
  assert.match(formatDemoToman(demoSettlementSummary.settledToman), /تومان$/);
});
