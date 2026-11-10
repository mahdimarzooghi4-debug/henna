# Buyer app coordinated reconciliation — Figma Buyer Journey 181:2

Reference: https://www.figma.com/design/DVExfCo8ziZnf5ULDTOqer/henna-platform--Copy-?node-id=181-2

Owner scope (2026-11-10): buyer app only, all in-scope mobile pages in one coordinated journey. No changes to seller, web marketplace, Admin, organization portal or iOS-native. Do not mark complete until every route is functional, design reviewed, actual browser/Android tested and Stage admission succeeds. Preserve already-approved home. Design assets and sample prices are isolated in explicit offline browser preview. Real catalog, identity, seller comparison, payment/order and support must use existing authoritative API contracts; no sample data in production.

| Frame | Route/capability | Reconciliation evidence |
|---|---|---|
| 194:4 | Home | Prior PR220/221; both All actions now navigate to Products |
| 227:8 | Products | New dedicated two-column catalog within BuyerBrowseScreen; same image hashes, shared cart, search/filter and real public catalog path |
| 227:123 | Detail | Preview title, image, quantity, shared cart; actual live detail component retained; visual acceptance pending |
| 227:208 | Basket | Preview item rows/quantity/remove/sample total, comparison entry; actual BuyerCartScreen retained; visual acceptance pending |
| 227:302 | Seller comparison | Preview route shows honest unavailable state; no fabricated offers; full API-backed visual reconciliation pending |
| 227:422 | Basket review | Pending |
| 227:549 | Checkout | Existing BuyerCheckoutScreen; full reconciliation pending |
| 227:634 | Order success | Pending; requires successful authoritative order |
| 227:706 | Tracking | Existing BuyerOrdersScreen; reconciliation pending |
| 227:797 | Orders | Existing BuyerOrdersScreen; reconciliation pending |
| 227:888 | Account | Existing account action sheet; full screen pending |
| 245:8 | Auth | Prior PR218; verify against frame and existing real OTP contract |
| 245:62 | Profile | Pending |
| 245:128 | Addresses | Existing checkout/address handling; dedicated page pending |
| 245:255 | Credits & Plans | Existing wallet screen; reconcile pending |
| 245:344 | Social participation | Pending |
| 245:446 | Support | Existing BuyerSupportScreen; reconcile pending |
| 245:528 | Notifications | Existing support controller; reconcile pending |
| 245:745 | Empty & error states | Pending unified coverage |
| 326:35, 326:200 | Company unregistered/form | Pending; no real legal registration contract invented |
| 326:842, 326:954 | Legal checkout states | Pending; reuse account company data |
| 842:6059, 842:6170, 842:6226, 842:6258, 842:6290, 842:6324 | Catalog alternate/async/filter states | Inventory; reconcile against canonical 227:8 and owner-approved scope; no silent design replacement |

Explicitly exclude seller-only 245:614 and 245:694, desktop frames, alternative mobile web 452:* until scope is confirmed, and draft Buyer005. Existing approved canonical design decisions remain authoritative. This register records implementation evidence and missing work, not blanket approval. Stage is not Production.
