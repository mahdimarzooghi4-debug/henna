# ADR-060 — Allocation Judgment Framework Governs Reviewed Need Labels

**Status:** Accepted by Product Owner  
**Date:** 2026-10-09  
**Area:** Allocation Learning, Human Review, Label Governance  
**Normative framework:** `docs/product/HANA-ALLOCATION-JUDGMENT-FRAMEWORK.md`  
**Framework version:** `HENNA-AJF-v1`

## Decision

Henna adopts a versioned **Allocation Judgment Framework** upstream of Reviewed Need Labels.

The framework defines the reasoning discipline that an approved Review Rubric must implement. It exists to make human labeling more consistent, auditable and independent from the current allocation formula, prior grants, behavioral proxies and model output.

The governed sequence is:

`Judgment Framework → Versioned Review Rubric → Human Reviewed Labels → Training/Validation/Evaluation → Offline Model Learning → Independent Evaluation → Human Governance`

The Judgment Framework is not a model artifact and is not direct XGBoost input.

## Training boundary

XGBoost continues to train only on eligible first-party Henna examples with Reviewed Need Labels and valid lineage.

Text, principles, scenarios and anti-patterns from the Judgment Framework must not be transformed automatically into:

- model features;
- model targets;
- synthetic training rows;
- Training/Validation/Evaluation examples; or
- Production evidence.

Synthetic cases derived from the framework may be used for reviewer training, rubric testing or non-production QA, but remain segregated from governed model datasets.

## Label meaning

A Reviewed Need Label represents accountable human judgment under a versioned approved rubric.

The reviewer must not mechanically derive the label from:

- spending or credit usage;
- unused credit;
- order/complaint activity;
- previous allocation;
- the current allocation formula;
- a candidate model prediction; or
- unsupported causal inference.

Unknown evidence remains unknown unless a separately approved rubric explicitly defines how incomplete evidence is handled.

## Rubric boundary

This ADR does not define the numeric transformation from evidence to the existing 0–1 Reviewed Need Label.

That transformation requires a separately versioned Review Rubric.

Each new rubric adopted after this ADR must identify the Judgment Framework version it implements.

Changing the framework or rubric does not silently rewrite historical labels. Historical evidence remains immutable; correction or reinterpretation requires new governed review evidence under the appropriate version.

## Existing unresolved contracts

This ADR does not resolve or invent:

- temporal-stability cohort construction;
- fairness groups;
- fairness metrics;
- fairness acceptance criteria;
- model-feature missing-value semantics;
- statistical adequacy thresholds;
- Production acceptance thresholds; or
- automatic model-family ranking.

Those remain separate explicit decisions.

## Production boundary

Adopting the Judgment Framework does not:

- select a benchmark winner;
- create or approve a Proposal;
- authorize a Pilot;
- change Commerce allocation behavior;
- authorize eligibility or payment;
- activate Production; or
- promote or roll back a runtime model/profile.

All existing human-governed rollout gates remain unchanged.

## Consequences

- Reviewer education can be standardized without contaminating model datasets.
- Reviewed Labels gain a clear upstream judgment doctrine.
- Circular learning from prior allocation/model output is explicitly prohibited.
- Behavioral telemetry remains context/evidence, not ground truth.
- Future rubric quality and inter-reviewer consistency can be evaluated separately from model quality.
