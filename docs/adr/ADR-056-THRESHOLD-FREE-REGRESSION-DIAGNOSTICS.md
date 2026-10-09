# ADR-056 — Threshold-Free Regression Diagnostics for Model Comparison

**Status:** Accepted  
**Date:** 2026-10-07  
**Area:** Allocation Learning, Model Evaluation  
**Complements:** ADR-051, ADR-053, ADR-055

## Decision

Henna records threshold-free regression diagnostics for new independent benchmark evidence across
the constrained profile candidate, XGBoost shadow and EBM challenger.

For both the exact runtime baseline and the compared model, new benchmark protocols record:

- MSE;
- RMSE;
- MAE;
- mean residual, defined as prediction minus reviewed observed target;
- mean prediction;
- mean reviewed observed target;
- ordinary least-squares calibration intercept and slope for
  `observed = intercept + slope * prediction`.

Calibration slope and intercept are null when prediction variance is exactly zero. Henna does not
invent a fallback value.

These diagnostics are measurements only. No target value, tolerance, pass/fail threshold, ranking
rule or automatic winner is defined.

## Protocol versioning and immutable history

Diagnostic fields change benchmark evidence semantics, so new records use:

- `henna-allocation-benchmark-v2`;
- `henna-xgboost-shadow-benchmark-v3`;
- `henna-ebm-shadow-benchmark-v2`.

Existing benchmark rows remain immutable. Unique benchmark identity now includes protocol version,
allowing historical evidence and new diagnostic evidence to coexist for the same frozen
Evaluation set.

The ADR-053 Evaluation-set fingerprint itself does **not** change. Its existing v1 hash prefix is
kept stable even though benchmark protocols advance. Therefore old and new model-family evidence
can still refer to the same frozen Evaluation-set identity.

## Explicit non-claims

This slice does not claim or calculate temporal stability. A real stability analysis requires an
approved representative/time-separated cohort construction.

This slice does not calculate missing-data behavior. The current six allocation score features are
required integers in 0..3 and have no approved missing-value semantics; inventing null/default
behavior would be unsafe.

This slice does not calculate fairness. Henna still has no approved fairness-group definitions or
fairness acceptance criteria.

The diagnostics do not create a Proposal, approve a model, authorize a Pilot, or activate
Production.
