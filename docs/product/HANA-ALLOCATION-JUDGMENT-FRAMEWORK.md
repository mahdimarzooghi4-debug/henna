# Henna Allocation Judgment Framework

**Status:** Approved by Product Owner  
**Version:** HENNA-AJF-v1  
**Date:** 2026-10-09  
**Area:** Allocation Learning, Reviewed Labels, Human Judgment, Model Governance

## 1. Purpose

This framework defines **how Henna should look at allocation need before a human reviewer creates a Reviewed Need Label**.

It is intentionally **not a Training Dataset** and is not model input for XGBoost.

Its purpose is to create a shared, auditable judgment discipline so that different reviewers do not label the same kind of situation according to unrelated personal intuitions.

The governed path is:

`Judgment Framework → Versioned Review Rubric → Human Reviewed Labels → Training/Validation/Evaluation Partitions → Offline Learning → Independent Evaluation → Human Governance`

A model may learn only from Reviewed Labels produced under an approved rubric and valid first-party lineage. It does not "read" this document and it does not receive the examples in this document as training rows.

## 2. Normative judgment principles

### JF-01 — Need is multidimensional

No single behavioral, financial or operational observation is equivalent to household need.

Henna must interpret observations in context rather than treating one proxy as the target itself.

### JF-02 — Spending is not need

Credit usage, purchase volume, order frequency, refund behavior or unused balance must not be converted directly into a Need Label.

Low usage may coexist with high need when access, delivery, stock, usability or another barrier prevents consumption.

High usage may coexist with lower relative need and must not be treated as proof of greater need.

### JF-03 — Observation is not causation

An observed outcome may describe what happened but does not by itself establish why it happened.

A reviewer must not infer a causal explanation unless the approved evidence and rubric explicitly support that conclusion.

### JF-04 — Unknown remains unknown

Missing evidence must not be silently converted to false, zero, "no barrier", "no need" or any other default.

When the authoritative state is unknown, the judgment process must preserve that uncertainty.

### JF-05 — Absence of activity is not absence of need

No order, no purchase, no complaint, no request or no response is not sufficient evidence that a household has no need.

The reason for inactivity may be unavailable to Henna.

### JF-06 — Barriers can suppress visible behavior

Stock, delivery and access barriers, and incomplete essential-needs coverage may change observable behavior without changing the underlying need in the same direction.

Where such barriers are known, reviewers must interpret usage and activity together with those barriers rather than independently.

Where such barriers are unknown, reviewers must not invent them.

### JF-07 — Labels must be independent of the current formula

A reviewer must not copy, reverse-engineer or mechanically reproduce the existing allocation formula, current weight profile, current grant amount or model prediction when establishing a Reviewed Need Label.

The label is intended to be independent supervisory evidence.

### JF-08 — Existing allocation is evidence of history, not ground truth

The amount previously allocated to a household may be relevant operational lineage, but it is not proof that the previous decision was correct and must not become the label by circular reasoning.

### JF-09 — Funding instruction remains an external constraint

A Need Label does not override the funding source's instructions, eligibility rules or authorized program scope.

Need assessment and funding authorization are separate concerns.

### JF-10 — AI does not decide eligibility, payment or activation

Neither a Reviewed Need Label nor a model prediction authorizes eligibility, wallet mutation, payment, settlement, Pilot, Production activation or runtime promotion.

Those remain separate governed decisions.

### JF-11 — Evidence provenance matters

Reviewers should distinguish among:

- first-party authoritative observations;
- human-reviewed, evidence-backed observations;
- unavailable/unknown observations; and
- inferences that are not permitted to become facts.

The same numeric or boolean-looking value may have different evidentiary meaning depending on its provenance.

### JF-12 — Time matters

Need and outcomes are time-dependent.

Reviewers must judge the evidence that belongs to the relevant assessment/review period and must not silently use later observations to rewrite what was known at an earlier point in time.

### JF-13 — Conflicting evidence must stay visible

When evidence points in different directions, the reviewer must not hide that conflict merely to create a simpler narrative.

The approved rubric may define how a final label is reached, but the underlying conflict remains part of the review context and audit trail.

### JF-14 — A model metric is not a policy verdict

Lower MSE, RMSE or MAE, better calibration or any other benchmark result is evidence about model behavior only.

It does not prove fairness, causal correctness, eligibility correctness or Production suitability.

### JF-15 — Human judgment remains accountable

Reviewed Labels are accountable human judgments under a versioned rubric.

Henna may support the review process with structured evidence, but the system must not represent the label as an autonomous AI decision.

## 3. Judgment patterns for reviewer training

The following patterns teach **how to reason**, not what numeric label to assign.

They are not production records and must not be inserted into Training, Validation or Evaluation datasets.

### Pattern A — Low usage with known access barrier

Observed:
- low or zero credit usage;
- valid evidence of an access barrier.

Incorrect interpretation:
- "The household did not spend, therefore its need is low."

Required perspective:
- visible usage may have been constrained by access;
- usage alone cannot determine need;
- reviewer evaluates the approved need evidence under the rubric.

