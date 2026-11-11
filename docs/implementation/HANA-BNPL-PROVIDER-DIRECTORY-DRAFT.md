# BNPL provider directory — Draft implementation and payment admission boundary

**Status: DRAFT / directory only. No merchant approval, funding promise or checkout activation.**

## User-facing flow delivered

- Buyer Account → Payment Methods displays three independently operated, public company websites: SnappPay (https://snapppay.ir/), DigiPay (https://www.mydigipay.com/), and Tara (https://taracredit.com/).
- External links open the providers' public sites in a new tab. No personal account, basket, ID, phone or token is transferred. Provider identity verification, assessment, charges, installment terms and credit approval are outside Hana.
- Current /checkout and /buyer/checkout explicitly show that no BNPL provider is connected to Hana's merchant checkout; nothing is selectable and no payment attempt, authorization, order, accounting entry or fake balance is created by the directory.
- COD does not appear as a choice in the preview checkout, in accordance with ADR-009.
- The catalog is a static discovery directory, **not a payment-method registry** and not proof of a contractual relationship. Do not enable payment by toggling a frontend boolean.

## Unresolved prerequisites for actual merchant checkout

These are **required contracts/gates**, not assumed decisions or implemented providers:

1. Explicit approved provider(s), merchant acceptance/contract, actual merchant credentials and permitted product/category/amount constraints. Legal/compliance review and user-facing terms.
2. Backend-owned provider adapter and versioned payment-method registry, with appropriate server-side credentials and provider authorization: buyer chooses; provider independently determines eligibility. Browser must not hold secrets.
3. Authoritative finalized single-seller order, price/stock/delivery quote and exact amount/currency validation bound to immutable PaymentAttempt; idempotency, concurrency and replay protection.
4. Secure provider-hosted redirect and verified server-side callback/webhook/result inquiry. A redirect or browser success message is **never** proof of payment; only verified/settled outcome can advance paid/fulfillment state. Unknown stays pending and reconciled.
5. Source-preserving partial/composite payment policy, cancellation, refund, reversal, provider settlement, reconciliation and accounting evidence, tied to ADR-009, ADR-013/014/020/022. None should be invented.
6. Sandbox integration tests for success, decline, timeout, duplicate callback, invalid signature, stale amount, cancel, refund, reconciliation and outage; independent human QA, Stage evidence and explicit release approval.

**No external BNPL provider is currently checkout-enabled.** Provider activation requires a later human-approved backend contract and controlled deployment, not this directory.

## Current limitations

A buyer may apply for credit on a provider's site today; it does NOT imply that credit can be spent at Hana. The page must not claim a merchant relationship, a fixed credit limit, zero interest, or an approved account balance.
