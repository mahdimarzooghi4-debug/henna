# HANA-ORGANIZATION-006 — Inspect recorded household referrals

## Business scope

Organization members can expand a submitted household referral and inspect the non-identifying qualitative fields recorded for each member. This makes the captured input reviewable before a later, separately approved process uses it.

## Behavior

- The detail view uses the existing tenant-scoped referral read response; it adds no API, persistence, status, or permission changes.
- It shows each member's gender category, life-stage category, education category, and chronic-support category, with unknown or unrecognized values rendered as “گزارش نشده”.
- It does not infer eligibility, score, need, review outcome, or any monetary state.
- It does not add identifying data or allow edits. Correction, retention, consent, and review workflows remain separate product decisions.

## Verification

The household referral browser smoke verifies that stored categories are visible after expanding a referral, while the no-eligibility/no-financial-state and mobile-layout assertions remain in place.
