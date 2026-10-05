# ADR-042 — Henna-owned AI, no model API dependency

Status: Accepted  
Date: 2026-10-05

## Decision

Henna artificial intelligence is owned and operated by Henna.

The learning and inference implementation must not depend on an external AI/model
provider, an internal remote model service, or a network model API. Model code,
model/version metadata, training logic and produced candidate parameters remain
under Henna control.

The current allocation learner is therefore an in-process, deterministic Henna
implementation. A replaceable provider abstraction is intentionally not part of
the production architecture.

## Data boundary

Training data must be first-party Henna data.

For allocation learning, only snapshots recorded internally by Henna are
training-eligible. Human-attributed/manual assessment intake may be retained for
audit or research, but it must not receive a training label or enter a training
run.

The current persistence invariant is:

- first-party Henna snapshot: `RecordedByAccountId = null` and
  `EvidenceReference = null`;
- attributed/manual research snapshot: recorder/evidence provenance is present
  and is not training-eligible.

Training runs freeze the first-party inputs and record:

- `engine = HENNA_OWNED_LOCAL`;
- `networkModelApi = false`;
- `dataOrigin = HENNA_FIRST_PARTY`;
- model version, dataset version, cutoff, labels, baseline and metrics.

## Learning lifecycle

Henna does not perform uncontrolled online self-modification.

The allowed lifecycle is:

`Henna operational data → first-party snapshot → reviewed label → local offline
training → held-out evaluation → candidate proposal → independent human review`

An approved proposal is still not automatically production-active. Promotion or
activation requires a separate explicit product/governance contract and must
remain reversible and versioned.

## Network prohibition

The CreditLearning and allocation learner layers may not contain:

- `HttpClient`, REST/gRPC clients or direct HTTP/HTTPS URLs;
- OpenAI, Anthropic, Gemini, Azure AI, Bedrock, Semantic Kernel, Ollama or
  equivalent model-provider SDKs;
- a generic model-provider interface whose purpose is to swap in a remote model.

CI executes `tools/ci/guard_henna_ai_local_only.py` and fails if these
dependencies are introduced.

Normal Henna application APIs may manage authenticated administrative workflows
and human review. Those APIs are control-plane application endpoints; the
learner itself does not call or depend on them and consumes no network model API.

## Consequences

- No API key can enable or replace the Henna learner.
- A network outage cannot force allocation learning to a third-party model.
- Manual/imported research data cannot silently become training data.
- New model families must be implemented and versioned inside Henna and pass the
  same dataset, evaluation and human-review gates.
- This ADR does not claim that the current experimental learner is production
  ready or statistically adequate.
