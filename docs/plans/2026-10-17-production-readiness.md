# Production readiness implementation plan

**Goal:** Repair the failed release checks, address verified security risks and deploy only a verified candidate.

**Architecture:** Keep the production address proof, authentication, ownership and idempotency checks intact. Exercise real application writes against isolated databases; fake third-party location responses only in explicitly disposable tests. Audit production read-only before applying any versioned security migration.

**Tech stack:** Next.js 15, React 19, Supabase/PostgreSQL, Mercado Pago, Resend, GitHub Actions, Vercel.

## 1. Repair location regression coverage

- Evidence: main run 38989760769, 15 integration failures and 12 browser failures. New normalized-address contracts are absent from old test inputs. Invitation HTML assertion incorrectly assumes attribute casing.
- Files: `tests/integration/{account-lifecycle,customer-assets,professional-onboarding}.test.ts`, `tests/e2e/customer-hogar.spec.ts`, new `tests/integration/location-fixture.ts`.
- Add disposable-only signed location fixtures and browser selection helpers. Preserve real Auth, API, database and ownership checks. Include missing/forged/mismatched proof rejection.
- Run lint, typecheck, unit tests; push candidate branch and require real CI integration and all browser projects to pass without skips.

## 2. Make incomplete location selection actionable

- Files: `components/customer/hogar/hogar-forms.tsx`, `components/customer/connected-customer-addresses.tsx`, `components/location/{argentine-address-fields,full-address-combobox}.tsx`.
- First add failing tests in `tests/unit/customer-location-entry.vitest.test.tsx` and `tests/unit/location-fields.vitest.test.tsx` for unconfirmed selection and provider failure.
- Require selection before new-address submission; preserve edits to an unchanged saved location. Show retry guidance if address resolution fails; discard obsolete responses.
- Run focused Vitest files, then full CI checks.

## 3. Security and operating readiness

- Inspect actual production advisors, RLS, exposed functions, dependency audit, session/CSRF/upload/payment/webhook boundaries and live response headers.
- Fix verified defects with focused regressions. Keep database changes in CLI-created migrations, test them in disposable CI, apply only reviewed production changes and re-query advisors.
- Verify deployment, worker/outbox health, sender domain, payment configuration and existing recovery evidence without printing credentials or customer data.
- Record residual limits honestly. A live paid transaction/refund or email delivery to a real recipient requires the exact authorized amount/account/recipient; no implicit financial action.

## 4. Release

- Require successful GitHub quality/domain jobs for the candidate. Merge/push main, follow the automatic deployment and verify the served version and public/private smoke checks.
- Record exact commit, CI, deployment and non-mutating production verification. Do not label the system fully certified if real payment/recovery evidence remains missing.
