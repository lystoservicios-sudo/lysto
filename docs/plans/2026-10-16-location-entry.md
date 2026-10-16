# Location Entry Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert every customer and technician location entry into a provider-backed, selectable and server-verified address without changing existing form copy.

**Architecture:** A server-only location module queries GeoRef and Google, validates provider responses, and issues short-lived signed proofs containing canonical address components. Reusable Downshift comboboxes preserve each existing form's labels and styling; mutation boundaries accept canonical values only after verifying the proof, while unchanged legacy addresses remain editable.

**Tech Stack:** Next.js 15 route handlers, React 19, Downshift, Zod, GeoRef Argentina v2, Google Geocoding API, Vitest, Testing Library, Playwright.

---

### Task 1: Provider contracts and canonical resolution

**Files:**
- Create: `lib/location/contracts.ts`
- Create: `lib/location/georef.ts`
- Create: `lib/location/google-geocoding.ts`
- Create: `lib/location/resolve.ts`
- Test: `tests/unit/location-providers.vitest.test.ts`

**Steps:**
1. Write failing tests for province, locality, street and address suggestions, null GeoRef coordinates, ambiguous results, Google coverage and canonical CABA/Buenos Aires naming.
2. Run `pnpm vitest run tests/unit/location-providers.vitest.test.ts` and confirm the missing-module failure.
3. Implement strict provider schemas, bounded requests, timeouts and deterministic candidate mapping.
4. Run the focused test and confirm it passes.

### Task 2: Signed location proof

**Files:**
- Create: `lib/location/proof.ts`
- Test: `tests/unit/location-proof.vitest.test.ts`

**Steps:**
1. Write failing tests for valid proofs, expiration, tampering, address mismatch and timing-safe verification.
2. Run the focused test and confirm failure.
3. Implement versioned HMAC proofs using server-only secret material and normalized address comparison.
4. Run the focused test and confirm it passes.

### Task 3: Private suggestion and resolution APIs

**Files:**
- Create: `app/api/location/suggestions/route.ts`
- Create: `app/api/location/resolve/route.ts`
- Modify: `lib/security/rate-limit.ts`
- Test: `tests/unit/location-routes.vitest.test.ts`

**Steps:**
1. Write failing route tests for authentication, onboarding access, bounded inputs, rate limiting, provider errors and private cache headers.
2. Run the focused test and confirm failure.
3. Implement authenticated routes for customers and professionals, including pending onboarding accounts.
4. Run the focused test and confirm it passes.

### Task 4: Accessible reusable controls

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `components/location/location-combobox.tsx`
- Create: `components/location/argentine-address-fields.tsx`
- Create: `components/location/full-address-combobox.tsx`
- Create: `components/location/location-fields.module.css`
- Test: `tests/unit/location-fields.vitest.test.tsx`

**Steps:**
1. Add Downshift through pnpm.
2. Write failing interaction tests for typing, keyboard and touch selection, dependent resets, stale-request cancellation, final confirmation and unchanged labels.
3. Run the focused test and confirm failure.
4. Implement the headless comboboxes using the existing input styles and reduced-motion preference.
5. Run the focused test and confirm it passes.

### Task 5: Customer entry points

**Files:**
- Modify: `components/auth/customer-forms.tsx`
- Modify: `components/customer/connected-customer-addresses.tsx`
- Modify: `components/customer/hogar/hogar-forms.tsx`
- Modify: `features/service-request/request-location-step.tsx`
- Modify: `lib/customer-assets/contracts.ts`
- Test: `tests/unit/customer-location-entry.vitest.test.tsx`

**Steps:**
1. Write failing tests proving that current labels remain unchanged and new/changed locations cannot submit before selecting a canonical option.
2. Run the focused test and confirm failure.
3. Replace only the four geographic inputs with the shared fields and carry the proof through each existing mutation.
4. Run the focused test and confirm it passes.

### Task 6: Technician onboarding entry point

**Files:**
- Modify: `components/pro/connected-professional-onboarding.tsx`
- Modify: `lib/professional/onboarding-service.ts`
- Modify: `app/api/professional/onboarding/address/route.ts`
- Test: `tests/unit/professional-location-entry.vitest.test.tsx`

**Steps:**
1. Write failing tests proving `Dirección` remains the label, selection is required after editing, and the proof reaches the address mutation.
2. Run the focused test and confirm failure.
3. Integrate the full-address combobox and server proof verification without changing the seven-step flow.
4. Run the focused test and confirm it passes.

### Task 7: Server mutation enforcement

**Files:**
- Modify: `app/(auth)/completar-perfil/actions.ts`
- Modify: `app/api/customer/addresses/route.ts`
- Modify: `app/api/customer/homes/route.ts`
- Modify: `lib/customer-assets/service.ts`
- Modify: `lib/customer-homes/service.ts`
- Test: `tests/unit/location-mutation-boundaries.vitest.test.ts`

**Steps:**
1. Write failing tests for missing, expired or mismatched proofs and for non-geographic edits to unchanged legacy addresses.
2. Run the focused test and confirm failure.
3. Verify proofs at each mutation boundary, strip proof data before existing strict database RPCs, and preserve existing version/idempotency behavior.
4. Run the focused test and confirm it passes.

### Task 8: Regression and release verification

**Files:**
- Modify: `.env.example`
- Modify: `docs/plans/2026-10-16-location-entry-design.md` only if implementation evidence changes the design.

**Steps:**
1. Run the new focused tests and the existing address, Hogar, Pedir, auth and professional onboarding suites.
2. Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`.
3. Run browser journeys for customer profile completion, customer address creation, Hogar inline creation, Pedir inline editing and technician onboarding.
4. Confirm no existing visible form labels changed and no provider key appears in browser bundles or tracked files.
5. Review `git diff --check`, inspect the final diff, and prepare the branch for integration.

