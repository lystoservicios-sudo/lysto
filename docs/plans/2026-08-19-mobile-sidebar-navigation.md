# Mobile Sidebar Navigation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the overflowing authenticated mobile navigation with an accessible, role-aware slide-in sidebar while preserving desktop navigation.

**Architecture:** Move role navigation metadata into a serializable shared config. Render desktop navigation and the mobile trigger/sidebar from one client component so both surfaces share active-route behavior. Keep `AppShell` as the server layout boundary and pass only the role string.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, Lucide React, Vitest, Testing Library, Playwright.

---

### Task 1: Define the navigation interaction contract

**Files:**
- Create: `tests/unit/app-navigation.vitest.test.tsx`

**Step 1: Write the failing test**

Test that the Admin mobile trigger opens a labelled dialog containing every route, marks the current route with `aria-current="page"`, closes from its explicit close button, and closes on `Escape`.

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/unit/app-navigation.vitest.test.tsx --maxWorkers=1 --minWorkers=1`

Expected: FAIL because `AppNavigation` does not exist.

**Step 3: Commit the failing contract**

Run: `git add tests/unit/app-navigation.vitest.test.tsx && git commit -m "test: define mobile sidebar navigation"`

### Task 2: Implement the shared responsive navigation

**Files:**
- Create: `components/layout/app-navigation-config.ts`
- Create: `components/layout/app-navigation.tsx`
- Modify: `components/layout/page-shell.tsx`

**Step 1: Add the minimal implementation**

Create the shared role configuration and client navigation. Implement active-route matching, the desktop list, mobile trigger, fixed backdrop, left sidebar, focus restoration, scroll lock, backdrop close, explicit close, link close and `Escape` close.

**Step 2: Run the focused test**

Run: `pnpm exec vitest run tests/unit/app-navigation.vitest.test.tsx --maxWorkers=1 --minWorkers=1`

Expected: PASS.

**Step 3: Run focused static checks**

Run: `pnpm exec eslint components/layout/app-navigation.tsx components/layout/app-navigation-config.ts components/layout/page-shell.tsx tests/unit/app-navigation.vitest.test.tsx --max-warnings=0`

Run: `pnpm typecheck`

Expected: both PASS.

**Step 4: Commit the implementation**

Run: `git add components/layout/app-navigation.tsx components/layout/app-navigation-config.ts components/layout/page-shell.tsx && git commit -m "feat: add mobile sidebar navigation"`

### Task 3: Verify the complete mobile experience and publish

**Files:**
- Modify only if a verified defect is found in the previous task.

**Step 1: Run the complete project gates**

Run: `pnpm test:ci`

Expected: lint, typecheck, 124 domain tests, all unit tests and the production build PASS.

**Step 2: Inspect the interface locally at mobile size**

Use Playwright at 390 × 844 px. Confirm no horizontal overflow, all targets are at least 44 px high, the active route is visible and the sidebar opens/closes correctly.

**Step 3: Deploy to the existing Vercel production project**

Run: `vercel deploy --prod -y`

Expected: the `lysto-demo.vercel.app` alias points to the new ready deployment.

**Step 4: Verify the deployed Admin flow**

Sign in as the Admin demo account, open the sidebar on a mobile viewport, navigate to another Admin section and confirm the current item updates.

**Step 5: Commit any verification-only documentation if needed**

Keep credentials, screenshots and Vercel metadata out of git.
