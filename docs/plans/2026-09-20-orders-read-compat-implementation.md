# Orders Checkout List Compatibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Serve the checkout list both before and after the Orders schema migration without creating new Preferences checkouts.

**Architecture:** Keep the Orders-aware list query as the primary path. Retry with the pre-Orders list query only for PostgreSQL `undefined_column` (`42703`) or `undefined_table` (`42P01`); propagate every other failure. Use the same authorization and parameter array on both paths.

**Tech Stack:** Next.js route handlers, TypeScript, PostgreSQL `pg`, Vitest, pnpm.

---

### Task 1: Reproduce the compatibility failure

**Files:**
- Create: `tests/unit/marketplace-checkout-list.vitest.test.ts`
- Inspect: `app/api/mercadopago/checkouts/route.ts`

**Step 1:** Mock `paymentActor` and `paymentDatabase().query` around the real GET route. Make the first query throw `{code:'42703'}` and the second return a historical checkout; assert HTTP 200 and two parameterized queries.

**Step 2:** Run `corepack pnpm exec vitest run tests/unit/marketplace-checkout-list.vitest.test.ts`. Expected: the new test fails because GET does not retry.

### Task 2: Implement the minimal fallback

**Files:**
- Modify: `app/api/mercadopago/checkouts/route.ts`
- Test: `tests/unit/marketplace-checkout-list.vitest.test.ts`

**Step 1:** Keep the existing Orders query. Add a historical SQL constant containing only pre-migration columns and `public.marketplace_payment_observations`.

**Step 2:** On only `42703` or `42P01`, retry the historical SQL with the same bound parameters. Do not change checkout creation or payment switches.

**Step 3:** Run the targeted Vitest file. Expected: historical checkout test passes.

**Step 4:** Add tests for the migrated schema (one query) and unrelated database errors (no retry); run the targeted file again. Expected: all pass.

**Step 5:** Run `corepack pnpm test:ci`. Expected: lint, types, domain tests, unit tests and production build pass.

**Step 6:** Inspect the diff and commit the code and tests.

### Task 3: Integrate and deploy safely

**Files:**
- Merge: `codex/mercadopago-orders` and `codex/production-closeout` into `main`
- Preserve: all other worktrees and unrelated changes

**Step 1:** Review the Orders change against its design, migration and release notes. Resolve blocking issues before merge.

**Step 2:** Confirm remote `main` has not advanced; merge both branches into local `main` without rewriting history.

**Step 3:** Run `corepack pnpm test:ci` on merged `main` and inspect the deployment package for ignored credentials.

**Step 4:** Push `main` normally and deploy production with checkout creation, new requests and Orders activation off. Do not run the Orders migration or add production Mercado Pago credentials.

**Step 5:** Inspect the deployment record and report the exact SHA, URL and remaining acceptance gates. Do not claim live payments are ready.
