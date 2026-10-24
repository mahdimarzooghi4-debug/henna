import assert from "node:assert/strict";
import test from "node:test";
import { partitionContract, partitionNotAdmitted, parseHumanReviewInventory,
  parsePartitionPreflightPreview, validPartitionChoices,
  validPartitionRevalidationRequest, parsePartitionRevalidationResult,
  partitionRevalidationContract, partitionRevalidatedStatus } from
  "../apps/web-marketplace/lib/seven-factor-partitions.ts";

const a = "b8b52eee-b4c3-4ae5-a72a-8a78dd1561c0";
const b = "b8b52eee-b4c3-4ae5-a72a-8a78dd1561c1";
const c = "b8b52eee-b4c3-4ae5-a72a-8a78dd1561c2";
const cutoff = "2026-10-09T12:00:00.000Z";
const flags = { contractVersion: partitionContract, admissionStatus: partitionNotAdmitted,
  active: false, admitted: false, runtimeApplied: false };
const review = { id: a, sevenFactorReviewId: b, reviewedAtUtc: cutoff,
  evidenceDisposition: 1, scaleVersion: "human-five", criteriaVersion: "qualitative-v1" };
const source = { ...flags, items: [review], page: 1, hasMore: false };
const choice = {
  trainingReviewIds: [a], validationReviewIds: [b],
  evaluationReviewIds: [c], cutoffUtc: cutoff,
};
const result = { ...flags, cutoffUtc: cutoff, sourceFormulaVersion: "historical-six-factor",
  sourceDatasetVersion: "first-party", sourceInstructionReference: "program-one",
  trainingCount: 1, validationCount: 1, evaluationCount: 1, sha256: "a".repeat(64) };
test("human review list is bounded and does not expose need scores", () => {
  const parsed = parseHumanReviewInventory(source);
  assert.ok(parsed);
  assert.equal(parsed.items.length, 1);
  assert.equal("severityLevel" in parsed.items[0], false);
  for (const changed of [{ admitted: true }, { active: true }, { runtimeApplied: true },
    { admissionStatus: "ADMITTED" }, { contractVersion: "bad" }])
    assert.equal(parseHumanReviewInventory({ ...source, ...changed }), null);
  for (const changed of [{ evidenceDisposition: 0 }, { evidenceDisposition: 4 },
    { reviewedAtUtc: "yesterday" }, { id: "invalid" }])
    assert.equal(parseHumanReviewInventory({ ...source, items: [{ ...review, ...changed }] }), null);
  assert.equal(parseHumanReviewInventory({ ...source, items: [review, review] }), null);
});
test("three distinct explicit non-empty partitions and a non-future UTC cutoff are required", () => {
  assert.equal(validPartitionChoices(choice), true);
  for (const payload of [
    { ...choice, trainingReviewIds: [] }, { ...choice, validationReviewIds: [] },
    { ...choice, evaluationReviewIds: [] },
    { ...choice, evaluationReviewIds: [a] }, { ...choice, cutoffUtc: "not-a-date" },
    { ...choice, cutoffUtc: "2099-01-01T00:00:00Z" },
    { ...choice, unauthorized: "approved" },
    { ...choice, trainingReviewIds: [a, a] },
  ]) assert.equal(validPartitionChoices(payload), false);
});
test("valid preflight result is not Dataset admission or model evaluation", () => {
  const parsed = parsePartitionPreflightPreview(result);
  assert.ok(parsed);
  assert.equal(parsed.trainingCount + parsed.validationCount + parsed.evaluationCount, 3);
  assert.equal(parsed.admitted, false);
  assert.equal(parsed.active, false);
  for (const changed of [{ admitted: true }, { runtimeApplied: true }, { active: true },
    { admissionStatus: "PASSED" }, { trainingCount: 0 },
    { evaluationCount: 501 }, { sha256: "not-attested" }])
    assert.equal(parsePartitionPreflightPreview({ ...result, ...changed }), null);
});

const prior = { ...choice, expectedSha256: result.sha256 };
const unchanged = {
  contractVersion: partitionRevalidationContract,
  preflightContractVersion: partitionContract,
  cutoffUtc: cutoff, sourceFormulaVersion: result.sourceFormulaVersion,
  sourceDatasetVersion: result.sourceDatasetVersion,
  sourceInstructionReference: result.sourceInstructionReference,
  trainingCount: 1, validationCount: 1, evaluationCount: 1,
  expectedSha256: result.sha256, currentSha256: result.sha256,
  status: partitionRevalidatedStatus, exactManifestUnchanged: true,
  datasetAdmitted: false, modelTrained: false,
  modelApproved: false, runtimeApplied: false,
};
test("revalidation requires prior digest and unchanged authoritative identity", () => {
  assert.ok(validPartitionRevalidationRequest(prior));
  const parsed = parsePartitionRevalidationResult(unchanged, prior, result);
  assert.ok(parsed);
  assert.equal(parsed.datasetAdmitted, false);
  assert.equal(parsed.modelTrained, false);
  for (const v of [
    { datasetAdmitted: true }, { modelTrained: true },
    { modelApproved: true }, { runtimeApplied: true },
    { exactManifestUnchanged: false }, { currentSha256: "b".repeat(64) },
    { expectedSha256: "b".repeat(64) },
    { status: "ADMITTED" }, { trainingCount: 2 },
    { sourceInstructionReference: "different-source" },
    { sourceDatasetVersion: "different-dataset" },
    { cutoffUtc: "2026-10-08T11:00:00.000Z" }
  ]) assert.equal(parsePartitionRevalidationResult(
      { ...unchanged, ...v }, prior, result), null);
  for (const v of [
    { expectedSha256: "bad" }, { expectedSha256: "A".repeat(64) },
    { cutoffUtc: "2099-01-01T00:00:00Z" }, { trainingReviewIds: [a, a] },
    { unwanted: "auto-select" },
  ]) assert.equal(validPartitionRevalidationRequest({ ...prior, ...v }), false);
});
