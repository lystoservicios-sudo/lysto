# Production travel quote repair — 2026-10-20

## Authorized scope

Use the existing OpenRouteService connection in production, without Docker. The owner confirmed the professional origin as Pavón 2012, San Cristóbal, CABA. No payment, checkout, service contract, or appointment was created during this verification.

## Root causes and changes

- Automatic travel still depended on an absent Google server key despite an existing ORS connection. Both quote entry points now select ORS when configured.
- Quote validation in SQL accepted only the former provider. ORS is accepted while preserving verified tolls, scope, ownership, consent and financial checks.
- Coverage compared locality labels literally: San Cristóbal did not match CABA, and the official GeoRef locality Berazategui Oeste did not match Berazategui. Narrow province-qualified equivalences retain all other professional and schedule checks.
- ORS can return city centroids or another street with the same house number. Precise street, number, municipality and province checks reject those results. GeoRef exact-address coordinates are used where available; null coordinates never become locality centroids.
- Address selection previously discarded its verified coordinates, forcing another text lookup during pricing. A private, server-only point store now retains them for reuse (90-day freshness), with separate keys when street, house number, locality or province changes.
- ORS requests independent outbound and return driving routes avoiding tollways and ferries. Zero tolls require complete provider evidence. Road times are not traffic predictions.

## Database

Applied migrations, recorded in hosted migration history:

- `20261020223303_openrouteservice_verified_travel`
- `20261020225159_caba_neighborhood_request_coverage`
- `20261020230410_berazategui_locality_request_coverage`
- `20261020230908_verified_routing_points`

Each migration was tested in a rolled-back transaction before applying. Existing function ACLs were retained. The new table has RLS enabled; authenticated customers cannot read the table or invoke its writer. Only the server role can invoke the new read/write RPCs. A transaction verified round-trip storage and access checks without retaining synthetic points.

Post-change dashboard advisors: Security 0 errors / 33 existing warnings / 40 info; Performance 0 errors / 38 existing warnings / 114 info. The additional info is consistent with the intentionally inaccessible private table having no customer RLS policy.

## Automated verification

- Provider selection, separate route legs, complete toll evidence, rejected ambiguous results and credentials.
- Exact official point fallback, structured lookup, municipality normalization, rejection of missing or conflicting official points.
- Wrong street / wrong locality with an otherwise matching house number and confidence are rejected.
- Verified coordinate reuse, distinct keys, legacy lookup persistence and malformed stored-point rejection.
- Private location route authorization and persistence before issuing a location proof.
- Focused suites passed, TypeScript passed, focused ESLint passed. Production builds are checked independently.

## Live verification and limits

Final application commit: `ac41158`. Production deployment `dpl_7V5XBja5qG7uZb3HjJ12MiUtzNHc` reached READY and was aliased to `https://lystohogar.com`.

The San Cristóbal owner-account request produced a ready quote with source `openrouteservice` on the final deployment. Browser review displayed the price and enabled the Mercado Pago button. Screenshot: ignored `output/ors-production-quote.png`. No payment button was clicked.

Two verified points were persisted. A second live preview succeeded while both the row count and latest verification timestamp remained unchanged (`2026-10-20 23:25:55.333103+00`), demonstrating reuse rather than another text geocode. The new-address selection endpoint independently returned HTTP 200, a valid proof and source `georef` for the official precise Pavón address, after persisting its point.

The successful case has coincident origin/destination. It proves the request/payment-enablement and point-persistence paths, not a nonzero trip to Berazategui. The reported Berazategui request still returns `needs_review / travel_unverified`; do not treat that customer incident as resolved until its actual location and route are confirmed.

Intermediate live attempts encountered provider/runtime failures; final success was established by live results, not inferred from automated tests. Restricted diagnostics retain only error classifications, field paths and stack locations, never credentials or provider response bodies.

An earlier ORS result for the reported numbered street resolved to a different street. This result was explicitly rejected in the follow-up fix. No payment was made from it and it was not written to the new verified-point store. The exact Berazategui location still needs confirmation if the provider cannot identify the house.

Fixtures are clearly labeled in the owner's customer account: `PRUEBA traslado ORS 20-10` and `PRUEBA ORS Berazategui 20-10`, with corresponding test equipment. Existing customer homes/equipment were not rewritten.
