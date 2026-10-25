# HANA AI Governance 012 — Seven-factor triage fingerprint revalidation

## Purpose
The human-review triage worklist is descriptive. Its reason codes and per-household counts are not an admission decision. Operators also need to know whether the persisted source content changed after a report was displayed.

## Implementation
- The existing PostgreSQL REPEATABLE READ triage snapshot emits a deterministic lowercase SHA-256 over the exact selection, cutoff, selected human review content (including rationale and evidence reference), selected seven-factor assessments, source snapshots, all sibling source/feature/human-review records for selected households, the resolved source-lineage result and displayed reason/count rows.
- The new ADMIN-only revalidation endpoint recomputes the report against a fresh PostgreSQL snapshot. It returns unchanged only if the newly computed fingerprint exactly matches the explicit previously displayed digest. A stale digest returns HTTP 409; it never silently replaces the expected digest.
- Web BFF checks same-origin POST, session, bounded body, exact keys and digest format, and strictly validates response digest equality and all non-admission flags. The UI invalidates the prior result on selection/cutoff changes and clears stale worklists after HTTP 409.
- PostgreSQL integration test appends a later conflicting human review without rewriting immutable evidence and proves that the old digest is rejected. Web tests reject forged digests, status and admission flags.

## Boundaries
This verifies current stored-content stability, not the authenticity of external evidence, consent, reviewer independence, statistical adequacy, fairness or label quality. It does not select a winning human review, resolve conflicts, mutate evidence, admit a Dataset, create labels, train/evaluate a model, change allocation weights or apply runtime settings. All output remains NOT_ADMITTED; production authorization remains separate.
