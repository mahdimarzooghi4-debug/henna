# ADR-057 — Read-Only Cross-Model Comparison Evidence View

**Status:** Accepted  
**Date:** 2026-10-07  
**Area:** Allocation Learning, Admin Evidence Review  
**Complements:** ADR-053, ADR-056

## Decision

Henna provides one read-only Admin view that accepts an exact 64-hex ADR-053 Evaluation
fingerprint and places existing Profile Candidate, XGBoost Shadow and EBM Challenger benchmark
evidence side by side.

No new benchmark is computed by this view. The BFF reads only the three existing authenticated
benchmark endpoints and validates their responses fail-closed before returning data to the browser.
The browser validates them again before rendering.

## Comparability boundary

A shared Evaluation fingerprint is necessary but the UI does not assume it is sufficient.
For each evidence record it also exposes:

- baseline version;
- dataset version;
- source/funding instruction reference;
- runtime proposal identity;
- runtime profile sequence;
- cutoff;
- review rubric.

The view derives a boolean `lineageAligned` only from equality of these fields. If lineage is
not aligned, it displays a warning and does not call the evidence directly comparable.

This is a consistency signal, not a model-quality score.

## Historical evidence

Historical benchmark protocols remain visible even when they predate ADR-056 diagnostics.
New protocols require their diagnostic payloads fail-closed; historical rows may show those
fields as unavailable rather than receiving synthetic values.

Each underlying endpoint already pages at 20 records. The comparison view reads page 1 from each
family and returns `truncated=true` when any family fills that page, so the operator is never
told that the visible set is exhaustive when it may not be.

## Governance boundary

Evidence is ordered only by recording time. The view does not:

- rank models;
- infer a winner;
- define or apply a threshold;
- approve a candidate;
- create a Proposal;
- authorize a Pilot;
- promote or roll back Production;
- modify any benchmark, artifact or TrainingRun.

All responses remain no-store and require the existing ADMIN session boundary.
