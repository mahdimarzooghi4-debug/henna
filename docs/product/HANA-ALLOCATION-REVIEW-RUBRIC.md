# Henna Allocation Review Rubric Foundation

**Status:** Approved foundation; numeric label mapping not yet approved  
**Version:** HENNA-ARR-v1  
**Date:** 2026-10-09  
**Implements:** HENNA-AJF-v1  
**Area:** Allocation Learning, Human Review, Reviewed Need Labels

## 1. Purpose

This rubric translates the Henna Allocation Judgment Framework into a repeatable human review procedure.

It governs **how a reviewer reasons before recording a Reviewed Need Label**.

It does not define the numeric transformation from reviewed evidence to the existing 0–1 label. Until that numeric mapping is separately approved, this rubric foundation may be used for reviewer education, calibration, case review, and rubric QA, but must not be represented as a complete numeric labeling algorithm.

## 2. Required reviewer inputs

Before judgment, the reviewer must have access only to permitted, attributable evidence for the relevant review period.

At minimum, the review record must distinguish:

- authoritative first-party observations;
- human-reviewed evidence-backed observations;
- unknown/unavailable observations;
- historical system decisions such as prior allocation;
- behavioral telemetry such as usage or order activity; and
- prohibited inferences that are not evidence.

Unknown values remain unknown.

## 3. Review sequence

The reviewer follows this sequence in order.

### Step R1 — Fix the review period

Identify the assessment/review period.

Evidence outside that period must not silently rewrite what was known during the period under review.

### Step R2 — Establish provenance

For each material observation, identify whether it is:

1. authoritative first-party evidence;
2. human-reviewed and evidence-backed;
3. unknown/unavailable; or
4. unsupported inference.

Unsupported inference must not be converted into fact.

### Step R3 — Separate need from behavior

The reviewer must explicitly test whether the judgment is being driven by:

- credit usage;
- purchase amount;
- order frequency;
- unused balance;
- complaint activity;
- response/activity absence; or
- another behavioral proxy.

None of these is equivalent to need.

### Step R4 — Surface barriers

Known stock, delivery, access, or essential-needs coverage barriers must be considered when interpreting observed behavior.

A barrier may suppress visible activity.

If a barrier is unknown, the reviewer must not invent it.

### Step R5 — Remove circular evidence

The reviewer must not use any of the following as ground truth:

- current allocation formula;
- current model prediction;
- previous allocation amount;
- previous model output;
- feature importance; or
- SHAP value.

These may exist as system lineage or model diagnostics but do not define the human label.

### Step R6 — Preserve conflicts

If credible evidence points in different directions, the conflict must remain visible.

The reviewer must not discard inconvenient evidence or invent a causal story merely to make the case internally tidy.

### Step R7 — Preserve uncertainty

Unknown, missing, disputed, or insufficient evidence must remain explicit.

The reviewer must not substitute:

- zero;
- false;
- no need;
- no barrier; or
- normal state

for an unknown state.

### Step R8 — Separate need from authorization

The reviewer must confirm that their judgment does not itself decide:

- eligibility;
- payment;
- wallet mutation;
- settlement;
- funding authorization;
- Pilot;
- Production activation; or
- runtime promotion.

### Step R9 — Record review rationale

The rationale must be reconstructable by another authorized reviewer from the retained evidence and rubric version.

The rationale should identify:

- the principal evidence considered;
- material unknowns;
- material conflicts;
- known barriers;
- behavioral signals that were intentionally not treated as ground truth; and
- why the final human judgment was reached.

The rationale must not contain invented causal certainty.

## 4. Mandatory anti-bias checks

Before completing the review, the reviewer must answer all of the following:

1. Am I equating spending or credit usage with need?
2. Am I treating unused credit as proof of low need?
3. Am I treating absence of activity or complaints as proof of no need or no barrier?
4. Am I using a previous allocation or current formula as ground truth?
5. Am I copying or anchoring on a model prediction?
6. Am I converting missing evidence into a default value?
7. Am I inferring a cause or barrier that is not evidenced?
8. Am I hiding material conflicting evidence?
9. Am I mixing eligibility/funding authorization with need judgment?
10. Could another authorized reviewer reconstruct this judgment from the evidence and rubric?

A review that fails any applicable check must be corrected before it can be treated as rubric-compliant.

## 5. Reviewer training cases

Synthetic cases may be used to train reviewers on this rubric.

Training cases must include at least the following reasoning patterns:

- low usage with a known access barrier;
- low usage with barrier state unknown;
- high usage without proof of higher relative need;
- absence of complaint;
- previous high allocation;
- conflicting credible evidence; and
- missing outcome evidence.

Synthetic training cases are not first-party operational evidence and must never enter governed Training, Validation, or Evaluation model datasets.

## 6. Inter-reviewer calibration

Reviewer quality should be evaluated separately from model quality.

A future calibration protocol may compare multiple authorized reviewers on the same synthetic or independently governed case set.

This rubric does not invent:

- an agreement threshold;
- a minimum reviewer count;
- a disagreement resolution rule; or
- a statistical acceptance threshold.

Those require separate explicit approval.

## 7. Numeric label boundary

Henna currently stores Reviewed Need Labels on a 0–1 scale.

**HENNA-ARR-v1 does not define the mapping from reviewed evidence and judgment to that numeric value.**

No engineer, reviewer, model, or automation may infer or invent that mapping from this document.

A future approved rubric version or companion decision must explicitly define:

- the label semantics;
- the permitted numeric scale interpretation;
- how incomplete evidence affects labelability;
- how conflicting evidence is handled;
- whether abstention / insufficient-evidence is required; and
- any reviewer calibration protocol.

Until then, this document is a governed judgment procedure and reviewer-training rubric foundation, not a complete production labeling algorithm.

## 8. Versioning and lineage

Every material change receives a new rubric version.

Every Reviewed Need Label created under an approved complete rubric must retain its exact rubric version.

Historical labels are immutable and are not silently reinterpreted when the framework or rubric changes.

A future complete rubric must explicitly declare which Judgment Framework version it implements.

## 9. Model boundary

XGBoost does not read this rubric.

The model learns only from governed Reviewed Need Labels and approved model features.

This rubric must not be transformed automatically into:

- hidden model features;
- synthetic labels;
- synthetic production rows;
- model weights;
- allocation weights; or
- automatic model-selection criteria.

## 10. Definition of rubric-compliant judgment

A judgment is rubric-compliant only when:

- the reviewer used the correct review period;
- evidence provenance is explicit;
- unknowns remain unknown;
- behavioral proxies were not treated as need;
- current/past allocation and model output were not used as ground truth;
- material barriers and conflicts were preserved;
- the rationale is reconstructable; and
- the review stayed separate from eligibility, payment, and Production decisions.

This foundation creates no dataset row, no model input, no Proposal, no Pilot authorization, no allocation, no payment, no wallet mutation, no Production authorization, and no runtime promotion.
