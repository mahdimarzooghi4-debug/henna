import assert from "node:assert/strict";
import test from "node:test";
import { artifactInventoryContract, parseModelArtifactInventory } from
  "../apps/web-marketplace/lib/model-artifact-inventory.ts";

const id = "b8b52eee-b4c3-4ae5-a72a-8a78dd1561c0";
const item = { artifactId: id, trainingRunId: id, modelVersion: "henna-xgboost-offline",
  artifactFormat: "xgboost-json", artifactSha256: "a".repeat(64),
  datasetVersion: "first-party", recordedAtUtc: "2026-10-09T12:00:00Z",
  artifactVerified: true, evaluationCount: 1 };
const base = { contractVersion: artifactInventoryContract, page: 1,
  xgboostHasMore: false, ebmHasMore: false, xgboostItems: [item], ebmItems: [],
  admitted: false, registryReady: false, registrationEnabled: false,
  approved: false, active: false, runtimeApplied: false };
test("real offline artifact with attested bytes is still NOT registered or approved", () => {
  const parsed = parseModelArtifactInventory(base);
  assert.ok(parsed);
  assert.equal(parsed.registryReady, false);
  assert.equal(parsed.registrationEnabled, false);
  assert.equal(parsed.runtimeApplied, false);
  assert.equal(parsed.xgboostItems[0].artifactVerified, true);
});
test("missing or corrupt stored bytes may be reported without model promotion", () => {
  const parsed = parseModelArtifactInventory({ ...base,
    xgboostItems: [{ ...item, artifactVerified: false, evaluationCount: 0 }] });
  assert.ok(parsed);
  assert.equal(parsed.xgboostItems[0].artifactVerified, false);
});
test("forged activation, fake digest, overflow or duplicated artifact is fail-closed", () => {
  for (const change of [{ admitted: true }, { registryReady: true },
    { registrationEnabled: true }, { approved: true }, { active: true },
    { runtimeApplied: true }, { contractVersion: "fake" }, { page: 0 }])
    assert.equal(parseModelArtifactInventory({ ...base, ...change }), null);
  for (const change of [{ artifactSha256: "bad" }, { evaluationCount: -1 },
    { artifactVerified: "yes" }, { trainingRunId: "bad" }, { recordedAtUtc: "now" }])
    assert.equal(parseModelArtifactInventory({ ...base,
      xgboostItems: [{ ...item, ...change }] }), null);
  assert.equal(parseModelArtifactInventory({ ...base,
    ebmItems: [item, item] }), null);
  assert.equal(parseModelArtifactInventory({ ...base,
    xgboostItems: Array(11).fill(item) }), null);
});
