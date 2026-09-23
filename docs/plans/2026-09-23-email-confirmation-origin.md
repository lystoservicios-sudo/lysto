# Email Confirmation Origin Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow the same-origin email confirmation form to pass CSRF origin validation without weakening cross-origin protections.

**Architecture:** Change the account response referrer policy from `no-referrer` to `same-origin`. Preserve the exact-origin POST check and POST-only token consumption. Cover the response header and the browser submission path with regression tests.

**Tech Stack:** Next.js route handlers, TypeScript, Vitest, Playwright

---

### Task 1: Add the failing regression

**Files:**
- Modify: `tests/unit/account-routes.vitest.test.ts`
- Modify: `tests/e2e/customer-production.spec.ts`

**Step 1:** Change the expected confirmation response policy to `same-origin`.

**Step 2:** Run `pnpm exec vitest run tests/unit/account-routes.vitest.test.ts` and verify it fails because the current header is `no-referrer`.

**Step 3:** Add a browser test that opens a valid-format fake token, submits the form, and verifies the response is the invalid/expired-token message rather than an origin error.

### Task 2: Apply the minimal fix

**Files:**
- Modify: `lib/auth/account-response.ts`

**Step 1:** Set `Referrer-Policy` to `same-origin`.

**Step 2:** Run the focused unit test and verify it passes.

**Step 3:** Run typecheck and the full CI-equivalent suite.

### Task 3: Publish and verify

**Step 1:** Commit only the fix, tests, and these plans.

**Step 2:** Push `main`.

**Step 3:** Wait for GitHub Actions and the production deployment.

**Step 4:** Re-run the harmless browser confirmation probe against production and verify it no longer returns the origin-validation error.
