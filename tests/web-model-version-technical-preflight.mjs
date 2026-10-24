import assert from "node:assert/strict";
import test from "node:test";
import { ebmTechnicalStatus, modelVersionPreflightContract,
  parseModelVersionTechnicalPreflight, validTechnicalSelection,
  xgboostExecutionFoundation, xgboostTechnicalStatus } from
  "../apps/web-marketplace/lib/model-version-technical-preflight.ts";

const artifactId = "b8b52eee-b4c3-4ae5-a72a-8a78dd1561c0";
const evaluationId = "b8b52eee-b4c3-4ae5-a72a-8a78dd1561c1";
const runId = "b8b52eee-b4c3-4ae5-a72a-8a78dd1561c2";
const selected = { family: "XGBOOST", artifactId, evaluationId };
const base = { contractVersion: modelVersionPreflightContract,
  family: "XGBOOST", artifactId, trainingRunId: artifactId, evaluationId,
  evaluationFingerprint: "f".repeat(64), artifactSha256: "a".repeat(64),
  modelVersion: "henna-xgboost-v1-offline", artifactFormat: "xgboost-json",
  datasetVersion: "henna-dataset", sourceInstructionReference: "reference",
  evaluationProtocolVersion: "henna-xgboost-shadow-benchmark-v3",
  existingExecutionFoundationVersion: xgboostExecutionFoundation,
  technicalStatus: xgboostTechnicalStatus,
  artifactHashVerified: true, evaluationRecordLinked: true,
  productionRuntimeCompatible: false,
  registrationEnabled: false, datasetAdmitted: false, modelApproved: false,
  candidateCreated: false, runtimeApplied: false };

test("explicit artifact and independent evaluation selection is required", () => {
  assert.equal(validTechnicalSelection(selected), true);
  for (const changed of [{ evaluationId: "invalid" }, { family: "CUSTOM" },
    { extra: true }, { artifactId: "invalid" }])
    assert.equal(validTechnicalSelection({ ...selected, ...changed }), false);
});
test("XGBoost existing raw prediction foundation is never a Production pass", () => {
  const parsed = parseModelVersionTechnicalPreflight(base, selected);
  assert.ok(parsed);
  assert.equal(parsed.existingExecutionFoundationVersion, xgboostExecutionFoundation);
  assert.equal(parsed.productionRuntimeCompatible, false);
  assert.equal(parsed.registrationEnabled, false);
  assert.equal(parsed.modelApproved, false);
});
test("EBM is offline only and cannot claim an execution adapter", () => {
  const e = { ...base, family: "EBM", trainingRunId: runId,
    modelVersion: "henna-ebm-v1-offline",
    artifactFormat: "henna-ebm-portable-json-v1",
    evaluationProtocolVersion: "henna-ebm-shadow-benchmark-v2",
    existingExecutionFoundationVersion: null,
    technicalStatus: ebmTechnicalStatus };
  const result = parseModelVersionTechnicalPreflight(e, { ...selected, family: "EBM" });
  assert.ok(result);
  assert.equal(result.existingExecutionFoundationVersion, null);
  assert.equal(parseModelVersionTechnicalPreflight({
    ...e, existingExecutionFoundationVersion: "invented-adapter"
  }, { ...selected, family: "EBM" }), null);
});
test("reject mismatched stored identity and forged registration or activation", () => {
  for (const delta of [
    { artifactHashVerified: false }, { evaluationRecordLinked: false }, { productionRuntimeCompatible: true },
    { registrationEnabled: true }, { datasetAdmitted: true },
    { modelApproved: true }, { candidateCreated: true }, { runtimeApplied: true },
    { existingExecutionFoundationVersion: null },
    { evaluationProtocolVersion: "future" }, { trainingRunId: runId },
    { technicalStatus: "PASSED" }, { evaluationId: runId },
    { artifactSha256: "bad" }, { evaluationFingerprint: "bad" }
  ]) assert.equal(parseModelVersionTechnicalPreflight(
    { ...base, ...delta }, selected), null);
});
