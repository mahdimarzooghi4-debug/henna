# Seven-factor + geographic parameter proposal: research-only pool comparison

**Contract:** ADR-063 and ADR-064; existing versioned MPI normalization in
`NeedsBasedAllocationV1`, active seven-factor preview in
`NeedsBasedAllocationV11`. **Status: testable offline Domain simulator,
not approved model learning, training or deployment.**

The Product Owner authorized Henna AI to *propose* both seven-dimensional
coefficient changes and changes to geographic parameters. Neither approval
licensed an arbitrary model-training algorithm, numerical promotion threshold,
new MPI values, geographic data vendor, or automatic Production activation.

`SevenFactorScenarioComparison.ComparePool` allows an explicit, reviewed
versioned cohort to be compared under:
- the **approved initial** seven-dimensional coefficient profile, frozen
  source geographic factor and `floor(B*H_i*G_i/sum(H_j*G_j))`;
- a **separately versioned proposed** seven-coefficient vector;
- optionally a **separately versioned geography research draft** with explicit
  MPI bounds and capital adjustment, pinned to its TrainingRun,
  Independent Evaluation, and exact source geography dataset version.

All MPI inputs must be sourced from the exact same geography dataset and
the recorded baseline geographic multiplier is re-calculated from that
source data with the existing approved formula; mismatch fails closed.
The exact pool and floor-to-rial, independent unallocated remainder,
per-household delta, and unchanged baseline are tested. No redistribution,
wallet mutation, provider call, dataset admission, experimental learning
activation or Production calculation occurs.

**Proof boundary:** Domain inputs and research draft IDs are typed, not
independently authenticated external proofs. An application adapter to
load source first-party reviews, trusted MPI dataset and attested successful
training/evaluation is still needed before real operator usage. A potential
offline proposed coefficient vector is not inferred from feature importance
or SHAP; proposing it requires a separate approved objective.

**Remaining business decision:** complete positive numeric Need Severity
rubric and admissible evidence/abstention protocol. **Remaining model
governance:** independent Train/Validation/Evaluation with disjoint
households, fairness/temporal/missing-data evidence, no automatic winning
model or Production promotion. Funding-source dual verification and external
PSP remain independently required for real use.

PR #165 stays Draft/Open/Unmerged. No Stage, iOS, QA Gate, Release,
Production or Recovery implied.
