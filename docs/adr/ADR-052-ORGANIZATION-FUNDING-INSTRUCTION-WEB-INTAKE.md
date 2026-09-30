# ADR-052: Organization funding instruction web intake

## Status

Accepted for Organization 004.

## Context

Organization 003 persists one source instruction reference per organization program in `PENDING_VERIFICATION`. The reference and the program's allocation mode are evidence for a later verification step; they do not prove that funds were received, that the organization may direct them, or that any allocation occurred.

## Decision

- The organization portal exposes the persisted instruction reference and its actual `PENDING_VERIFICATION` state.
- A Lead or Representative may submit a source instruction reference against the program's exact revision. A Technical Operator may read the state but cannot submit.
- The web BFF forwards the bearer only server-to-server from the HttpOnly session cookie, enforces same-origin on mutations, validates a strict DTO, and uses `no-store` responses.
- The UI displays the allocation mode returned by the persisted program/instruction and does not accept a second client-supplied mode.
- This intake does not collect or imply amounts, balances, beneficiaries, receipt, verification, or allocation results.
- The Figma allocation detail frame is used for the portal shell and information hierarchy. Its sample counts, example processing states, and start-allocation action are not represented as real functionality.

## Consequences

Organizations can enter and later inspect their external instruction reference. Source ownership and authority review, program execution, beneficiary intake, and allocation remain separate future capabilities that require their own persisted data and workflow.
