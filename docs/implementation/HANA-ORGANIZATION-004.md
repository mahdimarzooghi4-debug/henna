# HANA-ORGANIZATION-004 — Funding instruction web intake

## Scope

Connect the organization portal to the Organization 003 funding instruction API. The list links to an allocation detail view that shows the persisted program mode and, once submitted, the real instruction reference and `PENDING_VERIFICATION` state. A permitted member can submit a source instruction reference for the exact draft revision.

## Boundaries

- Lead and Representative can submit; Technical Operator is read-only. The API remains the authorization authority.
- The browser uses same-origin BFF routes and the HttpOnly session cookie. Bearer tokens are never exposed to client code.
- All reads and mutations use `no-store`; mutations enforce same-origin and strict request fields.
- The mode is read from the persisted program/instruction.
- No amount, funding balance, beneficiary, receipt, verification result, or allocation is fabricated or created.
- The allocation detail layout follows the approved Figma node `386:1414`; the Figma's sample rows and start-allocation control are not implemented as live data or actions.

## Verification

- Web typecheck and production build.
- Browser smoke test for submitting and reading a pending instruction with a narrow viewport.
- Isolated HTTPS BFF test for HttpOnly-cookie isolation, server-only bearer forwarding, same-origin rejection, strict DTO validation, and `no-store` behavior.
- CI gates are backend, web, mobile, and Android. iOS is out of scope.
