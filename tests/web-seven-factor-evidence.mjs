import assert from "node:assert/strict";
import test from "node:test";
import { parseSevenFactorInventory, parseSevenFactorPreview,
  sevenFactorFormula, sevenFactorAdmission, sevenFactorManifest } from
  "../apps/web-marketplace/lib/seven-factor-evidence.ts";

const id = "b8b52eee-b4c3-4ae5-a72a-8a78dd1561c0";
const timestamp = "2026-10-09T12:00:00.000Z";
const inactive = { formulaVersion: sevenFactorFormula, admissionStatus: sevenFactorAdmission,
  active: false, admitted: false, runtimeApplied: false };
const item = { id, reviewedAtUtc: timestamp, formulaVersion: sevenFactorFormula,
  hasQualitativeReview: true };
const inventory = { ...inactive, items: [item], page: 1, hasMore: false };
const preview = { ...inactive, manifestContractVersion: sevenFactorManifest,
  sourceFormulaVersion: "henna-formula-v1", sourceDatasetVersion: "first-party-v1",
  sourceInstructionReference: "authorized-instruction", cutoffUtc: timestamp,
  reviewedHouseholdCount: 1, sha256: "a".repeat(64) };

test("v1.1 evidence parser accepts exactly bounded read-only inventory", () => {
  const parsed = parseSevenFactorInventory(inventory);
  assert.ok(parsed);
  assert.equal(parsed.items[0].hasQualitativeReview, true);
  assert.equal(parsed.admitted, false);
  assert.equal(parsed.active, false);
  assert.equal(parsed.runtimeApplied, false);
});
test("v1.1 evidence parser rejects fabricated admission, duplicate IDs and unrelated versions", () => {
  for (const change of [{ admitted: true }, { active: true }, { runtimeApplied: true },
    { admissionStatus: "APPROVED" }, { formulaVersion: "HANA-v1" }])
    assert.equal(parseSevenFactorInventory({ ...inventory, ...change }), null);
  assert.equal(parseSevenFactorInventory({ ...inventory, items: [item, item] }), null);
  assert.equal(parseSevenFactorInventory({ ...inventory, items: [item, { ...item, reviewedAtUtc: "not UTC" }] }), null);
  assert.equal(parseSevenFactorInventory({ ...inventory, items: Array(21).fill(item) }), null);
  assert.equal(parseSevenFactorInventory({ ...inventory, page: 0 }), null);
});
test("verified selection digest is a preview, not training or Production activation", () => {
  const parsed = parseSevenFactorPreview(preview);
  assert.ok(parsed);
  assert.equal(parsed.sha256, "a".repeat(64));
  assert.equal(parsed.admissionStatus, sevenFactorAdmission);
  for (const update of [{ admitted: true }, { runtimeApplied: true }, { sha256: "fake" },
    { sourceFormulaVersion: "" }, { reviewedHouseholdCount: 0 },
    { admissionStatus: "DATASET_APPROVED" }, { manifestContractVersion: "unknown" }])
    assert.equal(parseSevenFactorPreview({ ...preview, ...update }), null);
});
