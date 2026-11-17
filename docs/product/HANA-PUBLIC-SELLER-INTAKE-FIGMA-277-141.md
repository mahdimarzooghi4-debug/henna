# Seller registration — Public Intake and Figma alignment

**Reference provided by owner:** [Seller registration Figma copy, page 277:141](https://www.figma.com/design/DVExfCo8ziZnf5ULDTOqer/henna-platform--Copy-?node-id=277-141)

## Confirmed owner decision

Seller registration must be open to the public, independently of a buyer account or shopping session. A person wishing to sell goods or provide services must be able to submit an application without first signing in to the buyer account.

**Registration submission is not identity verification, approval, seller activation, catalog publishing, payments or store access.** Do not bypass those later gates.

## Figma reference inventory

The supplied copy contains nine WEB desktop frames on page `277:141`:

- `277:151` Start: standalone introduction, benefits, **شروع ثبت‌نام جدید**, **قبلاً ثبت‌نام کرده‌ام**, prior-application options.
- `277:255` Applicant Type.
- `277:376` Identity (includes a multi-state verification concept).
- `277:564` Business Information.
- `277:703` Activity Area.
- `277:839` Additional Information.
- `277:1168` Review.
- `277:1345` Submitted.
- `277:1467` Status.

Nine MOBILE frames also exist: `282:8, 282:68, 282:119, 282:232, 282:298, 282:479, 282:552, 282:671, 282:710`. Figma copy is user-supplied reference for this task; no canonical approval of other pages is inferred.

## Implemented bounded slice (Draft, not production-ready)

- `/seller/register`: responsive standalone Start, optional login link, public CTA and prior-application links. Reuses existing logo, font and palette; no downloaded temporary Figma asset URLs.
- `/seller/register/new`: public applicant stages 2–8, no buyer login check.
- `/seller/register/public-status`: browser-specific receipt, whose secret stays in HttpOnly cookie.
- Account-attached legacy drafts remain available at `/seller/register/account`; their original server-side authentication, per-account revisions and approval/activation contract remain intact.
- A separate, immutable `RECEIVED` public intake table is not added to `seller.registration_drafts`. No identity/account is forged or automatically linked, and no seller access is granted.
- Public submit uses same-origin, server-side input validation, bounded request size, rate limiting, per-browser opaque random receipt and exact-payload idempotency. Tracking code alone never authorizes PII access.

## Not yet delivered or authorized

This slice **does not** implement independent SMS/identity verification, confidential national-ID capture, actual review of public intake cases in Admin, assignment of a public intake to an approved/verified applicant, integration into `seller.registration_drafts` or seller activation, durable in-progress draft resumption across browsers, or owner-defined retention and abuse handling. The Figma identity frame's verification variants are references, not permission to mark unverified persons as verified.

A fully operational public-onboarding release still needs a reviewed, versioned contract for these steps and authoritative end-to-end testing and sign-off. Do not use the public receipt as evidence of approved seller onboarding.

## Release gates

Draft PR, backend and Web tests, exact-head CI, Code Review; no Stage or Production deployment before explicit owner instruction. Existing approved Figma layouts outside the supplied seller registration screen remain unchanged.
