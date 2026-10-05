# Customer Password Recovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make customer password recovery accept only passwords between 6 and 12 characters, matching customer registration.

**Architecture:** Reuse the customer password schema as the single source of truth for recovery validation. Keep browser constraints, server validation, messages, and regression tests aligned without changing staff password policies.

**Tech Stack:** Next.js 15, TypeScript, Zod, Supabase Auth, Vitest

---

### Task 1: Add the recovery regression test

**Files:**
- Modify: `tests/unit/account-lifecycle.vitest.test.ts`

**Step 1: Write the failing test**

Replace the recovery password assertions with boundary tests that expect 6 and 12 characters to pass and 5 and 13 characters to fail. Retain the mismatch assertion.

**Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run tests/unit/account-lifecycle.vitest.test.ts --maxWorkers=1 --minWorkers=1`

Expected: FAIL because the current recovery schema requires at least 12 characters and allows more than 12.

### Task 2: Align recovery validation and UI

**Files:**
- Modify: `lib/auth/account-lifecycle.ts`
- Modify: `app/(auth)/restablecer/page.tsx`
- Modify: `app/auth/reset-password/route.ts`

**Step 1: Write the minimal implementation**

Import and reuse `passwordSchema` from `lib/auth/customer-access.ts` inside `account-lifecycle.ts` instead of the separate 12–128 recovery schema.

Set both recovery inputs to `minLength={6}` and `maxLength={12}`, and update the help text to `Usá entre 6 y 12 caracteres.`

Update the server error message to say `entre 6 y 12 caracteres`.

**Step 2: Run the focused test**

Run: `pnpm exec vitest run tests/unit/account-lifecycle.vitest.test.ts --maxWorkers=1 --minWorkers=1`

Expected: PASS.

### Task 3: Verify and deliver

**Files:**
- Verify all modified files.

**Step 1: Run authentication tests**

Run: `pnpm exec vitest run tests/unit/account-lifecycle.vitest.test.ts tests/unit/customer-auth.vitest.test.ts tests/unit/customer-auth-ui.vitest.test.tsx --maxWorkers=1 --minWorkers=1`

Expected: PASS.

**Step 2: Run static verification and production build**

Run: `pnpm typecheck`

Expected: exit 0.

Run: `pnpm build`

Expected: exit 0.

**Step 3: Commit and push**

Stage only the password-recovery files and this plan, commit them, and push `main` so the existing production workflow deploys the fix.
