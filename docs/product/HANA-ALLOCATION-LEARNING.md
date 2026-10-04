# Henna allocation learning — foundation

Status: offline evaluation infrastructure; no trained AI, provider integration, HTTP endpoint,
database event collection, approval workflow, pilot activation or production deployment yet.

The Domain simulator compares a versioned baseline with proposed six-dimension weights.
It freezes household assessments and geography and compares unrounded POOL_NEEDS shares
in one funding pool governed by one source instruction. Units are rials. These previews
must never be posted to a wallet; settlement rounding and eligibility remain separate.
It does not alter the existing allocation calculator or historic allocations.

The Application proposal-provider interface is the boundary for a future statistical model.
There is deliberately no provider implementation or model credential at this stage.
Any provider output is an untrusted draft, not an approved coefficient version.

## Data and evaluation to add before training

Persist pseudonymous assessment snapshots, source instruction, formula/dataset version,
allocation result, timestamp, and structured outcome observations with retention controls.
Keep identity mapping and health details outside model datasets. Access must be authorized.
Track credit usage alongside stock availability, delivery/access constraints, essential-needs
coverage and reviewed complaints. Spending alone is not a need label; unused credit does
not automatically mean lower need. Define outcome labels and review their bias first.

Before accepting a candidate, evaluate on held-out time periods, inspect household and
regional impacts, report adequacy and fairness, and account for incomplete observations.
The simulator provides numeric changes only; it does not certify fairness or improvement.

## Human-controlled rollout

Draft -> validated candidate -> offline comparison -> human review -> limited pilot ->
explicit activation. Implement durable reviewer identity, rationale, audit history,
authorization, rollback and pilot limits before allowing activation. Maintain a fixed
coefficient version for each allocation run; never silently recalculate earlier grants.
Human approval of a coefficient does not override the funding source's instructions.

Start with a simple statistical model when adequate reviewed data exists. A language model
may explain reports, but must not infer diagnoses, replace eligibility review, or decide
payments. No model is claimed to be trained by this foundation.
