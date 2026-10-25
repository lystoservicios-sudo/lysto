# Professional address suggestions — 2026-10-25

## Report and verified cause

The professional registration form displayed a generic invalid-input alert and could not load address options for `Calle 23 5871` or `Pavon 2012`. Inspection of the affected registration confirmed that personal data had been saved and the base address remained unset. Runtime logs in the reported time window contained successful personal-data saves and repeated HTTP 400 responses from address suggestions and address saves.

Live GeoRef responses were HTTP 200. Some valid results included `localidad: { id: null, nombre: null }` and a populated `localidad_censal`. The strict response parser rejected the entire list, including other usable entries. The resulting Zod error was misclassified as invalid user input. Without a selected address, the address save had no signed location proof and also returned a generic HTTP 400.

The provider recognizes `CALLE 23 5871, Berazategui Oeste, Berazategui, Buenos Aires` when the search passes Berazategui as the locality parameter. Merely appending the city inside the provider's street query does not scope its results.

## Change

- Normalize missing fine localities to the official census locality for streets and addresses. Preserve valid fine locality identities and never invent coordinates.
- Classify malformed upstream responses as provider failures, not user validation errors.
- Split an unscoped `street and number, locality` query into GeoRef's address and locality parameters.
- Explain that the applicant must choose an address from the list; give an explicit response when the address save has no location proof.

## Verification

- Observed failing regression tests before the implementation, covering the actual nullable provider fields, locality scoping, and upstream error classification.
- 58 tests passed across location providers, routes, fields, proofs, professional address selection, and the professional onboarding wizard.
- TypeScript, focused ESLint, and `git diff --check` passed.
- The production build passed. Source commit `0bc113182414eaa84a338857b0e485f23151e92d` was verified in Vercel deployment metadata for project `prj_nggGpeRYxmcrXDni6Xt98OWwVJg7`. Deployment `dpl_4iCz4cqkLe3CWT98qbxhDjkHWV4d` was promoted; a fresh inspection confirmed `lystohogar.com` points to it in READY state.
- The public `/api/health/live` endpoint returned `status: live` after promotion. A fresh GeoRef query recognized Calle 23 5871 in Berazategui Oeste but returned null latitude and longitude.
- A probe of the actual corrected suggestion implementation against live GeoRef returned options for both original queries and the exact Berazategui address for the scoped query.
- No applicant data, account state, permissions, or onboarding consent was changed by verification.

## Scope of evidence

Recognizing an official address is separate from obtaining precise coordinates for routing. A successful suggestions response alone does not prove that the address can be fully confirmed or that an applicant has completed registration. The browser session available for verification was not authenticated for the private customer pages.

The earlier same-day quote investigation recorded missing precise coordinates for Calle 23 5871 with the configured routing provider and GeoRef. That routing limitation is not solved by this parsing repair. A fresh local full-resolution probe could not run because Vercel did not return the configured provider's secret value; the provider setting exists in production, and its absence from the probe must not be reported as missing production configuration. No credential was written to disk or exposed.

The locality of Pavón 2012 in the latest screenshot is not specified. It was requested from the owner to verify the intended address rather than selecting a similarly named street elsewhere in Buenos Aires. Registration completion remains unverified.
