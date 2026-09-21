# Customer Auth Activation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make public customer email registration/sign-in functional independently of service-request intake, while keeping professional access invitation-only. Google was postponed by the owner on 2026-09-21.

**Architecture:** Keep Supabase Auth and the existing server-side customer role and legal-acceptance boundaries. Decouple account registration from the new-service switch, remove the Google option from public UI, and keep its legacy action closed. Legal-policy activation remains an explicit configuration step.

**Tech Stack:** Next.js 15 server actions, Supabase Auth/Postgres, Vitest, Playwright, Vercel.

---

### Task 1: Decouple customer signup from service intake

**Files:** `app/(auth)/registro/actions.ts`, `tests/unit/customer-auth-actions.vitest.test.ts`, `lib/release/runtime-switches.ts`.

1. Add a test asserting that a valid legal policy permits email signup when `LYSTO_ACCEPT_NEW_REQUESTS=false` and payments are disabled.
2. Run the targeted Vitest file; confirm the new test fails because the request switch blocks signup.
3. Remove the request-intake guard from registration only. Keep the policy and origin/rate-limit checks.
4. Re-run the targeted test and check existing switch tests.

### Task 2: Postpone Google without offering a broken option

**Files:** `app/(auth)/login/page.tsx`, `app/(auth)/registro/page.tsx`, `components/auth/auth-fields.tsx`, `app/(auth)/actions.ts`, and matching unit tests.

1. Add tests that neither public page offers Google even if the provider is enabled; email remains available.
2. Run tests to observe the failure.
3. Remove Google UI from public pages. Make the legacy server action fail closed so a stale client cannot start OAuth.
4. Re-run tests and typecheck.

### Task 3: Validate role boundaries

**Files:** existing customer Auth unit tests and professional onboarding tests; change application code only if a failing behavior is found.

1. Add or strengthen tests for customer-only login and invitation-only professional role promotion.
2. Run targeted tests; fix only proven failures with a red-green cycle.
3. Confirm public signup never submits an `app_role` from user metadata.

### Task 4: Remote email configuration and end-to-end verification

**Files:** `docs/release/environment-register.md` or a focused runbook, plus deployment configuration only when actual credentials and approved policy exist.

1. Read the production Supabase Auth email settings and verify redirect allow-list expectations without printing secrets.
2. Validate an approved production legal policy is available; do not create or approve legal documents by assumption.
3. Confirm sender-domain, SMTP, and confirmation-link delivery before accepting real customers.
4. Run lint, typecheck, unit tests, build, and browser checks against the intended deployment. Test real registration only with an explicitly authorized disposable account and legal acceptance.
5. Deploy only a verified commit. Do not claim live email signup until the actual confirmation and login flow passes.
