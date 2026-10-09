# Henna v1.1 new-model-first conflict reconciliation — research foundation

**Decision interpreted:** The Product Owner asked that conflicting evidence be
resolved **on the basis of the newer model**. The only approved new contract
today is the seven-factor v1.1 human review plus the five-level, qualitative
human Need Severity assessment (ADR-063..067). There is **no trained or
Production-activated v1.1 model** that could lawfully arbitrate facts.

## Implemented executable result

\`AllocationNewModelConflictReconciliationService.PreviewAsync\` reads the
complete source snapshots, seven-factor reviews and five-level human judgments
for explicitly selected households, within one repeatable-read PostgreSQL
snapshot. It creates a deterministic, versioned SHA-256 covering *all* evidence.

- **One complete, coherent v1.1 human review**: retain that reviewed new-model
  reference; historical six-factor scores cannot overrule it.
- **More than one genuinely equivalent v1.1 human review** (same snapshot,
  seven feature values, housing/non-housing/other evidentiary references,
  observed pre-allocation evidence and approved severity): collapse to one
  canonical reference, using the smallest GUID only because the reviewed
  facts are exactly equal. All original IDs remain in the fingerprint.
- **Contradictory v1.1 reviewed facts or severity**: output
  \`AbstainedConflictingEvidence\` and **no numeric level/canonical review**.
  It never picks higher score, latest timestamp, or an AI prediction as truth.
- **Missing v1.1 review or incomplete/abstained human evidence**: explicitly
  exclude/quarantine instead of inventing a level or converting legacy data.
- **Invalid source/formula/rubric lineage**: output
  \`AbstainedInvalidLineage\`, never silently repair it.

This is an actual internal reconciliation result, but remains
\`RECONCILED_REVIEW_ONLY_DATASET_TRAINING_NOT_AUTHORIZED\`.
It does not rewrite or erase prior reviews, mutate the active six-factor
Commerce allocation, change historical credit journals, create
\`ReviewedNeedLabel\`/\`DatasetVersion\`/\`TrainingRun\`, train a model,
activate XGBoost or auto-promote seven-feature/geographic weights.

## Additional gates

The current strict three-partition preflight continues to **reject**
unselected new-model reviews until an approved selection/admission workflow
can consume a re-attested reconciliation manifest. Conflicting human facts
are quarantined, not promoted into learning. Real source-document authenticity
still requires accountable verification by the one authorized Admin per
ADR-067. Temporal/fairness/missing-data criteria, revision/supersession,
independent Evaluation and Pilot/Production gates are not invented.

PR #165 remains Draft/Open/Unmerged. No iOS, Stage, QA, Release, Production
or real-money workflow is activated.
