# Technician Registration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the approved technician registration, all seven saved steps, corrections and real readiness states without changing admission, payment or review policy.

**Architecture:** Replace the existing connected wizard with focused views backed by the existing onboarding/context, versioned save/address, inspected private upload, submission and seller OAuth APIs. Keep application review, account linking and work eligibility separate. Reuse the attached managed worktree and existing approved product components; no fresh prototype/runtime, synthetic production data, Docker, automatic main push or deployment.

**Tech Stack:** Next.js 15, React 19, TypeScript, CSS modules, Lucide, Supabase Auth/Postgres/Storage, existing Mercado Pago OAuth, Vitest.

## Approved targets and constraints

- Access/profile: `exec-060408ec-bbe6-418f-b907-b48af5d09bcf.png`; zones/hours/documents: `exec-769f0a85-3fae-4ef3-b8c8-dfa842802fca.png`; submission/account/final states: `exec-6493c235-29ef-4670-9a6f-acf092a440a1.png`, all in `C:/Users/quime/.codex/generated_images/01a113b5-c26c-7343-bd9a-4e894c9a32af/`.
- Preserve white, blue #075cff, ink #0d1830, muted #5d6c84, ice #f0f5fd, line #e1e7f0, small icons, 48px actions, 12px corners, stable compact header/footer. Seven progress segments and 180–220ms directional content transitions; reduced motion removes displacement.
- Entry is administration invitation + existing provisional password, not public self-signup. Preserve explicit legacy invitation compatibility without presenting old password creation as the modern default. Invalid/unavailable entry must not disclose identity or tokens.
- Steps: personal/address; specialty/experience/license/tools; zones/mobility; weekly availability; public avatar/private documents; actual summary/legal submission; own Mercado Pago account. Account setup is not technician approval.
- New-invite required evidence remains address, license number/entity, avatar, DNI front/back and license attachment. Other documents, expiry, experience and tools follow current policy. Never invent tariffs, universally mandatory nine tools, appointment counts or approval times.
- Editing only draft/corrections; submitted/review is read-only. Final states: review, corrections with precise reason, approved with outstanding requirements, ready, suspended/inactive, unavailable/retry. Password replacement is offered only after server-authorized setup completion, using the existing password API.
- Existing dirty `tsconfig.json` line endings and unrelated original-checkout edits are preserved. Branch `codex/technician-registration`, baseline `d3344c8`, initial focused tests 8/8 passed.

## Task 1 — Pure step validation and state projection

**Create:** `lib/professional/registration-model.ts`, `tests/unit/professional-registration-model.vitest.test.ts`.

1. Write failing tests for each field group, policy-based requirements, document latest-version/expiry, truthful saved-progress resume and all final statuses. Include overlap, duplicate/copied slots, inactive catalog choices and no invented approval.
2. Implement `registrationSteps`, `validateRegistrationStep(step, application, context, today?)`, `initialRegistrationStep(context)`, `requiredRegistrationDocuments(context)` and `registrationState(context, account)` as pure helpers. Return field-keyed Spanish errors. Use seven zero-based indices; context is type-only imported. Export `RegistrationAccount` with configured:boolean, linked:boolean|null, optional mode/accountId.
3. Run `node node_modules/vitest/vitest.mjs run professional-registration-model --maxWorkers=1 --minWorkers=1`. Observe RED then GREEN. No database writes or duplicated server authorization.

## Task 2 — Invitation access and focused shell

**Modify:** `components/pro/invitation-entry.tsx`, onboarding route/layout, team login only for onboarding destinations; own access stylesheet. **Create:** scoped access component/helper/tests if necessary.

1. Write failing tests for modern provisional access, resumable no-token entry, malformed/inactive invitation handling, legacy compatibility and unchanged admin/customer login.
2. Route modern provisioned invites through the existing team login action/acceptance. Do not create a replacement public signup or leak an invited email from an unauthenticated lookup. Keep legacy creation available only as explicit legacy compatibility, with its original security checks.
3. Apply the approved access form, show/hide password and honest help/return actions. White focused layout, no duplicated marketing shell or bottom main navigation. Avoid reading/storing invitation credentials in browser storage or URLs beyond existing signed invitation semantics.
4. Run focused access/routing tests RED/GREEN and self-review; no changes to shared customer login behavior or unrelated professional pages.

