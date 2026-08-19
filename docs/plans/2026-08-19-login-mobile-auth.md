# Functional Mobile Login Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make every public entry point open a compact mobile-first login that authenticates against Supabase and redirects by trusted role.

**Architecture:** Keep authentication decisions in a tested `lib/auth/login.ts` service with a small gateway interface. A Next.js server action adapts Supabase Auth/profile queries to that service, while a client form owns pending and error presentation. Public CTAs consistently enter through `/login` and registration remains the explicit secondary path.

**Tech Stack:** Next.js 15 App Router, React 19 server actions, Supabase SSR/Auth, Zod, Vitest, Testing Library, Tailwind CSS, Playwright.

---

### Task 1: Authentication contract

**Files:**
- Create: `tests/unit/login-flow.vitest.test.ts`
- Create: `lib/auth/login.ts`

1. Write failing tests for empty credentials, invalid credentials, missing profiles, unapproved professionals and role redirects.
2. Run `pnpm vitest run tests/unit/login-flow.vitest.test.ts --maxWorkers=1 --minWorkers=1` and confirm the missing module failure.
3. Implement Zod validation and a dependency-injected authentication service that signs out incomplete/unauthorized sessions.
4. Re-run the test and confirm all cases pass.
5. Commit `test: define login flow contract`.

### Task 2: Supabase server action and form

**Files:**
- Create: `app/(auth)/login/actions.ts`
- Create: `app/(auth)/login/login-form.tsx`
- Modify: `app/(auth)/login/page.tsx`
- Modify: `components/ui/input.tsx`
- Test: `tests/unit/login-form.vitest.test.tsx`

1. Write a failing component test that requires named fields, autocomplete, an actionable submit, registration link and accessible error/pending states.
2. Run the focused test and confirm the missing component failure.
3. Implement the server action using `createServerSupabaseClient()`, `signInWithPassword`, trusted profile lookup and redirect.
4. Implement the client form with `useActionState`, preserved email, disabled pending state and an `aria-live` error region.
5. Replace the desktop-first two-card page with one focused mobile card and a desktop-only role explanation that cannot inherit a conflicting white background.
6. Re-run both focused unit suites.
7. Commit `feat: connect Supabase login`.

### Task 3: Public entry routing

**Files:**
- Modify: `components/layout/marketing-header.tsx`
- Modify: `app/(public)/page.tsx`
- Modify: `app/(public)/servicios/aire-acondicionado/page.tsx`
- Test: `tests/unit/public-auth-links.vitest.test.ts`

1. Write a failing source-contract test requiring the mobile header and public service CTAs to target `/login`, while `Crear cuenta cliente` targets `/registro`.
2. Run the focused test and confirm it fails on the current `/registro` CTAs.
3. Change public entry links to `/login` and keep registration secondary.
4. Re-run the focused unit tests.
5. Commit `fix: route public entry through login`.

### Task 4: Configuration and browser verification

**Files:**
- Modify only if required: Vercel environment settings (external, never committed)
- Modify: `tests/e2e/auth-flow.spec.ts`

1. Configure the remote Supabase URL and publishable key in Vercel without exposing secret keys.
2. Build the application with `pnpm build`.
3. Run lint, typecheck, domain and unit tests.
4. Start the app and verify at phone and desktop widths: CTA routing, valid admin/customer/technician login, invalid-password feedback, no empty card and correct role redirect.
5. Deploy to Vercel and return the updated URL.
