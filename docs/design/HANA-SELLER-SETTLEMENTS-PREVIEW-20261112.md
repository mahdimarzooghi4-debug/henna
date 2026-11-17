# Henna Seller Panel: retire Programs preview, add bounded Settlement sample

Date: 2026-11-12  
Parent Stage branch at implementation: `feat/public-seller-registration-intake`  
Screenshot reference: Seller Panel, Programs `/seller/panel/programs` and Settlements `/seller/panel/settlements`.

## Owner-requested scope

1. Remove **طرح‌ها و اعتبارها** from seller-panel sidebar and routing. Old preview-only bookmarks redirect to the settlements preview. This does **not** remove real programs, credits, organization finance or policies from any Backend context.
2. In the **تسویه‌حساب‌ها** design preview, replace blank dashes with explicitly synthetic, internally consistent example settlements:
   - settled: 420,000 + 1,470,000 = **1,890,000 toman**;
   - pending: **640,000 toman**;
   - eligible: an example **group of 4 orders**, not a rule for settlement eligibility.
3. Use a single semantic RTL table and shared colgroup for all five columns. Align header and per-row badges for **وضعیت تسویه** on one centered column; horizontal scroll on small viewports.
4. Export to a clearly labeled **sample CSV** suitable for Excel; it contains only local static data. Do not suggest this is a real settlement export.

## Product/authority boundary

All amounts, references, dates, statuses and aggregate numbers are **design fixtures**, not contractual entitlement, payment evidence, bank settlement, API responses or production accounting. This page performs **zero settlement API reads and writes**, supports no business mutation, and is accessible only through the existing `HANA_AUTH_UI_PREVIEW=1` Stage/CI gate. No fake provider, payment, bank integration or entitlement policy is introduced. The real authorization, accounting and settlement contracts remain outside scope.

## Verification

- Unit assertions: correct summary totals, nonempty statuses, unique sample IDs, valid numeric values.
- Real Chromium: removed menu, old URL redirect, four synthetic table rows, heading/status center alignment, sample CSV download, small-screen horizontal scroll, no settlement API mutations, no page errors.
- Run exact-head Web + Backend + Mobile + Android CI before integrating this Draft PR.
- Do not merge into the Stage branch or deploy without explicit owner instruction: Stage watches its parent branch and can auto-deploy.
