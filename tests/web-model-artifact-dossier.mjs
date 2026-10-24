import assert from "node:assert/strict";
import test from "node:test";
import { modelDossierContract, modelDossierStatus, parseModelArtifactDossier } from
  "../apps/web-marketplace/lib/model-artifact-dossier.ts";

const id = "b8b52eee-b4c3-4ae5-a72a-8a78dd1561c0";
const run = "b8b52eee-b4c3-4ae5-a72a-8a78dd1561c1";
const when = "2026-10-09T12:00:00Z";
const row = { id: run, protocolVersion: "henna-evaluation-v1",
  evaluationFingerprint: "f".repeat(64), datasetVersion: "first-party",
  sourceInstructionReference: "funding-lineage", cutoffUtc: when, recordedAtUtc: when };
const sample = { contractVersion: modelDossierContract, family: "XGBOOST",
  artifactId: id, trainingRunId: run, modelVersion: "henna-xgboost-v1-offline",
  artifactFormat: "xgboost-json", artifactSha256: "a".repeat(64),
  datasetVersion: "first-party", recordedAtUtc: when, artifactVerified: true,
  evaluations: [row], evidenceStatus: modelDossierStatus,
  registered: false, approved: false, active: false, runtimeApplied: false };
test("artifact evidence is recorded but remains unregistered and unapproved", () => {
  const parsed = parseModelArtifactDossier(sample, "XGBOOST", id);
  assert.ok(parsed);
  assert.equal(parsed.registered, false);
  assert.equal(parsed.active, false);
  assert.equal(parsed.evaluations[0].evaluationFingerprint, row.evaluationFingerprint);
  assert.equal(parseModelArtifactDossier({ ...sample, evaluations: [] }, "XGBOOST", id)?.evaluations.length, 0);
});
test("reject forged approval, wrong selection, lineage, duplicates, and overflow", () => {
  for (const delta of [
    { registered: true }, { approved: true }, { active: true },
    { runtimeApplied: true }, { artifactVerified: false }, { evidenceStatus: "PASSED" },
    { contractVersion: "fake" }, { family: "EBM" }, { artifactSha256: "bad" },
  ]) assert.equal(parseModelArtifactDossier({ ...sample, ...delta }, "XGBOOST", id), null);
  assert.equal(parseModelArtifactDossier(sample, "XGBOOST", run), null);
  for (const evaluations of [
    [{ ...row, datasetVersion: "other" }],
    [{ ...row, evaluationFingerprint: "invalid" }],
    [row, row],
    Array(101).fill(row),
  ]) assert.equal(parseModelArtifactDossier({ ...sample, evaluations }, "XGBOOST", id), null);
});
