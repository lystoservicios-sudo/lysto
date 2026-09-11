# Service pricing implementation plan

**Goal:** Calculate traceable service proposals with a 30% surcharge, geographical coverage and separately approved onsite extras paid entirely to the professional.

**Architecture:** One deterministic TypeScript calculator, a versioned reference catalog and server-only Google route lookup feed persisted immutable quotes. Customer acceptance consumes a server quote rather than amounts from the browser. Onsite extras are separate records with customer decisions and zero commission; they never rewrite the original quote or imply payment.

**Tech Stack:** Next.js, TypeScript, Zod, Supabase/PostgreSQL, Vitest, Google Geocoding/Routes REST.

## Authorized decisions
- User approved implementation in this session; implement here, preserving existing uncommitted UI work.
- Multiply the calculator subtotal by **1.30**, once. Keep the existing 18% initial marketplace commission and explicitly check the professional allocation covers the calculator subtotal. Expose platform payment-cost budget and remaining contribution; this is not a guarantee against unknown costs.
- Use the attached CAIM June–July 2026 table as dated reference, not verified live market pricing. Preserve missing upper bounds and missing material prices. Additional fault amounts have no surcharge or commission.
- CABA/Province of Buenos Aires, at most 180 minutes outbound from a configurable CABA reference origin. Price both directions. Missing routing credentials or unverified estimates require review rather than a zero travel cost.
- User-facing symptom choices are mutually exclusive (7); test each with four durations, two service priorities, four property types, access combinations and equipment sizes at exactly the same location. Also test every supported diagnosis scenario. Explicitly label fixed routing data as a simulation.

## Tasks
1. Write failing calculator tests: reference prices, 30%, cent-safe money, coverage, unknowns, invalid numbers, material quantities, payouts, all symptom combinations. Implement catalog, calculator and deterministic report generator.
2. Write failing route-provider tests: geocoding region validation, distance/time, both directions, stale/missing data and provider failures. Implement server configuration, authenticated preview and Google integration.
3. Add migration and database tests for immutable quote storage, atomic quote acceptance, ownership, expiry and duplicate submissions. Replace the unsafe legacy submission path with quote acceptance; preserve old historical rows.
4. Add migration/API/UI for extras: assigned professional records new fault, description and amount; customer accepts/rejects; amount remains 100% professional, no payment created. Verify authorization, concurrency and immutable events.
5. Connect customer wizard and internal calculator, keeping existing visual conventions. Show scope, review requirements, totals and offer allocation. Persist only server-calculated quotes.
6. Run domain/unit checks, typecheck, lint and build; execute local SQL verification when runtime available. Generate readable Markdown/CSV simulation outputs with constant location and documented assumptions. Review changes and report exact remaining configuration needs.

## Verification
Use `npx vitest run tests/unit/service-pricing.vitest.test.ts` for red/green development, then `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`. Database tests must exercise real PostgreSQL policies/transactions, not merely inspect SQL strings. No production database mutation is necessary to develop and review these changes.
