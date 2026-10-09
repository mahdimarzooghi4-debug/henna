import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAllocationShadowBenchmarks,
} from "../apps/web-marketplace/lib/allocation-shadow-benchmarks.ts";

const id = "b8b52eee-b4c3-4ae5-a72a-8a78dd1561c0";
const runId = "c9f0b1f2-7f25-4e88-9ba2-611384e45e90";
const digest = "a".repeat(64);
const fingerprint = "b".repeat(64);
const cutoffUtc = "2026-10-07T07:00:00Z";
const item = {
  id,
  trainingRunId: runId,
  protocolVersion: "henna-xgboost-shadow-benchmark-v1",
  modelVersion: "henna-xgboost-v1-offline",
  artifactSha256: digest,
  baselineVersion: "henna-baseline-v1",
  datasetVersion: "henna-first-party-v1",
  sourceInstructionReference: "henna-program:test",
  runtimeProposalId: null,
  runtimeProfileSequence: 0,
  evaluationFingerprint: fingerprint,
  metrics: {
    evaluationCount: 12,
    baselineMse: 0.05,
    shadowMse: 0.03,
    shadowMinusBaselineMse: -0.02,
    rubricVersion: "rubric-v1",
    evaluationFingerprint: fingerprint,
    cutoffUtc,
  },
  cutoffUtc,
  recordedAtUtc: "2026-10-07T07:01:00Z",
  winner: null,
  approved: false,
  active: false,
  runtimeApplied: false,
};

test("shadow benchmark evidence parses without inventing a winner", () => {
  const parsed = parseAllocationShadowBenchmarks({
    items: [item],
    page: 1,
    active: false,
  });
  assert.ok(parsed);
  assert.equal(parsed.items[0].metrics.shadowMinusBaselineMse, -0.02);
  assert.equal(parsed.items[0].winner, null);
  assert.equal(parsed.items[0].approved, false);
  assert.equal(parsed.items[0].runtimeApplied, false);
});

test("shadow benchmark parser fails closed on governance or lineage drift", () => {
  assert.equal(parseAllocationShadowBenchmarks({
    items: [{ ...item, active: true }],
    page: 1,
    active: false,
  }), null);
  assert.equal(parseAllocationShadowBenchmarks({
    items: [{ ...item, winner: "shadow" }],
    page: 1,
    active: false,
  }), null);
  assert.equal(parseAllocationShadowBenchmarks({
    items: [{ ...item, approved: true }],
    page: 1,
    active: false,
  }), null);
  assert.equal(parseAllocationShadowBenchmarks({
    items: [{
      ...item,
      metrics: { ...item.metrics, evaluationFingerprint: "c".repeat(64) },
    }],
    page: 1,
    active: false,
  }), null);
  assert.equal(parseAllocationShadowBenchmarks({
    items: [{ ...item, artifactSha256: "not-a-digest" }],
    page: 1,
    active: false,
  }), null);
  assert.equal(parseAllocationShadowBenchmarks({
    items: [{ ...item, runtimeProfileSequence: Number.MAX_SAFE_INTEGER + 1 }],
    page: 1,
    active: false,
  }), null);
});

test("shadow benchmark pages are bounded", () => {
  assert.deepEqual(parseAllocationShadowBenchmarks({
    items: [],
    page: 1,
    active: false,
  })?.items, []);
  assert.equal(parseAllocationShadowBenchmarks({
    items: Array(21).fill(item),
    page: 1,
    active: false,
  }), null);
});
