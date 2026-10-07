# ADR-058 — XGBoost as Henna Production-Track Model Family

**Status:** Accepted by product owner  
**Date:** 2026-10-07  
**Area:** Allocation Learning, Model Selection, Production Governance  
**Complements:** ADR-048, ADR-050, ADR-051, ADR-053, ADR-054, ADR-055, ADR-056, ADR-057

## Decision

Henna selects **XGBoost** as the primary model family for the Production track of Allocation Learning.

This is a **model-family selection decision**, not a Production activation decision.

The current XGBoost implementation remains **offline/shadow only** until a separately governed runtime contract and the required evidence gates below are completed. No existing runtime behavior changes by this ADR.

EBM remains the principal challenger and the constrained profile model remains the baseline. If later independent Henna evidence shows that XGBoost is materially less suitable than a challenger on the approved multi-dimensional evaluation contract, this ADR may be superseded before Production activation.

## Why XGBoost

XGBoost is already the lead Henna learner, is Henna-owned and local-only, produces immutable SHA-256-attested artifacts, and is evaluated on an independent Evaluation partition with the ADR-053 common fingerprint.

Its current engineering profile is intentionally small and reproducible: CPU-only, deterministic seed, fixed v1 hyperparameters, no automatic hyperparameter search, and no network inference dependency.

The choice is therefore consistent with the existing architecture while preserving the ability to compare it against EBM on identical frozen Evaluation evidence.

## Governance boundary

This ADR does **not**:

- declare any current benchmark result a Production pass;
- invent a metric threshold, ranking formula, or automatic winner rule;
- create or approve an Allocation Proposal;
- authorize or complete a Pilot;
- activate or modify Production runtime;
- permit autonomous learning or autonomous model promotion;
- permit an external or internal network model API;
- permit AI to decide eligibility, payment, wallet behavior, or Production activation.

A better value on one metric alone remains insufficient for Production.

## Required evidence before Production activation

Before XGBoost may become an active Production runtime, Henna must have explicit governed evidence covering all of the following:

1. independent Evaluation evidence on the same ADR-053 fingerprint and aligned dataset/funding/runtime lineage;
2. regression diagnostics required by ADR-056, including error, residual, and calibration evidence;
3. an approved representative/time-separated cohort contract and temporal-stability evaluation;
4. approved fairness groups, metrics, and review criteria, followed by fairness evaluation;
5. approved missing-value semantics if missing values are permitted in the future, followed by explicit missing-data behavior evaluation;
6. accountable human model review;
7. a separately approved in-process Henna-owned XGBoost runtime contract with no model API;
8. controlled Pilot authorization and completion;
9. explicit Production activation authorization; and
10. a separate explicit runtime promotion.

No numeric acceptance thresholds are introduced by this ADR.

## Runtime direction

Any future XGBoost runtime must remain Henna-owned and execute in-process or through another explicitly approved non-network internal mechanism. It must not introduce OpenAI, an external model provider, a remote inference endpoint, or a generic model-provider abstraction.

The Production runtime contract is intentionally **not implemented by this ADR**.

## Challenger policy

EBM remains an active challenger rather than being retired. Cross-model evidence remains read-only and non-ranking. A later product-owner decision may supersede XGBoost before Production activation when sufficient real Henna evidence justifies doing so.
