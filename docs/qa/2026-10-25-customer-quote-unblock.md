# Customer quote blockage — 2026-10-25

## Changes in production

The active customer-request policy rejected customer-entered equipment characteristics in all seven scopes, even when the request form collected complete capacity and technology. Migration `20261025192905_customer_equipment_declarations` versions the active policy and permits these explicit declarations. The existing rate policy, scopes, approval expiry and unknown-equipment checks are preserved. It does not rewrite historical quotes or customer equipment.

The form now explains missing capacity/technology before review, keeps those fields open when needed, and provides a direct correction action on review. Unavailable appointments provide an action to choose another time.

Deployment `dpl_7NdAGEr1hGsWPsbiDF6gbiH9UCEp` is READY. A fresh Vercel alias query confirmed that `lystohogar.com` points to this deployment. Routing remains OpenRouteService; no Google integration was added.

## Verification

- The migration passed assertions in a rolled-back production transaction before application. The hosted active policy is version 2, enabled, with declarations permitted in all seven scopes; its migration history is recorded.
- Security and performance advisors returned no errors. Existing warnings remain; no table, function ACL, RLS policy or credential was changed.
- Focused service, request-screen, equipment-recovery, flow and mocked payment-journey tests passed. TypeScript and focused ESLint passed; the production build succeeded.
- The payment-journey test was updated to verify the existing signed return URL rather than its obsolete route expectation. No payment implementation changed.
- After deployment, the authenticated owner-account fixture in San Cristóbal with explicitly declared 3,000-frigoria conventional equipment produced a ready ARS 273,000 quote for Wednesday 28 October, 10–12, and enabled the Mercado Pago button. This fixture shares the professional's origin, so it does not validate a nonzero journey.
- No payment button was clicked, and no payment, service contract or appointment was created.

## Remaining incident limits

This is a partial repair, not proof that both reported customer requests can be paid unchanged.

The sole currently eligible professional has Monday, Wednesday and Thursday availability, 09–17. Tuesday 27 October, requested in both screenshots, is unavailable. No professional's availability was modified.

For the reported numbered-street address with house number 5871, the deployed geocoding path still returns `travel_unverified`: ORS does not return an exact matching house and GeoRef returns null coordinates. GeoRef's registered segment for that street ends below 5871. This is evidence of incomplete/mismatched provider coverage, not proof that the customer's address is wrong. An exact location remains unresolved; no substitute street, centroid or invented point was accepted.

For the other reported address, house number 555, a direct official GeoRef lookup returns a precise address point. That verifies the location lookup only; a full customer quote with a nonzero trip has not been verified.
