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
| 227:422 | Basket review | Explicit local exercise based on same cart; no real inventory/offer |
| 227:549 | Checkout | Exercise checkout reads default sample address and company; live BuyerCheckoutScreen unchanged |
| 227:634 | Order success | Explicit sample-only exercise record; no real order/payment |
| 227:706 | Tracking | Exercise tracking shows only sample registration, no fabricated delivery; live BuyerOrdersScreen unchanged |
| 227:797 | Orders | Session-local exercise order list and filters; real order history unchanged |
| 227:888 | Account | Explicit offline account screen, shared navigation, profile/company/address routes; visual acceptance pending |
| 245:8 | Auth | Prior PR218; verify against frame and existing real OTP contract |
| 245:62 | Profile | Session-local sample form, no personal data persistence |
| 245:128 | Addresses | Local sample address CRUD/default; real geography/map and visual acceptance pending |
| 245:255 | Credits & Plans | Preview honest unavailable state; real wallet unchanged, reconciliation pending |
| 245:344 | Social participation | Preview navigation and honest no-data actions; image/real program integration pending |
| 245:446 | Support | Preview FAQ, no fabricated tickets, actual support retained; reconciliation pending |
| 245:528 | Notifications | Dedicated honest preview page; actual notifications reconciliation pending |
| 245:745 | Empty & error states | Pending unified coverage |
| 326:35, 326:200 | Company unregistered/form | Local sample company form saved once in same account state; real legal registration and checkout reuse pending |
| 326:842, 326:954 | Legal checkout states | Exercise legal flag, reuse sample company; block submit until registered; no real invoice |
| 842:6059, 842:6170, 842:6226, 842:6258, 842:6290, 842:6324 | Catalog alternate/async/filter states | 2026-11-12 candidate: filter drawer, preview-only price/features, real published categories, loading/error/empty/no-results states; visual acceptance pending. |

Explicitly exclude seller-only 245:614 and 245:694, desktop frames, alternative mobile web 452:* until scope is confirmed, and draft Buyer005. Existing approved canonical design decisions remain authoritative. This register records implementation evidence and missing work, not blanket approval. Stage is not Production.

Exercise boundary: a deliberate 'تمرین ادامه خرید با فروشگاه نمونه' action from the comparison unavailable state enters the local mock workflow based on the same cart. It never represents a quote, real seller identity, stock, delivery estimate, order, payment or invoice. No exercise data is sent to APIs or persisted. The order-success/tracking frames are reachable only after explicitly submitting a sample exercise. Real seller comparison and visual QA remain separate acceptance gates.

## Mobile Buyer Catalog — first uncovered screen package (2026-11-12)

Figma: `842:6324` / `842:6377` filter drawer, `842:6170` loading, `842:6226` empty catalog, `842:6258` error, `842:6290` search no-results. An Expo/React Native RTL modal matches the basic sheet geometry and actions. Live catalog filtering **only** uses validated published category IDs through the existing `BuyerBrowseController`; price, availability, discount and voucher controls are disabled on the live path, pending real contracts. In explicit isolated web preview, price/tags filter only the five existing local sample goods using existing `previewPrices` with bounded integer input, no API writes. Availability is deliberately disabled in preview too: no stock assertion. Catalog empty/error/loading states are visibly distinct and keep retry/clear paths. Existing cart and auth are untouched. Unit and Chromium journey tests were added.

No iOS-native work, no seller screens, no Stage or Production deployment. Visual QA and additional missing secondary pages still remain; this is not blanket Figma parity or production filter completeness.
