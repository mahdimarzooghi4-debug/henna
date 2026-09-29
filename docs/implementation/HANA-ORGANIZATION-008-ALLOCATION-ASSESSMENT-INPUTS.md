# Organization 008 — Qualitative household assessment inputs

## Purpose

Organization 005 captures household members and location; Organization 007 adds housing tenure. Those facts alone do not fully satisfy `HouseholdNeedAssessmentInput` in the needs-based scorer. This slice records the remaining qualitative household classifications required by the current scorer, without calculating a score, quote, eligibility decision, or credit amount.

## Collected values

The household referral records these qualitative classifications using the scorer's existing version 1.1 categories:

- Health burden: no ongoing treatment, one manageable case, high/limiting or multiple manageable cases, or severe/multiple high-burden cases.
- Economic hardship: essential needs generally met, occasional shortfall, recurrent shortfall/essential debt, or multiple unmet needs/severe instability.
- Care and support: effective support, one responsible adult without dependents, lone caregiver/limited support, or no practical support with multiple dependents/high care burden.
- Education attainment: bachelor's degree or higher, diploma/associate, below diploma with formal education, or no literacy/formal education.
- Housing tenure: owner or tenant (Organization 007).

Household size and age bands continue to come from the submitted member list. Each older adult also receives an explicit practical-support answer; a missing answer is rejected on new submissions. Non-older-adult members must have `needsPracticalSupport=false`.

Individual education and chronic-need categories remain in the referral for household context. The API does not infer a household scoring category from them because no aggregation rule has been approved.

## Storage and compatibility

The new columns are nullable in the database so historical referrals are not assigned invented values. New submissions must provide all four household classifications and an explicit support answer for each member. Read models report missing historical values as null.

The BFF uses a strict allowlist, same-origin checks, the HttpOnly session cookie, server-only bearer forwarding, and `no-store`. The API validates enum values, persists the inputs with the referral, and includes them in idempotent replay equality checks.

## Not included

This change does not map referral records into `HouseholdNeedAssessmentInput`, compute the needs score, determine eligibility, create allocations, or write wallet/ledger data. That integration must use canonical geography records and the approved funding-instruction mode/source; it remains a later backend slice.
