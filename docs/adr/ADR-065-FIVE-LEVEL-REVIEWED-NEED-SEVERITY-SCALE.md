# ADR-065 — Approved human five-level Need Severity scale

**Decision:** Accepted numeric scale by Product Owner on 2026-10-09.
**Scope:** A partial review scale, NOT a complete positive numeric-label rubric, dataset admission or Production permission. Draft PR #165 stays open and unmerged.

| Human review level | Score |
| --- | ---: |
| No unmet essential need | 0 |
| Low | 0.25 |
| Moderate | 0.50 |
| High | 0.75 |
| Critical | 1.00 |

Only an accountable human reviewer can select a level. If evidence is insufficient or contradictory, the review must abstain: **NULL is different from zero**. The five values are fixed; intermediary scores must not be fabricated. The state of the household must relate to evidence from **before** allocation, not post-allocation spending, wallet balances, original allocation formula, model predictions or outcome of Essential Needs Coverage.

The Domain `ReviewedNeedSeverityScaleJudgment` provides these five values and explicit `SufficientAndConsistent`, `Insufficient` and `Conflicting` evidence dispositions. `ReviewedNeedSeverityEvidenceV1` validates reviewer identity, reference to an already reviewed seven-factor input, evidence reference, UTC temporal order and rationale. These are **typed provisional review contracts only**: linked reference strings are not independent proof of authentic evidence.

**Not authorized by this decision:** assigning any level automatically, deciding precise evidence criteria that distinguish levels, a positive approved numeric Rubric Version, migrating existing six-feature labels, emitting a new `ReviewedNeedLabelRecord`, or triggering Dataset/Training/Evaluation, XGBoost/EBM, coefficient or geographic promotion. Existing foundation identifiers `HENNA-AJF-v1` and `HENNA-ARR-v1` remain non-labeling. Independent post-allocation essential-needs coverage remains a distinct target and cannot become need severity.

**Next product decisions:** evidence criteria and abstention/disagreement standard per level, accountable rubric approval authority, version lifecycle and admission rules, fairness/temporal/missing-data contracts and model-acceptance criteria. Only then can a safe persisted review and seven-feature positive Dataset admission be connected to real training. Real external bank/Finance Manager proof remains separately required for actual funding.

No iOS, Stage, QA Gate, Release, Production or Recovery action is authorized.
