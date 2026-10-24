# AI Governance 010 — Explicit, bounded seven-factor manifest revalidation

**Status: DRAFT / research-only.** Stacked on PR #177.

An authorized human Admin who already produced a three-way seven-factor evidence preflight can explicitly request the exact same `trainingReviewIds`, `validationReviewIds`, `evaluationReviewIds`, immutable UTC `cutoffUtc` and previous lowercase `expectedSha256` to be revalidated. The endpoint `POST /api/v1/admin/allocation-proposals/research/seven-factor/partition-preflight/revalidate` runs the existing full human-reviewed partition preflight fresh, including real-first-party lineage and *all* selected household reviews even if added after cutoff, in one PostgreSQL REPEATABLE READ snapshot. No snapshot or review is silently updated, resolved or inferred.

Only exact equality to the earlier content-bound digest yields `UNCHANGED_HUMAN_PARTITION_STILL_NOT_ADMITTED`. Changed underlying content => 409 `SEVEN_FACTOR_MANIFEST_STALE`; invalid selection/provenance/competing reviews => fail closed, not a new approved digest. The operator must explicitly re-inspect and obtain a new preview, never auto-carry approval.

Read-only, no persisted Registry or Dataset, label numeric mapping, training, Evaluation, Model Candidate, Pilot, eligibility, credit allocation, wallet mutation or Production activation. Three nonempty disjoint groups remain a structural check — not proof of statistical representativeness, fairness, missingness, original document authenticity or completeness of a positive rubric. Unknown values remain unknown. No iOS Native. No Stage/merge/Release/Production without owner approval.

Validation requires real PostgreSQL security/replay/stale-after-conflicting-human-review tests and Web BFF+Node contract tests with explicit request identity and no-store session behavior. This digest is not a signature, immutable evidence store, or promotion token.