## Task 3 — Account connection and safe OAuth return

**Create:** `components/pro/registration-payments.tsx`, its CSS/tests. **Modify:** only OAuth authorize/callback and focused tests as required.

1. Write failing tests for real account loading/unavailable/unlinked/linked states, identity changes, retry, blocked/double authorization, ambiguous results and safe callback/cancel return.
2. Export `useRegistrationAccount(professionalId)` returning account|null, loading, error and `refresh():Promise<RegistrationAccount|null>`; reject malformed response and scope asynchronous responses/unmounts to that identity. Export `RegistrationPayments({state})` using that hook result, real `/api/mercadopago/account` and `/api/mercadopago/oauth/authorize` only. Do not alter split, fees, account ownership, MFA or checkout behavior.
3. Add optional allowlisted `returnTo:'onboarding'` to authorization, cookie-bound to the OAuth binding, never arbitrary redirects. Preserve legacy default dashboard return. Validated cancellation/retry returns to the onboarding connection view; only canonical linked=true can mark connected. Preserve OAuth nonce/session binding and clear return cookies.
4. Run focused OAuth/account tests RED/GREEN. No actual authorization or financial action during verification.

## Task 4 — Connected seven-step registration

**Modify:** `components/pro/connected-professional-onboarding.tsx`, current wizard tests. **Create:** `components/pro/professional-registration.module.css`, small focused document components/tests if needed.

1. Write failing interaction tests for seven steps, per-step versioned saving, failed/partial address save recovery, unchanged full draft at group saves, review edit return, focus/scroll, Guardar y salir, refresh and back/reentry. Do not replace real endpoints with local persistence in product code.
2. Build actual personal, trade/tools, searchable zone/mobility and day/time controls with copy-to-days and overlap feedback. Preserve all values, labels and correct native input semantics. No default saved/approved checkmarks before an acknowledged operation.
3. Render avatar separately from private inspected uploads; use existing uploader scope, verified attachment IDs and authorized read URLs. Preview per document, permit replacement only while editable, show pending/approved/observed/expired distinctly and per-file busy/failed state. Existing contracts assign document expiry during Operations review, not applicant upload; show the review policy and authoritative expiry instead of inventing an applicant expiry endpoint. Never expose private attachments as public avatar.
4. Build true review summary with Edit actions to precise sections, missing-field navigation, explicit current legal acceptance and real submission. Clear stale identity/context on revoked access. Avoid stale closures, duplicate submissions, polling over unsaved fields and success on failed readback.
5. Wire account helper and final states; refresh review on focus/visibility and explicit bounded refresh without overwriting unsaved changes. Existing password form/API only once setup is server-authorized. Do not unlock work from a locally cached state.
6. Implement CSS mobile320/390, tablet/desktop max760, stable actions, keyboard/focus and reduced motion. Run focused UI tests RED/GREEN; no production test records or actual payments.

## Task 5 — Verify and review

1. Related unit/regression tests, domain tests, full lint/typecheck and production build. Use existing isolated E-drive build runtime if C-drive space requires; restore only build-generated next-env/tsconfig references afterward.
2. Adjust actual integration/E2E selectors for seven steps without weakening authorization, zero-skip or persistence assertions. No Docker or production fixtures. Record clearly which backend checks run locally, via production read-only SQL or only in CI.
3. Codex in-app browser only: verify actual connected component via isolated local transport if no disposable authenticated backend exists; disclose that transport. Test navigation, actual upload code with test-only local storage, failed saves, corrections, denied session, missing policy, pending/failed account, 320/390/desktop, keyboard and reduced motion. Never send fake business writes to production.
4. Compare approved reference and matching captured states together; append honest current QA to `design-qa.md`, preserve earlier reports, fix P0/P1/P2 and stop at P3.
5. Independent spec review then code-quality review; fix material findings, rerun affected checks, commit only task files and keep local review open. Report exact verification and limitations. This turn authorizes implementation/testing, not an automatic main push or production deploy.
