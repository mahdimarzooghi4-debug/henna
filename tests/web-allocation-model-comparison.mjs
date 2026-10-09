import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAllocationModelComparisonSources,
} from "../apps/web-marketplace/lib/allocation-model-comparison.ts";

const fingerprint = "b".repeat(64);
const digest = "a".repeat(64);
const cutoffUtc = "2026-10-07T07:00:00Z";
const recordedAtUtc = "2026-10-07T07:01:00Z";
const runtimeProposalId = null;
const runtimeProfileSequence = 0;

const diagnostics = {
  count: 12,
  mse: 0.03,
  rmse: Math.sqrt(0.03),
  mae: 0.12,
  meanResidual: -0.01,
  meanPrediction: 0.48,
  meanObserved: 0.49,
  calibrationIntercept: 0.02,
  calibrationSlope: 0.97,
};

const common = {
  baselineVersion: "henna-baseline-v1",
  datasetVersion: "henna-first-party-v1",
  sourceInstructionReference: "henna-program:test",
  runtimeProposalId,
  runtimeProfileSequence,
  evaluationFingerprint: fingerprint,
  cutoffUtc,
  recordedAtUtc,
  winner: null,
  approved: false,
  active: false,
};

const metricCommon = {
  evaluationCount: 12,
  baselineMse: 0.05,
  rubricVersion: "rubric-v1",
  evaluationFingerprint: fingerprint,
  cutoffUtc,
  baselineDiagnostics: { ...diagnostics, mse: 0.05, rmse: Math.sqrt(0.05) },
};

const profile = {
  ...common,
  id: "b8b52eee-b4c3-4ae5-a72a-8a78dd1561c0",
  proposalId: "c9f0b1f2-7f25-4e88-9ba2-611384e45e90",
  protocolVersion: "henna-allocation-benchmark-v2",
  modelVersion: "constrained-profile-v1",
  candidateVersion: "candidate-v7",
  metrics: {
    ...metricCommon,
    candidateMse: 0.03,
    candidateMinusBaselineMse: -0.02,
    candidateDiagnostics: diagnostics,
  },
};

const xgboost = {
  ...common,
  id: "a8b52eee-b4c3-4ae5-a72a-8a78dd1561c1",
  trainingRunId: "d9f0b1f2-7f25-4e88-9ba2-611384e45e91",
  protocolVersion: "henna-xgboost-shadow-benchmark-v3",
  modelVersion: "henna-xgboost-v1-offline",
  artifactSha256: digest,
  runtimeApplied: false,
  metrics: {
    ...metricCommon,
    shadowMse: 0.028,
    shadowMinusBaselineMse: -0.022,
    shadowDiagnostics: { ...diagnostics, mse: 0.028, rmse: Math.sqrt(0.028) },
  },
};

const ebm = {
  ...common,
  id: "e8b52eee-b4c3-4ae5-a72a-8a78dd1561c2",
  ebmArtifactId: "f9f0b1f2-7f25-4e88-9ba2-611384e45e92",
  trainingRunId: "a9f0b1f2-7f25-4e88-9ba2-611384e45e93",
  protocolVersion: "henna-ebm-shadow-benchmark-v2",
  modelVersion: "henna-ebm-v1-offline",
  artifactSha256: digest,
  proposalCreated: false,
  runtimeApplied: false,
  metrics: {
    ...metricCommon,
    ebmMse: 0.031,
    ebmMinusBaselineMse: -0.019,
    ebmDiagnostics: { ...diagnostics, mse: 0.031, rmse: Math.sqrt(0.031) },
  },
};

const sources = (overrides = {}) => ({
  profile: { items: [profile], page: 1, active: false },
  xgboost: { items: [xgboost], page: 1, active: false },
  ebm: { items: [ebm], page: 1, active: false },
  ...overrides,
});

test("comparison parser aligns profile, XGBoost and EBM without ranking", () => {
  const parsed = parseAllocationModelComparisonSources(sources(), fingerprint);
  assert.ok(parsed);
  assert.equal(parsed.lineageAligned, true);
  assert.equal(parsed.items.length, 3);
  assert.deepEqual(new Set(parsed.items.map(x => x.kind)),
    new Set(["PROFILE", "XGBOOST", "EBM"]));
  assert.equal(parsed.winner, null);
  assert.equal(parsed.approved, false);
  assert.equal(parsed.active, false);
  assert.equal(parsed.runtimeApplied, false);
  assert.equal(parsed.truncated, false);
  assert.equal(parsed.items.find(x => x.kind === "EBM")?.modelDiagnostics?.mse, 0.031);
});

test("comparison parser surfaces lineage mismatch instead of calling it comparable", () => {
  const shifted = {
    ...ebm,
    datasetVersion: "different-dataset",
  };
  const parsed = parseAllocationModelComparisonSources(sources({
    ebm: { items: [shifted], page: 1, active: false },
  }), fingerprint);
  assert.ok(parsed);
  assert.equal(parsed.lineageAligned, false);
});

test("new diagnostic protocols fail closed when diagnostics are absent", () => {
  const invalid = {
    ...xgboost,
    metrics: {
      ...xgboost.metrics,
      shadowDiagnostics: null,
    },
  };
  assert.equal(parseAllocationModelComparisonSources(sources({
    xgboost: { items: [invalid], page: 1, active: false },
  }), fingerprint), null);
});

test("historical protocols remain readable without new diagnostics", () => {
  const historical = {
    ...xgboost,
    protocolVersion: "henna-xgboost-shadow-benchmark-v2",
    metrics: {
      ...xgboost.metrics,
      baselineDiagnostics: undefined,
      shadowDiagnostics: undefined,
    },
  };
  const parsed = parseAllocationModelComparisonSources(sources({
    xgboost: { items: [historical], page: 1, active: false },
  }), fingerprint);
  assert.ok(parsed);
  assert.equal(parsed.items.find(x => x.kind === "XGBOOST")?.modelDiagnostics, null);
});

test("comparison parser rejects governance drift and wrong fingerprint", () => {
  assert.equal(parseAllocationModelComparisonSources(sources({
    ebm: { items: [{ ...ebm, approved: true }], page: 1, active: false },
  }), fingerprint), null);
  assert.equal(parseAllocationModelComparisonSources(sources(), "c".repeat(64)), null);
});

test("comparison marks a source page at capacity as potentially truncated", () => {
  const parsed = parseAllocationModelComparisonSources(sources({
    profile: { items: Array(20).fill(profile), page: 1, active: false },
  }), fingerprint);
  assert.ok(parsed);
  assert.equal(parsed.truncated, true);
});
