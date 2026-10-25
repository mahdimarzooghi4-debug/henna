# Logistics 011 — Admin view for Mono delivery status

## Scope

The Henna Admin integrations page can look up a delivery by Henna order UUID through a same-origin BFF. The BFF forwards only the server-held session bearer to the Admin-only API status route, rejects extra/invalid query values, bounds the response body, validates the DTO, and returns a no-store allowlist.

The UI shows correlation and provider states, optional Quote totals/expiry, and committed delivery time. It does not create a Mono request, approve a Quote, confirm a Promise, or create a Mission. It never renders address or contact fields.

## Verification

- Parser tests cover known state, correlation IDs, quote-share consistency, and Promise time shape.
- The isolated HTTPS gateway test checks authentication, no cookie forwarding, invalid order UUID rejection, and omission of unapproved provider fields.
- Web build and full CI remain the verification gate. No live Mono credentials or operational records are used.