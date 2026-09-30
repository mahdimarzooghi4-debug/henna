# HANA-ORGANIZATION-001 — Organization Portal access and profile

## Sprint boundary

Implements the first Organization Portal slice from discovery issue #109: a persisted organization record, explicit organization membership grants and revocations, and a read-only organization profile backed by active membership. The profile follows Figma `06 • Organization Portal / 02 Organization Profile` (`386:161`) and shows only the organization name and member role currently stored by this slice. Contact, representative, identity, allocation, finance, program, recipient, data-source, report, notification, and support values are not fabricated.

## Business and authorization decisions

- Organization onboarding and membership changes are platform-Admin operations.
- Organization roles are scoped to one organization: `ORG_LEAD`, `ORG_REPRESENTATIVE`, and `ORG_TECHNICAL_OPERATOR`.
- These roles do not enter Identity `role_assignments`. Admin authorization continues to resolve the bearer session and `ADMIN` assignment from Identity on every privileged API request.
- A user can read only organizations with an active membership for their authenticated account. The read endpoint accepts no organization ID, preventing caller-selected cross-organization reads.
- Membership grants, revocations, and organization provisioning retain actor/time metadata. Provisioning, grant, and revoke requests use idempotency keys; revocation uses revision 1 and is compare-and-set.
- The web browser uses only the HttpOnly session cookie with a same-origin BFF. The BFF alone forwards a server-side bearer, uses `no-store`, and validates the response shape.

## API and storage

- `POST /api/v1/admin/organizations` creates an organization and its initial membership atomically.
- `POST /api/v1/admin/organizations/{organizationId}/memberships` grants a membership.
- `DELETE /api/v1/admin/organizations/{organizationId}/memberships/{membershipId}` revokes a membership.
- `GET /api/v1/organization/profiles` returns the authenticated account's active organization profiles.
- Persistence uses the separate `organization` schema and migration history. Identity remains the account/session/ADMIN source; organization records do not share Identity's context.
- Web entry: `/organization`; BFF: `/api/organization/profiles`.

## Tests and gates

- EF model snapshot drift test.
- PostgreSQL/API coverage for anonymous and non-Admin rejection, provisioning replay, membership-scoped reads, no implicit Identity role, grant replay, revocation audit, revoke replay, and loss of access after revocation.
- Required CI gates: backend, web, mobile, Android. iOS is out of scope.

## Explicitly deferred

Allocation rules and reversals, program/credit workflows, beneficiary data and consent/retention, import/duplicate handling, source API connectivity/sync, financial reporting, organization contact/representative verification fields, notifications, and support require their own approved business policies and designs.
