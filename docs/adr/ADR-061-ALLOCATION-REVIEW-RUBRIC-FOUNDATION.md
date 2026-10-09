# ADR-061 — Allocation Review Rubric Foundation

**Status:** Accepted by Product Owner  
**Date:** 2026-10-09  
**Area:** Allocation Learning, Human Review, Label Governance  
**Normative framework:** `HENNA-AJF-v1`  
**Rubric foundation:** `HENNA-ARR-v1`

## Decision

Henna adopts `HENNA-ARR-v1` as the first versioned Allocation Review Rubric foundation implementing `HENNA-AJF-v1`.

The rubric standardizes reviewer reasoning, evidence provenance checks, anti-bias checks, uncertainty handling, conflict preservation, rationale requirements, and reviewer-training scenarios.

It is upstream of Reviewed Need Labels and model training.

## Numeric mapping remains unresolved

This ADR explicitly does **not** approve or invent the transformation from reviewed evidence to Henna's existing 0–1 Reviewed Need Label.

Therefore `HENNA-ARR-v1` is a governed reasoning and reviewer-training foundation, not a complete numeric labeling algorithm.

A later explicit product/data decision is required before a rubric version can claim to fully define production label creation.

## Model boundary

The rubric is not model input.

Its principles, scenarios, and anti-patterns must not be converted automatically into:

- features;
- targets;
- synthetic training rows;
- allocation weights;
- model-selection thresholds; or
- Production evidence.

XGBoost continues to learn only from eligible first-party examples carrying human Reviewed Need Labels under an approved complete rubric and valid lineage.

## Human accountability

A reviewer remains accountable for the human judgment.

The system must not represent rubric compliance as an AI decision.

The rubric must not use current model output, current allocation formula, previous allocation, spending, usage, or another behavioral proxy as ground truth.

Unknown evidence remains unknown.

## Historical evidence

Changing the framework or rubric does not rewrite historical labels.

Every future label under a complete approved rubric must retain the exact rubric version used.

Corrections or reinterpretations require new governed review evidence, not mutation of prior history.

## Unresolved contracts preserved

ADR-061 does not resolve or invent:

- the 0–1 label semantics or numeric mapping;
- abstention / insufficient-evidence behavior;
- temporal-stability cohort construction;
- fairness groups;
- fairness metrics;
- fairness acceptance criteria;
- missing-value semantics for model features;
- reviewer agreement thresholds;
- statistical adequacy thresholds;
- Production acceptance thresholds; or
- automatic model-family ranking.

## Production boundary

Adopting the rubric foundation does not:

- create a Reviewed Need Label automatically;
- create a model dataset row;
- select a model winner;
- create or approve a Proposal;
- authorize a Pilot;
- change Commerce behavior;
- decide eligibility or payment;
- activate Production; or
- promote or roll back runtime state.
