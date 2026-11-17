# Henna seller pricing preview — operations alignment and seller discount interaction

Date: 2026-11-12
Requested from screenshot: `/seller/panel/pricing` (`HANA_AUTH_UI_PREVIEW=1`).

## Scope
- Align the **عملیات قیمت‌گذاری** column heading with the center of the action buttons in each table row. Use one semantic RTL HTML table / fixed colgroup so heading, cells and buttons never use unrelated column widths. Narrow viewports use horizontal scrolling.
- Preserve edit-price behavior on the existing sample rows, with validation and a visible local-only update.
- Add a **seller-driven discounted final price** preview to each sample row: seller enters the **final discounted selling price** in tomans; the view computes only the difference from the displayed sample original price, labels both prices clearly, and allows edit/removal.
- Reject non-integer, zero, negative, unsafe, or discounted-final-price >= original-price inputs. Accept Persian and Arabic digits without implicit rounding.
- A change to original price clears that row's preview discount rather than preserving an invalid historical relation.
- Keep the banner, dialog, notice, keyboard labels and tabular empty/no-API state explicit.

## Scope and authority boundary
This is a **design-only sample route**, not the production seller pricing workflow. No seller discount has been activated on a marketplace offer, quote, published catalog, or order. The existing operational `/seller/offers` API supports `priceRials` but does not provide an approved separate original/discounted price record and seller-defined discount contract. The approved Quote includes `discountIrr`, but that is not itself seller discount authorization.

Before shipping real seller discounts, the Business/Technical contract must define at least who may set them, amount model, optional duration, published price snapshots, offer version/revision, checkout/Quote projection and stale-price behavior, accounting/settlement, and auditable rollback. This preview does not invent those values or tie them to buyer subsidy/credit.

## Test evidence
- Pure tests for positive integer input, Persian/Arabic digits and strictly lower final amount.
- Real Chromium against CI-only `HANA_AUTH_UI_PREVIEW=1`: header/action alignment, discount open/invalid/save/cancel/remove, price edit, responsive scrolling, zero API mutations.
- Full backend/web/mobile/Android regression workflow still required prior to Stage integration.

Keep parent Seller PR #228 Draft/Open; no main merge or Production deployment.
