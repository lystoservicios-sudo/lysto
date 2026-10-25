# Argentina address autocomplete implementation plan

**Goal:** Let applicants type a street and number and choose among clearly identified Argentine addresses without needing to know a special locality syntax.

**Architecture:** Keep the official Argentine GeoRef source and existing signed address confirmation. Retrieve a larger bounded candidate set for unscoped address searches, rank exact street matches ahead of fuzzy matches, and identify each option by street/number plus locality, department, province, and country. Keep structured address lookup behavior and service coverage checks independent from national address discovery.

**User direction:** The owner explicitly requested multiple options, geographic context including CABA, and Argentina-only results. This plan implements that requested interaction directly.

**Tech stack:** Next.js, TypeScript, Zod, Downshift, Vitest.

## Design decisions

- Use the existing Argentine provider rather than introducing a new external service. Eight raw matches omit relevant cities; retrieve up to 100 for full-address discovery and preserve relevant options in the scrollable menu.
- Rank normalized exact street matches first, with the current service area (CABA/Buenos Aires) ahead of other Argentine provinces. Keep provider identities for selection. Do not choose a locality on the user's behalf.
- Show street and house number prominently, with the locality, distinct department, province, and Argentina below. Use CABA as the short province label.
- Continue accepting an optional comma-separated locality to refine results; remove instructions that make this syntax mandatory.
- Keep selection confirmation, stale-request guards, and precise-location checks. Show an explicit coverage message if an applicant selects a province outside the current service area.

## Implementation and verification

1. Add failing provider regression tests with a CABA result beyond the first eight, an exact Pavón result behind a fuzzy Pavoni result, and results from multiple Argentine provinces. Assert readable disambiguating labels and preserved IDs.
2. Add a UI test choosing between identical street/number entries in distinct cities, verifying the selected city reaches the resolver and stale query results cannot replace new results.
3. Expand only full-address discovery, add option presentation metadata, and update the onboarding helper and missing-selection error text.
4. Run focused provider, route, field, proof, and onboarding tests; run TypeScript, ESLint and production build. Probe the actual suggestion implementation against live GeoRef for Pavón 2012 and Calle 23 5871 without a locality suffix.
5. Verify the actual UI with a local isolated preview using the same component and live suggestion results, without writing any account/address records. Publish the verified application change and confirm the production domain's deployment identity and health.

Known separate limit: GeoRef recognition does not guarantee a precise routing coordinate. This change must not manufacture coordinates or claim registration completion where resolution remains unavailable.
