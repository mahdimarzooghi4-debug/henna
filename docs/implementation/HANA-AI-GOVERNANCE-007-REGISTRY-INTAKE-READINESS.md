# AI Governance 007 — Read-only, digest-bound Registry Intake Readiness (DRAFT)

## Placement
`main → #166 → #170 → #171 → #172 → #173 → #174 → this stacked Draft PR`.

## Contract
An ADMIN explicitly chooses a persisted internal research artifact plus an exact independent Evaluation record. The read-only POST `/api/v1/admin/allocation-proposals/research/registry-intake-readiness/preview` reuses the governed technical preflight, which reopens an attested artifact and saved evaluation lineage in a PostgreSQL REPEATABLE READ snapshot. The response emits a stable SHA-256 manifest of the exact frozen *technical identities* (family, run, selected evaluation, dataset, funding instruction reference, artifact digest, protocol/version, and the existing execution foundation, if any). The manifest does not attest source rights or actual Evaluation data contents.

The returned seven-item checklist names known **unverified by this report** gates: complete approved numeric rubric; Dataset admission and source rights; independent Evaluation-content reattestation; temporal/fairness/missingness criteria; accountable human registry decision; Pilot and Production authorization; and explicit runtime promotion. Every gate has `verification=NOT_ATTESTED_BY_THIS_REPORT`. This is **not** a claim that no other evidence exists, nor an approval score.

The endpoint never writes a Registry entry, creates a candidate, registers a model, approves a Dataset, chooses a winner, launches a Pilot, invokes inference, or changes Production. The response has `registryRecordCreated=false`, `registrationAllowed=false`, `datasetAdmitted=false`, `approved=false`, `candidateCreated=false`, `productionCompatible=false`, `runtimeApplied=false`. The supported contracts are only current offline XGBoost and offline EBM, no new family, adapter, provider API or policy.

The manifest digest is for tracking the current reviewed input identities, **not** a signature, approval token, immutable Registry item, or future promotion authorization. Any future acceptance must revalidate the current authoritative data and obtain explicit human approval; this transient preview is not sufficient.

## Testing and governance
Backend unit tests cover digest determinism, drift, forged approval/status and EBM missing adapter; Node contract tests reject malicious flags, unauthorized model family and malformed shape; real PostgreSQL integration tests verify readback through existing selection/preflight path. Full CI including actual Chromium, PostgreSQL and Android native tests is required. No iOS Native, Stage, Release Approval, merge or deployment without owner instruction.
