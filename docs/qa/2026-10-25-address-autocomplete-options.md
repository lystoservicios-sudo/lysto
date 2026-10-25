# Argentine address alternatives — 2026-10-25

## Requested behavior

The owner requested that a user type an address, see multiple alternatives with locality/province context, and choose the correct one. Results must remain in Argentina. A mandatory locality suffix was not the requested interaction.

## Changes

- Full-address discovery retrieves up to 100 candidates from the official Argentine GeoRef endpoint rather than truncating to eight. Results are restricted to Argentine province identifiers. Exact normalized street matches sort ahead of fuzzy matches; CABA and Buenos Aires lead the geographic ordering.
- Each option shows street/number and a separate locality, distinct department, province, and Argentina line. CABA is displayed explicitly. Existing `label` and `secondary` fields preserve compatibility with already-open clients; no new response property is required.
- A locality suffix remains optional. The registration helper no longer requires a comma or prior locality knowledge.
- Aborted earlier requests cannot replace a newer query's results. Options are cleared when the query changes.
- Nationwide discovery does not expand service coverage. Choosing a province outside the current CABA/Buenos Aires coverage gives a specific explanation and does not issue a location proof.
- Resolution reuses the exact official record already revalidated by street/locality IDs. It no longer loses the selected census locality in a second name-only fallback lookup.
- Verified points are remembered under both the structured routing address and, when different, the provider display address persisted by professional profiles. Identical keys are written once.

## Evidence

- The initial regressions failed for the eight-result limit, missing national alternatives, generic coverage error, and stale search replacement. After implementation, 62 focused location/onboarding tests passed. A final presentation-contract simplification passed all 27 affected provider, field, and route tests again.
- Separate regressions reproduced the selected-identity loss and the formatted-address cache miss before their correction.
- After that correction, all 37 tests across provider resolution, verified-point reuse, routing fallbacks, location routes, and signed proofs passed. Expected diagnostics from simulated unresolved provider responses were visible; there were no test failures.
- TypeScript, focused ESLint and `git diff --check` passed on the final implementation.
- Live queries through the actual suggestion implementation returned 80 Pavón 2012 alternatives, including San Cristóbal/CABA, and 100 Calle 23 5871 alternatives, including both Berazategui and Berazategui Oeste without a locality suffix.
- An isolated browser preview used the actual React component and live GeoRef suggestions. The two-line choices and their distinct geographic context were visibly verified. Screenshots: `output/address-options-pavon.png` and `output/address-options-calle23.png`.
- A read-only probe with live GeoRef and a **simulated ORS no-result response** verified that the resolver preserves the official selected ID and point for Pavón 2012 / San Cristóbal and Calle 23 5871 / Berazategui. This is not an authenticated production registration test or a fresh live ORS success claim.

## Limits and data safety

The earlier Berazategui Oeste option still has no GeoRef point. The newly visible census-locality option for Berazategui has a different official identity and a point. No location was substituted on behalf of the applicant; the user must choose the actual address. No coordinate was fabricated, no Google integration was added, and point precision/coverage validation remains in place.

Verification did not save an applicant's address, complete registration, accept consent, alter availability, or create a payment/service. The browser preview only exercised discovery; unit tests verify the chosen IDs reach confirmation. Existing architecture inventory edits were left untouched.

## Production release

Source commits: `50c5c695715ca74370c3145545e94ddc5dfdc073` (discovery and presentation) and `e9d6f6cdde45645072df48a36140a4ce547bbae0` (preserved confirmation and cache aliases).

The production build passed. Deployment `dpl_DksTd3HMTZMqiyGW98AFHZXCFXYG` was verified through metadata as project `prj_nggGpeRYxmcrXDni6Xt98OWwVJg7`, source `e9d6f6cdde45645072df48a36140a4ce547bbae0`, and READY before promotion. After promotion, a fresh domain inspection confirmed `lystohogar.com` points to that deployment; `/api/health/live` returned `status: live`. Temporary preview tabs and the local preview server were closed.
