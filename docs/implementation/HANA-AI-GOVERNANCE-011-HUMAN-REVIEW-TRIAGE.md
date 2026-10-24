# AI Governance 011 — Human Review Triage Worklist (DRAFT)

Stacked on PR #178; this is a practical read-only **human worklist**, not another Dataset/admission or training service.

An authorized Admin explicitly selects 1–500 known qualitative-severity human review IDs and a nonfuture UTC cutoff. The backend inspects each exact selected ID alongside ALL stored human judgments and seven-factor reviews for its household, including across snapshots and after the cutoff, using **one PostgreSQL REPEATABLE READ transaction**. It reports only the review ID, structural reason codes, count of reviewed seven-factor versions and human judgments. Reason codes identify competing human reviews, competing feature reviews, abstention/conflicting evidence, post-cutoff source/review, and failed first-party source lineage.

`NO_STRUCTURAL_BLOCKER_NOT_ADMITTED` means only that this limited triage found none of the enumerated structural blockers. It does **not** prove complete source authenticity, sufficient numeric rubric, science/evaluation adequacy, fairness, approved missingness or source rights. Triage is never a Dataset builder, label conversion, recommendation, eligibility/credit/payment decision, resolution of competing reviews, model-promotion control or historical edit.

The API is ADMIN-only `POST /api/v1/admin/allocation-proposals/research/seven-factor/human-review-triage/preview`; Web uses same-origin cookie-secured no-store BFF and typed allowlist DTO, offers manual selected-ID triage from the existing partitions screen, and protects against stale responses. No household keys, review rationales, sensitive labels or evidence references cross the boundary. No new DB tables or mutating endpoint, and no threshold or invented correction policy.

Tests must validate real PostgreSQL competing review added after the original preview, conflict/abstention, competing feature review, invalid/unauthorized IDs and UTC cutoffs, Web parser/forged admission and actual full CI. iOS Native, Stage, QA Gate, Release, Merge and Production remain excluded.
