# Independent evidence fingerprint re-attestation — internal foundation

**State:** Draft PR #165, read-only Backend guard, not an approval gate for datasets or models.
**Authority:** ADR-052, ADR-063, ADR-064; `HANA-SEVEN-FACTOR-INVENTORY-PREVIEW-002.md` and `HANA-ESSENTIAL-NEEDS-COVERAGE-INVENTORY-003.md`.

## Purpose

Previously generated read-only fingerprints should not be trusted merely
because they were once produced by a reviewer. Before any future, separately
authorized downstream admission, the exact selected evidence and cutoff can be
rechecked against current DB snapshots and explicitly compared with the
expected fingerprint.

## Implemented

`AllocationIndependentEvidenceReattestationService` exposes two **separate**
internal read-only methods:

- `ReattestSevenFactorAsync` requires an exact seven-factor manifest contract
  version, explicitly selected immutable Review IDs, UTC cutoff and SHA-256.
- `ReattestCoverageAsync` requires a different exact coverage-evidence
  contract version, explicitly selected human-reviewed outcome Event IDs, UTC
  cutoff and SHA-256.

Both call their *own* existing authorized independent inventory preview
and repeat its source-lineage/identity, review/provenance, cutoff, duplicate
and positive-observation checks. Each uses constant-time digest comparison
and returns only match/non-match, count, source kind and **not admitted** status.
A cross-stream digest cannot be passed as proof for the other stream.
Any missing or changed source prevents re-attestation.

This **does not join the two objectives**, infer causality or train on either.
Even when `Matches=true`, the result proves only equality of the inspected
representation; it is not positive numeric Need Severity Rubric approval,
verification of external evidence itself, Dataset Admission, a model threshold,
Production selection or eligibility for wallet/credit changes.

## Guardrails

- The existing six-factor operational formula and historic grants are intact.
- No new HTTP interface, persistent approval/consent state, training run,
  dataset record, candidate, geographic model or promotion is created.
- Existing human-reviewed Essential Needs Coverage values remain independent
  and nullable, and zero remains a valid observation rather than missing.
- Synthetic PostgreSQL tests verify correct replay, cross-stream mismatch,
  malformed fingerprints, unauthorized access, changed cutoffs and no
  legacy need labels or Training Runs produced.

**Unresolved:** a complete approved positive numeric Need Severity Rubric,
real-evidence verifier, dataset admission and training/evaluation household
partitions, and temporal/fairness/missing-data contracts.

PR #165 remains Draft/Open/Unmerged. No Stage, QA Gate, Release, Production,
iOS or Recovery operation follows from this read-only guard.
