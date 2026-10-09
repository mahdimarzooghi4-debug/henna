# ADR-059 — Henna XGBoost In-Process Runtime Contract Foundation

**Status:** Accepted implementation foundation  
**Date:** 2026-10-07  
**Area:** Allocation Learning, XGBoost, Runtime Safety  
**Complements:** ADR-048, ADR-050, ADR-051, ADR-053, ADR-056, ADR-058

## Decision

Henna defines a local, in-process execution contract for the XGBoost model family selected by ADR-058.

This contract is an execution foundation only. It does not activate XGBoost in Commerce or Production and does not replace the existing allocation runtime profile.

A runtime candidate is explicitly bound to:

- the frozen Training Run ID;
- the independent benchmark evidence ID;
- the ADR-053 Evaluation fingerprint;
- the exact Henna XGBoost model version;
- the exact artifact format;
- the immutable artifact SHA-256; and
- the exact artifact bytes.

Before inference, Henna recomputes SHA-256 over the artifact bytes and fails closed on any mismatch. The model is loaded and executed directly through the already pinned local XGBoostSharp CPU dependency. No HTTP, gRPC, remote model endpoint, provider SDK or generic model-provider abstraction is introduced.

## Prediction boundary

The contract returns only the model's finite **raw need-score prediction** together with the pinned runtime/evidence lineage.

It deliberately does not:

- clamp, normalize or threshold the prediction;
- convert the prediction into allocation weights;
- define a pool-allocation formula;
- decide eligibility;
- authorize a payment or wallet mutation;
- create a Proposal;
- authorize or complete a Pilot;
- authorize Production activation;
- promote or roll back runtime state.

Those would be separate product/runtime contracts and must not be inferred from model output.

## Evidence boundary

Possession of a valid artifact and the ability to reproduce a prediction are necessary technical properties but are not evidence of Production suitability.

Before any future Production wiring, ADR-058 still requires governed evidence for independent Evaluation, regression diagnostics, temporal stability, fairness, approved missing-value behavior when applicable, accountable human review, controlled Pilot completion, explicit Production activation authorization and separate explicit runtime promotion.

The runtime contract therefore requires evidence identifiers but does not itself decide whether that evidence is sufficient.

## Current integration boundary

This foundation is intentionally **not registered as the active Commerce allocation runtime**.

Commerce continues to consume the currently governed versioned allocation profile. No existing grant is recalculated, no allocation journal semantics change, and no Production behavior changes in this ADR.

A future integration must explicitly define how a reviewed XGBoost prediction participates in allocation mathematics before any Commerce wiring is permitted. That mapping is intentionally unresolved here and must not be invented.

## Failure behavior

The contract fails closed when:

- Training Run or benchmark lineage is absent;
- model version differs from the selected Henna XGBoost version;
- artifact format differs from the approved format;
- artifact bytes are absent;
- artifact SHA-256 is malformed or does not match the bytes;
- Evaluation fingerprint is malformed; or
- model inference returns a non-finite or invalid prediction shape.

No fallback model, synthetic prediction or default score is substituted.
