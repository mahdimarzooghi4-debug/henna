# Seller 019 — Offer Contract Readiness Backlog

## Business outcome

Prepare a safe Seller Offers implementation without choosing unapproved commerce rules. For the current Henna release, sellers should eventually be able to create and manage offers for published supermarket goods from an activated seller account. Catalog remains the owner of product identity and operator-reviewed media; Seller owns its commercial offer.

## Decisions already recorded

- **Current release covers supermarket goods only. Services are out of scope.** This product decision was recorded on 2026-09-26 from the product owner.
- A seller selects an already published Catalog product. Seller does not create a global Catalog identity.
- The selected Catalog image is operator-reviewed. Seller does not upload an image or enter an arbitrary image URL.
- New offers begin as inactive drafts.
- Requests must resolve the authenticated account, current Identity `SELLER` role, and approved and activated application on the server.
- Offer review and seller activation remain separate states. An approved application alone does not grant panel access.
- No Admin UI is in scope without an approved Admin Figma design.
- Figma Seller Panel references remain `260:697`, `261:10`, `261:184`, `261:347`, `259:257`, `259:338`, and `259:583`. Figma sample names, prices, units, inventory, availability, and image data are not production values. Service screens and service-specific fields are deferred with services.

## Current baseline

Catalog 006 adds a reviewed-media model and API. Public Catalog responses expose an image only for an approved asset associated with a published product and category. Stage and Production still require configured object-storage credentials and operational access.

Seller 018 records the Offer foundation and identifies open dependencies. Seller access currently does not enable the listings capability. This backlog does not change runtime behavior or enable that capability.

## Decisions required before a goods Offer implementation

The product owner and technical owner must record these decisions with an explicit source and date before a runtime implementation begins:

1. **Goods unit and precision**
   - Which canonical units are valid for each relevant Catalog product?
   - What is the stored quantity representation and precision, including fractional quantities and conversion rules?
   - What unit and quantity labels may Seller and buyer screens display?

2. **Offer publication**
   - Does a seller's offer remain a draft until the seller explicitly publishes it?
   - Is a separate review required before an offer becomes buyer-visible?
   - Which role or process may approve or withdraw an offer, and what audit is required?
   - What happens to an offer if its Catalog product, category, or approved image is no longer public?

3. **Media operations for Stage and Production**
   - Which configured object-storage account, bucket, region, and access controls are approved?
   - Who can upload and review assets while no Admin UI exists?
   - Are the existing Catalog 006 image limits and single-primary-image behavior accepted for these environments?

These are decision prompts, not proposed defaults. Do not infer answers from screenshots, examples, existing sample values, or implementation convenience.

## Implementation entry criteria

A subsequent goods Offer implementation backlog may start only when:

- Goods unit and precision, and Offer publication policy, have explicit decisions recorded.
- Stage has a real Catalog media configuration and a permitted operator upload/review path; Production readiness is tracked separately before release.
- Published Catalog identities and their approved media are supplied through the real Catalog workflow, not fixtures presented as business data.
- The approved Seller flow and existing Figma frames are reconciled without adding an Admin UI or bringing services into this release.
- Acceptance criteria, API ownership, state transitions, authorization, audit, idempotency, optimistic revision, and rollout gates are reviewed.

Service availability is not a prerequisite for the current goods-only release. Adding services later requires a separate business decision and availability backlog; goods stock must not be reused as a service model.

## Acceptance criteria for closing this backlog

1. Each remaining open question above has an explicit decision, owner, source, and date, or is explicitly deferred with a reason.
2. The technical contract keeps Seller Offer separate from Catalog product identity and Catalog media.
3. Goods quantities use a validated canonical unit and precision contract.
4. Draft and buyer-visible states have explicit authorized transitions and review/audit requirements.
5. Image visibility remains limited to approved Catalog media on public Catalog identities.
6. No offer can be purchased until an actual order/payment flow and its release gates exist.
7. Seller listings capability remains disabled until a real end-to-end Seller Offers API and usable Seller UI are delivered.
8. Services remain outside this release unless the product owner changes scope.
9. CI criteria remain backend, web, mobile, and Android only. iOS is out of scope.

## Scope

This PR is backlog clarification only: no API, database migration, UI, sample offer, pricing, stock, service schedule, publication behavior, Admin UI, or capability change is included.
