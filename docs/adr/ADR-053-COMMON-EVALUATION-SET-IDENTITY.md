# ADR-053 — Common Evaluation-Set Identity for Model Comparison

**Status:** Accepted  
**Date:** 2026-10-07  
**Area:** Allocation Learning, Evaluation, Model Governance  
**Complements:** ADR-051

## Decision

Henna uses one stable Evaluation-set fingerprint for cross-model comparison evidence.

The fingerprint is derived only from the frozen independent Evaluation examples, the exact
runtime baseline profile, and the UTC cutoff. It deliberately excludes the candidate profile,
model family, model artifact, artifact SHA-256, and benchmark result.

XGBoost shadow benchmark protocol is therefore advanced to
`henna-xgboost-shadow-benchmark-v2`. The v2 benchmark uses the same evaluation-set identity
already used by `henna-allocation-benchmark-v1`. The immutable XGBoost artifact continues to
be independently re-attested and its SHA-256 remains stored on the benchmark record.

Existing v1 shadow benchmark records are append-only historical evidence and are not rewritten.
A new v2 evaluation may coexist with an earlier v1 record.

## Governance boundary

A shared fingerprint only establishes that evidence was measured on the same frozen Evaluation
set and baseline. It does not select a winner, define a success threshold, certify fairness or
calibration, create a Proposal, authorize a Pilot, or activate Production.

Future model-family comparison may use this identity to align evidence, but Production selection
still requires sufficient real Henna data and explicit human governance.
