# ADR-067 — Single authorized Admin is sufficient for evidence authenticity review

**Status:** ACCEPTED Product Owner decision, 2026-10-09.
**Scope:** Henna human Need Severity evidence review, building on ADR-065 and ADR-066.
**Delivery boundary:** Draft PR #165; no Stage, QA Gate, Release, Production or numeric dataset admission.

## Decision

A **single authorized Henna Admin**, who may also be the same actor who
records the seven-feature household assessment and chooses the five-level Need
Severity judgment, is **sufficient as the responsible human authority** for
reviewing and attesting the authenticity of supporting evidence. A separate,
independent second reviewer or two-person signoff is **not mandatory**.

This does not authorize automatic evidence verification or automatic severity
scoring. The accountable Admin must actually inspect the underlying attributable
pre-allocation source, check its relevance, consistency and authenticity, and
record their identity, the specific evidence reference, the observation time,
the chosen level or explicit abstention, and a reason. The review remains
auditable, append-only and bound to a real first-party source snapshot.

A textual evidence reference, source ID, or a role check **alone** cannot
technically prove a document is genuine. The current internal intake records
the accountable Admin's review; it cannot represent a missing evidence
provider or pretend to have cryptographically/externally authenticated a
document. Therefore human acceptance of the authenticity-review role is not
a blanket admission of unknown or unverified data. If evidence is insufficient
or conflicting, the Admin must abstain with null rather than score zero.

## Technical fit and acceptance

- The existing \`AllocationQualitativeSeverityReviewService.RecordAsync\`
  requires the Admin role and uses the **same accountable reviewer** for the
  severity decision, evidence reference and rationale. It requires valid
  source snapshot/review lineage, pre-allocation evidence time, and immutable
  review replay. No second-actor requirement is introduced.
- Existing PostgreSQL tests explicitly use **one same authorized Admin** to
  review both the seven-feature assessment and the corresponding need severity
  evidence. Unauthorized actors are rejected. The test additionally asserts
  that the identity stored as the severity reviewer is this same Admin.
- Corrections use a new immutable review ID; conflicting/insufficient evidence
  requires abstention; never silently prefer the latest conflicting review.

## Remaining independent admission gates

This decision settles **only the responsible authenticity-review actor**.
A separate complete numeric rubric/admission contract, recorded source
evidence verification workflow and provenance, correction/withdrawal
semantics, disjoint household/temporal Train–Validation–Evaluation splits,
missing-data and fairness evaluation, model selection and Pilot/Production
authority remain unresolved. The existing five-level scale and qualitative
anchors are human decision criteria, **not** an automatic positive Dataset
admission or an approved Production model target.

Neither XGBoost/EBM TrainingRun nor real-money allocation, geography parameter
promotion, wallet mutation or any Production action may be triggered by this ADR.
