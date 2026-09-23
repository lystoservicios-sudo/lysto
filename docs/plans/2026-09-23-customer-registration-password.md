# Customer Registration Password Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Accept 6–12 character customer-registration passwords and add accessible show/hide controls to both registration password fields.

**Architecture:** Separate registration password validation from recovery validation, then align browser constraints, server schemas, copy, and Supabase's minimum. Extend the shared authentication input with an opt-in visibility control so no other password flow changes implicitly.

**Tech Stack:** Next.js 15, React 19, TypeScript, Zod, Supabase Auth, Lucide React, Vitest, Testing Library

---

### Task 1: Lock the registration password boundaries with tests

**Files:**
- Modify: `tests/unit/account-lifecycle.vitest.test.ts`
- Modify: `tests/unit/customer-auth.vitest.test.ts`

**Step 1: Write the failing tests**

Add table-driven assertions proving that registration accepts passwords of exactly 6 and 12 characters and rejects passwords of 5 and 13 characters. Add a recovery assertion showing its existing longer policy is unchanged.

**Step 2: Run the focused tests to verify they fail**

Run: `pnpm vitest run tests/unit/account-lifecycle.vitest.test.ts tests/unit/customer-auth.vitest.test.ts`

Expected: FAIL because 6-character registration passwords are rejected and 13-character passwords are accepted.

**Step 3: Implement the minimal validation change**

In `lib/auth/account-lifecycle.ts`, introduce separate registration and recovery schemas, use `z.string().min(6).max(12)` for registration, and update the registration error copy. In `lib/auth/customer-access.ts`, change the registration schema and messages to the same limits.

**Step 4: Run the focused tests**

Run: `pnpm vitest run tests/unit/account-lifecycle.vitest.test.ts tests/unit/customer-auth.vitest.test.ts`

Expected: PASS.

**Step 5: Commit**

Commit the tests and validation changes with `fix: align customer registration password limits`.

### Task 2: Add accessible password visibility controls

**Files:**
- Modify: `tests/unit/customer-auth-ui.vitest.test.tsx`
- Modify: `components/auth/auth-fields.tsx`
- Modify: `components/auth/auth.css`
- Modify: `app/(auth)/registro/registration-form.tsx`

**Step 1: Write the failing UI test**

Assert both registration password inputs expose `minLength=6` and `maxLength=12`, the help text says `Usá entre 6 y 12 caracteres.`, and each input has an independent `Mostrar/Ocultar` button that toggles its type.

**Step 2: Run the focused UI test to verify it fails**

Run: `pnpm vitest run tests/unit/customer-auth-ui.vitest.test.tsx`

Expected: FAIL because the old limits remain and reveal buttons do not exist.

**Step 3: Implement the minimal UI change**

Add an opt-in `revealable` property to `AuthInput`, local visibility state, Lucide `Eye`/`EyeOff` icons, accessible button labels and pressed state, and wrapper/button CSS. Enable it for both registration password fields and update their limits and help copy.

**Step 4: Run the focused UI test**

Run: `pnpm vitest run tests/unit/customer-auth-ui.vitest.test.tsx`

Expected: PASS.

**Step 5: Commit**

Commit the UI test and implementation with `feat: add registration password visibility controls`.

### Task 3: Align Supabase and verify the complete change

**Files:**
- Modify: `supabase/config.toml`

**Step 1: Write the failing configuration assertion**

Add a unit assertion that reads `supabase/config.toml` and requires `minimum_password_length = 6`.

**Step 2: Run the assertion to verify it fails**

Run the test file containing the configuration assertion.

Expected: FAIL because the configured minimum is 12.

**Step 3: Update the provider configuration**

Set `minimum_password_length = 6` in `supabase/config.toml`.

**Step 4: Run verification**

Run the focused authentication tests, `pnpm typecheck`, and `pnpm lint`.

Expected: all commands PASS with no warnings.

**Step 5: Commit and deliver**

Commit with `chore: align Supabase registration password minimum`, confirm only intended changes are present, and push `main` to `origin` so the configured automatic deployment starts.
