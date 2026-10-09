# ADR-055 — EBM TrainingRun Lineage and Independent Evaluation

**Status:** Accepted  
**Date:** 2026-10-07  
**Area:** Allocation Learning, EBM, Model Comparison  
**Complements:** ADR-053, ADR-054

## Decision

EBM evidence is attached to Henna TrainingRun lineage through separate append-only records.
Existing TrainingRun rows are never updated to add EBM state.

An administrator may register one EBM v1 offline artifact against one completed TrainingRun.
Registration is evidence ingestion, not model promotion. The backend independently:

- recomputes SHA-256 over artifact bytes;
- validates the exact Henna EBM v1 schema, model version, library/version, feature order and
  4096-value prediction lookup;
- requires the official InterpretML model payload to be present;
- verifies the report remains HENNA_OWNED_LOCAL, offline, first-party and governance-neutral;
- requires interactions=0 and no monotonic constraints for EBM v1;
- recomputes Training and Validation MSE from the frozen TrainingRun examples and artifact lookup;
- verifies counts, rubric and cutoff against that TrainingRun;
- rejects artifacts containing frozen household or reviewer identifiers.

The EBM artifact record has a unique TrainingRun relationship and exact replay is idempotent.
A divergent artifact for the same TrainingRun fails closed.

## Independent Evaluation

EBM is evaluated only after artifact registration. Evaluation uses the same first-party lineage,
dataset, funding instruction, baseline and household-overlap checks as the XGBoost shadow
benchmark. Evaluation rows must come only from the independent Evaluation partition and must not
overlap the TrainingRun households.

The EBM protocol `henna-ebm-shadow-benchmark-v1` uses the ADR-053 common Evaluation-set
fingerprint, so Baseline, XGBoost and EBM evidence can be aligned on the same frozen Evaluation
set. Artifact SHA-256 remains separate from the Evaluation-set identity.

## Governance boundary

Registration and benchmark evidence do not select a winner, define a success threshold, create a
Proposal, authorize a Pilot, or activate Production. EBM remains a challenger until sufficient
real Henna data and explicit human model-selection governance exist.
