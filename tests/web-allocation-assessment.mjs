import assert from "node:assert/strict";
import test from "node:test";
import { parseAssessmentInput } from "../apps/web-marketplace/lib/allocation-assessment.ts";
const input = { snapshotId: "b8b52eee-b4c3-4ae5-a72a-8a78dd1561c0", householdKey: "b8b52eee-b4c3-4ae5-a72a-8a78dd1561c1", datasetVersion: " dataset-v1 ", sourceInstructionReference: "source-v1", evidenceReference: "record-v1", geographicFactor: 1.1, allocatedRial: 1000, assessedAtUtc: "2026-10-01T00:00:00Z", scores: { health: 3, hardship: 2, age: 0, size: 1, care: 0, education: 0 } };
const now = Date.parse("2026-10-04T00:00:00Z");
test("complete evidence-backed input is normalized and unknown identity overrides are dropped", () => {
  const parsed = parseAssessmentInput({...input, recordedByAccountId: "forged"}, now);
  assert.equal(parsed.datasetVersion, "dataset-v1"); assert.equal(parsed.recordedByAccountId, undefined);
});
test("unknown and fractional scores cannot silently become zero", () => {
  assert.equal(parseAssessmentInput({...input,scores:{health:0}},now),null);
  assert.equal(parseAssessmentInput({...input,scores:{...input.scores,health:1.5}},now),null);
});
test("future times, unsafe money, missing evidence and invalid household keys are rejected", () => {
  for (const change of [{assessedAtUtc:"2027-01-01T00:00:00Z"},{allocatedRial:Number.MAX_SAFE_INTEGER+1},{evidenceReference:" "},{householdKey:"national-id"},{geographicFactor:0}]) assert.equal(parseAssessmentInput({...input,...change},now),null);
});
