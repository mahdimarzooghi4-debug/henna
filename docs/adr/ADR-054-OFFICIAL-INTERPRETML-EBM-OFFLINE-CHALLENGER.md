# ADR-054 — Official InterpretML EBM Offline Challenger

**Status:** Accepted  
**Date:** 2026-10-07  
**Area:** Allocation Learning, Model Comparison, Explainability  
**Complements:** ADR-048, ADR-051, ADR-053

## Decision

Henna starts the EBM model family as an offline research challenger using the official
InterpretML implementation, pinned to `interpret-core==0.7.8`.

This is not a network model service and it is not part of the Production allocation runtime.
The tool lives inside the Henna repository, runs locally, consumes an explicit reviewed
Training/Validation bundle, and produces an immutable SHA-256-attested artifact plus metrics.

The first Henna EBM model version is:

- model version: `henna-ebm-v1-offline`;
- artifact format: `henna-ebm-portable-json-v1`;
- official library: `interpret-core 0.7.8`;
- objective: regression / RMSE;
- interactions: disabled for v1;
- monotonic constraints: not set.

No monotonic direction is inferred by engineering. Any future monotonic constraint requires an
explicit product/policy decision for the affected feature.

## Partition and data boundary

The challenger accepts only first-party reviewed Training and Validation rows. Evaluation rows
are rejected from fitting and remain reserved for independent model comparison.

Training and Validation households must be distinct, use one rubric, and satisfy the existing
Henna engineering minimums of at least 30 Training and 10 Validation rows. These minimums remain
engineering guards; they do not establish statistical adequacy for Production.

The official InterpretML fit receives the caller's frozen Training/Validation assignment through
its explicit bag definition so Validation is held out from fitting.

## Artifact boundary

The tool stores the official InterpretML JSON model inside a Henna portable JSON envelope and
adds a complete prediction lookup over the current six Henna score features, whose domains are
exactly 0..3. The lookup has 4^6 = 4096 entries and permits a later in-process .NET evaluator to
reproduce EBM predictions without a Python inference service.

The artifact contains model structure/predictions, not household or reviewer identifiers. Its
bytes are SHA-256 attested. Training metrics and the exact library/model version are stored in a
separate report.

## Governance boundary

This slice does not:

- select EBM or XGBoost as a winner;
- define an approval or Production threshold;
- create an Allocation Proposal;
- authorize a Pilot;
- activate or modify a Production runtime;
- add a Python or EBM dependency to the API/worker runtime;
- use an external/internal network model API.

The next governed integration may register this artifact against frozen Henna Training Run
lineage and evaluate it on the same ADR-053 Evaluation-set identity already used by XGBoost.
