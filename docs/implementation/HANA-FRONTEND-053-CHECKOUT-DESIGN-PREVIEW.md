# Frontend 053 — Buyer checkout design preview

Implements the Figma `WEB / 06 Checkout` screen (`227:1733`) at `/checkout` and exposes it from the saved buyer purchase selection.

## Scope and behavior

- Reads the current account-scoped purchase selection through the existing same-origin BFF and validates its DTO before displaying selected lines.
- Presents the RTL checkout structure, address map, legal-invoice toggle, delivery information and order summary.
- Address values remain in page state only; this screen does not persist an address or submit a checkout.
- Item prices are described as previously seen values. There is no final total, delivery tariff, inventory confirmation, order or payment attempt.
- The final order action stays disabled until an order API and payment integration exist.
- Cash on delivery is not shown, per ADR-009. No unsupported financial-credit option is offered.
- The screen reports loading, signed-out, unavailable, absent-selection and stale-selection states without creating sample records.
- Groups the seller-registration progress marker into the three phases shown in Figma `160:77`, while retaining the existing eight backend steps underneath.

## Deliberate boundary

The current product has no buyer address persistence, order/quote API, delivery price contract or payment gateway. The address form is therefore a design preview and cannot create a purchase. A saved purchase selection remains a draft and must not be represented as an order.

## Verification

- `npm run web:typecheck`
- `npm run web:build`
- Build output includes `/checkout`.
