# Henna Buyer Catalog — Source-Specific Collections (Owner Decision)

Status: **navigation/read boundary implemented; authoritative product filtering blocked pending a separate backend read contract**.

## Confirmed product meaning

**Owner terminology clarification:** «طرح‌های ویژه حنا» is the public-facing name for **«تخفیف‌های حنا»** (discounts granted by Henna itself). «تخفیف‌های طلایی» is the public-facing name for **«تخفیف‌های مغازه»** (discounts granted by each seller/store owner on its own offers). These are exactly the two discount origins, not four independent campaigns or collections. Neither origin is inferred from a catalog item's attributes.

The three entries are distinct **product lists**, not separate purchase products and not labels interchangeable with catalog categories:

| Entry | Owner-provided provenance | Qualifying evidence needed |
| --- | --- | --- |
| طرح‌های ویژه حنا | **HENNA** sets a discount for identified goods | A published, active, product/offer-linked Henna-controlled discount record |
| تخفیف‌های طلایی | **SELLER** offers a discount on its own listed goods | A published, active, seller-authorized, offer-linked discount record |
| کالابرگ الکترونیکی | Official eligible goods | An authoritative, current, item-linked eligibility record from a permitted source |

The same product might ultimately be listed in multiple collections, but only if *each* source has independent evidence. No guess is permitted from product name, category name, sample price, marketing copy, a savings label, or a missing-value default.

## Navigation behavior

- `/products?collection=henna`
- `/products?collection=golden`
- `/products?collection=kalabarg`
- `/products` remains the unfiltered catalog.
- Home promotional cards, public header menu and catalog navigation keep these separate.
- The selected collection is visible; users can return to the unfiltered catalog.
- Unknown collection selectors fail closed and cannot cause an unfiltered product list to masquerade as matching.

## Current runtime contract boundary

The published `GET /api/v1/catalog/products` read model exposes product identities, category IDs, names, kind and descriptions; the Next BFF allows only page, pageSize, categoryId and search. The public buyer offer model exposes seller and price, **not** a discount owner/type, campaign lineage, official eligibility or effective validity.

Therefore an active collection currently **must not** send an ordinary unfiltered catalog read and display its results under the selected collection label. It displays an explicit verified-data-unavailable state and never uses the Figma sample cards as matches.

## Required future backend contract (not an implementation claim)

Provide an authoritative, paginated, product/offer-linked, published-only read for these collection semantics; validate provenance, publication, temporal validity, item identity and the source of the effective discount or official eligibility. Keep seller-defined price/offer governance separate from Henna-defined discount governance. Details of promotion eligibility, overlap/stacking, timing, finance, approvals, settlement, grants, and payment interactions remain **undecided** until explicitly contracted.

A listing filter must not calculate an eligibility decision, imply the buyer has a credit balance, silently combine unverified discount sources, modify seller price or activate payment. An approved backend contract and end-to-end tests are required before any collection can show eligible goods or discounted prices.

## Release scope

Frontend-only navigation plus explicit empty/unavailable state and browser regression. No server API, policy schema, payment behavior, production promotion or Stage deployment in this change.
