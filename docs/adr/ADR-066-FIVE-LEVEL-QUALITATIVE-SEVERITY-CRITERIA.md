# ADR-066 — Approved qualitative criteria for human Need Severity

**Accepted product decision:** 2026-10-09. The Product Owner accepted the five qualitative severity anchors as the basis for selecting the already approved five-level numeric scale (ADR-065).
**Implementation:** Domain contract, human-reviewed append-only intake and PostgreSQL tests. This does NOT approve training admission, Stage, release or Production.

| Human level | Value | Approved qualitative anchor |
| --- | ---: | --- |
| No unmet essential need | 0 | Adequate evidence establishes that no essential need is unmet |
| Low | 0.25 | A limited unmet essential need, without a serious or immediate risk |
| Moderate | 0.50 | An identifiable unmet essential need disrupts the provision of an essential necessity |
| High | 0.75 | Serious unmet essential need with an important consequence in the near term |
| Critical | 1.00 | Immediate threat to health, safety, or access to vital essential needs |

The above anchors are **qualitative**. They add no arbitrary days, thresholds, cash amounts, income bands, or incident counts. A human reviewer must explicitly select both the level and matching anchor, with a reason and evidence of the household state *before allocation*. The system checks consistency but never generates or upgrades a level by reading the evidence text. Adequate documentary evidence and absence of an unmet need are required for zero; unknown is not zero. Insufficient or conflicting evidence requires **abstention with null**, without a qualitative anchor.

## Independent review-intake contract

- An authorized Admin records the qualitative human selection against a real, first-party, lineage-attested and already reviewed v1.1 seven-feature snapshot.
- Mandatory reviewer, rationale, reference to pre-allocation evidence, and an evidence observation time no later than the original assessment.
- Explicit review ID, actor/content-bound idempotency, relational source foreign keys, DB checks, audit timestamps, and an append-only trigger. Corrections are separate immutable records; no implicit latest-wins.
- This new table is **separate from** numeric \`need_labels\`, the six-feature TrainingRun and the two independent evidence inventories. Existing commerce and production-profile code is unchanged.

## Evidence authenticity review authority — ADR-067

The Product Owner accepted that the **same authorized Henna Admin** may review
and take responsibility for evidence authenticity, enter the reviewed
seven-factor input, and record the human Need Severity decision. A second
independent reviewer is not mandatory. This is a human accountability decision,
not proof that a bare evidence reference has been authenticated. Existing
first-party lineage, evidence reference, pre-allocation time, rationale,
abstention and immutable audit requirements remain compulsory.

## Boundaries still requiring decisions and verification

Even an accepted qualitative criterion does not prove that an external evidence reference is genuine or resolve conflicting reviewers. A **complete positive data-admission rubric** additionally requires verifiable source/evidence requirements and authority, dispute/withdrawal/correction policy, household and temporal Train/Validation/Evaluation partitions, minimum real-data sufficiency policy, missing-data behavior, fairness and acceptance governance, and independently authorized Dataset/Training/Evaluation/Pilot. No invented model objective, weight derivation, geographic learning parameters, thresholds or automatic runtime promotion.

Approved current Product decisions are recorded; the remaining contracts must be resolved before model training or Production. PR #165 stays Draft/Open/Unmerged, no iOS Native, Stage or real-money operation.