### Pattern B — Low usage with no barrier evidence

Observed:
- low or zero usage;
- barrier state is unknown.

Incorrect interpretation:
- "There was definitely an access problem."

Required perspective:
- do not invent a barrier;
- do not equate low usage with low need;
- preserve the unknown state and judge only from available approved evidence.

### Pattern C — High usage

Observed:
- high usage of granted credit.

Incorrect interpretation:
- "High spending proves highest need."

Required perspective:
- spending is an outcome/behavioral observation;
- it may be relevant context but is not the target label;
- the reviewer establishes need independently.

### Pattern D — No complaint

Observed:
- no complaint event.

Incorrect interpretation:
- "There was no problem."

Required perspective:
- absence of a complaint does not prove absence of a barrier or unmet need;
- only approved evidence may establish those states.

### Pattern E — Previous high allocation

Observed:
- household received a relatively high historical allocation.

Incorrect interpretation:
- "The previous allocation proves the household has high need."

Required perspective:
- historical allocation is a prior system decision;
- using it as ground truth would create circular learning;
- the reviewer must rely on the approved rubric and independent evidence.

### Pattern F — Conflicting evidence

Observed:
- one indicator suggests greater need;
- another credible observation points in a different direction.

Incorrect interpretation:
- discard the inconvenient observation to produce a cleaner story.

Required perspective:
- preserve both observations;
- use the approved rubric;
- do not invent a causal explanation to reconcile them.

### Pattern G — Missing outcome

Observed:
- an outcome field is unavailable.

Incorrect interpretation:
- treat the missing value as zero, false or "normal."

Required perspective:
- unknown remains unknown;
- the rubric must explicitly define whether judgment is possible with incomplete evidence;
- this framework does not invent missing-value semantics.

## 4. Anti-patterns

The following are prohibited judgment shortcuts:

- spending = need;
- unused credit = low need;
- no order = no need;
- no complaint = no barrier;
- missing = zero;
- missing = false;
- current formula output = Reviewed Need Label;
- previous grant = ground truth;
- XGBoost prediction = human label;
- feature importance or SHAP = allocation weight;
- better single metric = model winner;
- model winner = Production activation;
- observed outcome = causal explanation;
- inferred barrier without authoritative/reviewed evidence;
- synthetic educational case = training data.

## 5. Reviewer discipline

Before recording a Reviewed Need Label, the reviewer must be able to answer:

1. Which approved rubric version am I using?
2. Which evidence belongs to this assessment/review period?
3. Which observations are authoritative, which are human-reviewed, and which are unknown?
4. Am I accidentally using spending, grant amount or the current model/formula as ground truth?
5. Am I inferring a barrier or cause that is not actually evidenced?
6. Have I preserved material uncertainty and conflicting evidence?
7. Is my judgment independent of eligibility, payment and funding authorization?
8. Can another authorized reviewer reconstruct why this label was created from the retained evidence and rubric?

This framework does not define a numeric formula for converting these answers into a 0–1 Need Label. That conversion belongs to a separately versioned Review Rubric and must be explicitly approved.

## 6. Relationship to the model

XGBoost learns statistical relationships between approved model features and human Reviewed Need Labels.

Therefore the quality of model learning depends on the quality and consistency of the human labeling process.

This framework is upstream governance for labels. It must not be converted into hidden model features or unreviewed synthetic labels.

The model must not be trained to reproduce unsupported reviewer bias merely because it appears consistently in historical labels. Bias review and fairness governance remain separate required work.

## 7. Relationship to synthetic examples

Synthetic cases may be created to:

- train reviewers;
- test whether a rubric is understandable;
- exercise edge cases;
- evaluate reviewer consistency;
- test system behavior in non-production environments.

Synthetic cases must be clearly marked and segregated.

They must not be treated as first-party Henna operational data and must not enter the governed Training, Validation or Evaluation partitions used to justify a Production model.

## 8. Versioning

Every material change to this framework receives a new framework version.

Every Review Rubric must declare the exact Judgment Framework version it implements.

A Reviewed Label must continue to carry its own rubric version. Historical labels are not silently reinterpreted when this framework or a rubric changes.

A future rubric change may require new review/label evidence rather than rewriting prior immutable history.

## 9. Explicit unresolved areas

This framework intentionally does not invent:

- the numeric mapping from reviewed evidence to the 0–1 Need Label;
- temporal-stability cohort construction;
- fairness groups;
- fairness metrics;
- fairness acceptance criteria;
- missing-value semantics for model features;
- statistical adequacy thresholds;
- Production acceptance thresholds;
- automatic ranking between XGBoost, EBM and the constrained baseline.

Those require separate explicit product/data decisions and evidence.

## 10. Governance consequence

From HENNA-AJF-v1 onward, the intended meaning of a Reviewed Need Label is:

> an accountable human judgment of need, produced under a versioned approved rubric that implements this framework, using permitted evidence and preserving uncertainty, without treating behavior, prior allocation or model output as ground truth.

The framework itself creates no label, dataset row, Proposal, Pilot authorization, allocation, payment, wallet mutation, Production authorization or runtime promotion.
