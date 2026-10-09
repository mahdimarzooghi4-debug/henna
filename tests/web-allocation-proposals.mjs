import assert from "node:assert/strict";
import test from "node:test";
import { parseProposalDetail, parseProposalList } from "../apps/web-marketplace/lib/allocation-proposals.ts";
const id = "b8b52eee-b4c3-4ae5-a72a-8a78dd1561c0";
const item = { id, candidateVersion: "candidate-1", baselineVersion: "baseline-1", modelVersion: "model-1", createdAtUtc: "2026-10-04T00:00:00Z", decision: null };
const detail = { id, active: false, candidateVersion: "candidate-1", rationale: "پیشنهاد آزمایشی", status: "PENDING_REVIEW", review: null,
  weights: { Health: .3, Hardship: .25, Age: .18, Size: .12, Care: .1, Education: .05 }, learningMetrics: null,
  simulation: { Rows: [{ HouseholdKey: id, BaselineAmountRial: 100, ProposedAmountRial: 101 }] } };
test("empty list is distinct from invalid or active response", () => {
  assert.deepEqual(parseProposalList({ items: [], active: false }), []);
  assert.equal(parseProposalList({ items: [item], active: true }), null);
  assert.equal(parseProposalList({ items: [{ ...item, decision: "ACTIVE" }], active: false }), null);
  assert.equal(parseProposalList({}), null);
});
test("simulation must have bounded amounts, valid household identities and normalized weights", () => {
  assert.equal(parseProposalDetail(detail)?.rows.length, 1);
  assert.equal(parseProposalDetail({ ...detail, weights: { ...detail.weights, Health: 1 } }), null);
  assert.equal(parseProposalDetail({ ...detail, simulation: { Rows: [{ HouseholdKey: id, BaselineAmountRial: Infinity, ProposedAmountRial: 10 }] } }), null);
  assert.equal(parseProposalDetail({ ...detail, active: true }), null);
});
test("final review must agree with status and include reason", () => {
  assert.equal(parseProposalDetail({ ...detail, status: "APPROVED", review: null }), null);
  assert.equal(parseProposalDetail({ ...detail, status: "APPROVED", review: { decision: "REJECTED", reason: "بررسی" } }), null);
  assert.equal(parseProposalDetail({ ...detail, status: "APPROVED", review: { decision: "APPROVED", reason: "بررسی" } })?.status, "APPROVED");
});
