# Client App Shell Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the authenticated customer sidebar shell with an accessible mobile-first app shell, add the five-position bottom navigation, support focused flows without bottom navigation, and create the `/app/hogar` placeholder without changing existing page content or business logic.

**Architecture:** Keep the existing shared `AppShell` unchanged for Admin and Professional. Mount a new customer-only `ClientAppShell` from `app/(customer)/app/layout.tsx`; it reads the current pathname, renders a compact top bar, gives the central `main` its own scroll region, and conditionally renders the bottom navigation through a small tested route policy. Add `/app/hogar` to the customer route contract, but do not move or remove any current customer routes.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, Lucide React, Vitest, Testing Library, Playwright.

---

## Constraints and reference

- Follow the approved design in `docs/plans/2026-10-07-client-app-shell-design.md`.
- Preserve every existing customer page body and API interaction.
- Do not change the Admin or Professional shell.
- Do not delete `components/layout/app-sidebar.tsx`, `components/layout/app-topbar.tsx`, or `components/layout/app-shell-provider.tsx`; the other roles still use them.
- Do not invent notifications, notification counts, profile photos, homes, addresses, or account options.
- Treat Cuenta as a conceptual destination even though its initial route is `/app/perfil`.
- Keep unrelated working-tree changes untouched.

## Intended interface checkpoint

Before implementing components, use this design checkpoint:

- **Intent:** A homeowner needs to request service or understand what happens next, often from a phone and possibly while something is broken. The shell should feel calm, immediate, and trustworthy.
- **Palette:** White home-like surfaces, Lysto blue for identity and the main action, navy for primary text, blue-gray for inactive navigation, semantic colors only for real status.
- **Depth:** Borders and quiet surface shifts. Use a restrained shadow only for the elevated Pedir action and fixed-bar separation.
- **Surfaces:** Canvas `--lysto-canvas`, bars `--lysto-panel`, inset controls from the existing control system.
- **Typography:** Existing Inter stack; compact, high-legibility navigation labels with no marketing display treatment.
- **Spacing:** 4 px base grid, 44–48 px minimum interactive targets.

### Task 1: Define and test customer navigation policy

**Files:**

- Create: `components/app-shell/client-navigation.ts`
- Create: `tests/unit/client-app-shell.vitest.test.tsx`

**Step 1: Write the failing policy tests**

Create `tests/unit/client-app-shell.vitest.test.tsx` with initial tests for the pure navigation policy:

```tsx
import { describe, expect, it } from 'vitest'

import {
  clientNavigationItems,
  isClientNavigationItemActive,
  shouldShowClientBottomNavigation
} from '@/components/app-shell/client-navigation'

describe('client app shell navigation policy', () => {
  it('defines the five approved customer destinations in order', () => {
    expect(clientNavigationItems.map(({ label, href }) => ({ label, href }))).toEqual([
      { label: 'Inicio', href: '/app' },
      { label: 'Hogar', href: '/app/hogar' },
      { label: 'Pedir', href: '/app/solicitar/aire-acondicionado' },
      { label: 'Equipos', href: '/app/equipos' },
      { label: 'Cuenta', href: '/app/perfil' }
    ])
  })

  it('keeps nested equipment pages inside Equipos without marking Inicio active', () => {
    expect(isClientNavigationItemActive('/app/equipos/abc', '/app/equipos')).toBe(true)
    expect(isClientNavigationItemActive('/app/equipos/abc', '/app')).toBe(false)
  })

  it('hides bottom navigation in the focused request flow', () => {
    expect(shouldShowClientBottomNavigation('/app')).toBe(true)
    expect(shouldShowClientBottomNavigation('/app/equipos')).toBe(true)
    expect(shouldShowClientBottomNavigation('/app/solicitar/aire-acondicionado')).toBe(false)
  })
})
```

**Step 2: Run the test and verify it fails**

Run:

```powershell
pnpm exec vitest run tests/unit/client-app-shell.vitest.test.tsx
```

Expected: FAIL because `components/app-shell/client-navigation.ts` does not exist.

**Step 3: Implement the minimal navigation policy**

Create `components/app-shell/client-navigation.ts`:

```ts
export const clientNavigationItems = [
  { id: 'home', label: 'Inicio', href: '/app', icon: 'grid' },
  { id: 'household', label: 'Hogar', href: '/app/hogar', icon: 'home' },
  { id: 'request', label: 'Pedir', href: '/app/solicitar/aire-acondicionado', icon: 'plus', primary: true },
  { id: 'equipment', label: 'Equipos', href: '/app/equipos', icon: 'equipment' },
  { id: 'account', label: 'Cuenta', href: '/app/perfil', icon: 'account' }
] as const

const focusedFlowPrefixes = ['/app/solicitar/'] as const

export function isClientNavigationItemActive(pathname: string, href: string) {
  return pathname === href || (href !== '/app' && pathname.startsWith(`${href}/`))
}

export function shouldShowClientBottomNavigation(pathname: string) {
  return !focusedFlowPrefixes.some((prefix) => pathname.startsWith(prefix))
}
```

Keep payment and confirmation routes visible for now. The policy makes future hiding an explicit one-line route decision when those page redesigns are approved.

**Step 4: Run the test and verify it passes**

Run the same Vitest command.

Expected: 3 tests PASS.

**Step 5: Commit**

```powershell
git add components/app-shell/client-navigation.ts tests/unit/client-app-shell.vitest.test.tsx
git commit -m "test: define client shell navigation policy"
```

### Task 2: Build the bottom navigation with accessible active states

**Files:**

- Create: `components/app-shell/client-nav-item.tsx`
- Create: `components/app-shell/client-bottom-navigation.tsx`
- Modify: `tests/unit/client-app-shell.vitest.test.tsx`

**Step 1: Add failing component tests**

Mock `usePathname` through a hoisted variable and add tests that render `ClientBottomNavigation`:

```tsx
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { ClientBottomNavigation } from '@/components/app-shell/client-bottom-navigation'

const navigation = vi.hoisted(() => ({ pathname: '/app/equipos' }))

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname
}))

afterEach(() => cleanup())

it('renders five destinations and marks Equipos active', () => {
  render(<ClientBottomNavigation />)
  const nav = screen.getByRole('navigation', { name: 'Navegación principal del cliente' })
  expect(within(nav).getAllByRole('link')).toHaveLength(5)
  expect(within(nav).getByRole('link', { name: 'Equipos' }).getAttribute('aria-current')).toBe('page')
  expect(within(nav).getByRole('link', { name: 'Inicio' }).hasAttribute('aria-current')).toBe(false)
})

it('keeps Pedir visually and semantically distinct', () => {
  render(<ClientBottomNavigation />)
  const request = screen.getByRole('link', { name: 'Pedir un servicio' })
  expect(request.getAttribute('href')).toBe('/app/solicitar/aire-acondicionado')
  expect(request.getAttribute('data-primary')).toBe('true')
})
```

**Step 2: Run the test and verify it fails**

Expected: FAIL because the bottom-navigation components do not exist.

**Step 3: Implement `ClientNavItem`**

The component must:

- accept label, href, icon, active state, and primary state;
- use a minimum 48 px touch target;
- set `aria-current="page"` only when active;
- give Pedir the accessible name “Pedir un servicio”;
- render inactive icon/label in blue-gray and active icon/label in Lysto blue;
- keep focus-visible styling independent from hover;
- use only Lucide icons.

Use `LayoutGrid`, `House`, `CircleUserRound`, `AirVent`, and `Plus` from `lucide-react`.

**Step 4: Implement `ClientBottomNavigation`**

The component must:

- call `usePathname()`;
- map `clientNavigationItems` to `ClientNavItem`;
- render a semantic `<nav aria-label="Navegación principal del cliente">`;
- use a five-column grid;
- stay fixed to the viewport bottom;
- include bottom safe-area padding;
- constrain its inner width on desktop;
- elevate Pedir above the top boundary without increasing decorative motion.

Do not add click state, notification state, analytics, or route rewriting.

**Step 5: Run the focused tests**

Run:

```powershell
pnpm exec vitest run tests/unit/client-app-shell.vitest.test.tsx
```

Expected: all policy and bottom-navigation tests PASS.

**Step 6: Commit**

```powershell
git add components/app-shell/client-nav-item.tsx components/app-shell/client-bottom-navigation.tsx tests/unit/client-app-shell.vitest.test.tsx
git commit -m "feat: add client bottom navigation"
```

### Task 3: Build the compact top bar and customer shell

**Files:**

- Create: `components/app-shell/client-top-bar.tsx`
- Create: `components/app-shell/client-app-shell.tsx`
- Modify: `tests/unit/client-app-shell.vitest.test.tsx`
- Modify: `app/globals.css`

**Step 1: Add failing shell tests**

Add tests for the top bar and shell:

```tsx
import { ClientAppShell } from '@/components/app-shell/client-app-shell'

it('renders a compact customer shell without dashboard chrome', () => {
  navigation.pathname = '/app/equipos'
  render(
    <ClientAppShell identity={{ name: 'Marina Gómez', email: 'marina@example.com' }}>
      <p>Contenido actual</p>
    </ClientAppShell>
  )

  expect(screen.getByRole('link', { name: 'Lysto, inicio' }).getAttribute('href')).toBe('/app')
  expect(screen.getByRole('button', { name: 'Notificaciones próximamente' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Abrir Cuenta' }).getAttribute('href')).toBe('/app/perfil')
  expect(screen.getByRole('main').textContent).toContain('Contenido actual')
  expect(screen.queryByText('Espacio cliente')).toBeNull()
  expect(screen.queryByRole('button', { name: /navegación/i })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).toBeNull()
})

it('omits bottom navigation on focused routes', () => {
  navigation.pathname = '/app/solicitar/aire-acondicionado'
  render(<ClientAppShell><p>Solicitud</p></ClientAppShell>)
  expect(screen.queryByRole('navigation', { name: 'Navegación principal del cliente' })).toBeNull()
})
```

**Step 2: Run the test and verify it fails**

Expected: FAIL because `ClientAppShell` and `ClientTopBar` do not exist.

**Step 3: Implement `ClientTopBar`**

Implement a compact header with:

- an internal Lysto wordmark link to `/app`, using the existing L-shaped brand geometry rather than importing marketing CSS;
- a disabled notification button named “Notificaciones próximamente”, with a `data-badge-slot` element ready for a future count but no fake badge;
- a profile link named “Abrir Cuenta” to `/app/perfil`;
- initials derived from `identity.name` as the avatar fallback;
- no user name, role label, page title, logout, breadcrumb, or slogan.

If there is no identity, use a neutral `CircleUserRound` fallback. Do not modify `AccountIdentity` or query new profile fields.

**Step 4: Implement `ClientAppShell`**

Implement the shell as a client component:

```tsx
'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import type { AccountIdentity } from '@/lib/auth/account-identity'
import { shouldShowClientBottomNavigation } from './client-navigation'
import { ClientTopBar } from './client-top-bar'
import { ClientBottomNavigation } from './client-bottom-navigation'

export function ClientAppShell({ children, identity }: { children: ReactNode; identity?: AccountIdentity }) {
  const pathname = usePathname()
  const showBottomNavigation = shouldShowClientBottomNavigation(pathname)

  return (
    <div data-client-app-shell className="client-app-shell">
      <a className="lysto-skip-link ..." href="#main-content">Saltar al contenido</a>
      <ClientTopBar identity={identity} />
      <main id="main-content" tabIndex={-1} className="client-app-content">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
      {showBottomNavigation ? <ClientBottomNavigation /> : null}
    </div>
  )
}
```

Use dedicated CSS classes for the structural sizing so tests and future pages do not need to repeat long utility strings.

**Step 5: Add structural CSS**

In `app/globals.css`, add only shell infrastructure:

```css
.client-app-shell {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-height: 100dvh;
  height: 100dvh;
  overflow: hidden;
  background: var(--lysto-canvas);
  color: var(--lysto-ink);
}

.client-app-content {
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  padding: 1.25rem 1rem 2rem;
}

@media (min-width: 768px) {
  .client-app-content { padding: 2rem 1.5rem 2.5rem; }
}
```

The top and bottom components own their safe-area padding. Do not place arbitrary fixed bottom padding on page bodies.

**Step 6: Run the tests**

Expected: all `client-app-shell` tests PASS.

**Step 7: Commit**

```powershell
git add components/app-shell/client-top-bar.tsx components/app-shell/client-app-shell.tsx tests/unit/client-app-shell.vitest.test.tsx app/globals.css
git commit -m "feat: add mobile-first client app shell"
```

### Task 4: Integrate the customer layout without affecting other roles

**Files:**

- Modify: `app/(customer)/app/layout.tsx`
- Modify: `tests/unit/app-shell-integration.vitest.test.tsx`
- Modify: `tests/unit/customer-page-boundaries.vitest.test.ts`

**Step 1: Add failing integration assertions**

Update `tests/unit/app-shell-integration.vitest.test.tsx` to preserve its Admin assertions and add a separate customer-shell test by importing `ClientAppShell`. Assert that the customer shell has no complementary/sidebar landmark and that Admin still renders the shared sidebar and topbar.

Update `tests/unit/customer-page-boundaries.vitest.test.ts`:

- replace the old expectation that customer navigation is mounted through the sidebar shell;
- assert that `app/(customer)/app/layout.tsx` imports and renders `ClientAppShell`;
- assert it does not render `<AppShell role="Cliente"`;
- retain the rule that individual pages do not mount global navigation.

**Step 2: Run the two tests and verify the new assertions fail**

Run:

```powershell
pnpm exec vitest run tests/unit/app-shell-integration.vitest.test.tsx tests/unit/customer-page-boundaries.vitest.test.ts
```

Expected: FAIL because the customer layout still uses the shared sidebar shell.

**Step 3: Switch only the customer layout**

In `app/(customer)/app/layout.tsx`:

- replace the `AppShell` import with `ClientAppShell`;
- keep all session, redirect, and identity code unchanged;
- render:

```tsx
return (
  <ClientAppShell identity={await readAccountIdentity(session)}>
    {children}
  </ClientAppShell>
)
```

Do not change `components/layout/page-shell.tsx`; Admin and Professional continue to depend on it.

**Step 4: Run the focused tests**

Expected: customer boundary and shared-shell integration tests PASS.

**Step 5: Run existing navigation regression tests**

Run:

```powershell
pnpm exec vitest run tests/unit/app-navigation.vitest.test.tsx tests/unit/app-shell-state.vitest.test.tsx
```

Expected: all existing Admin/shared shell tests PASS unchanged.

**Step 6: Commit**

```powershell
git add 'app/(customer)/app/layout.tsx' tests/unit/app-shell-integration.vitest.test.tsx tests/unit/customer-page-boundaries.vitest.test.ts
git commit -m "feat: mount client shell for customer routes"
```

### Task 5: Add the minimal Hogar route and update the customer contract

**Files:**

- Create: `app/(customer)/app/hogar/page.tsx`
- Modify: `features/customer/screen-contract.ts`
- Modify: `tests/unit/customer-page-boundaries.vitest.test.ts`

**Step 1: Add failing route-contract tests**

Change the expected customer route count from 14 to 15 and assert:

```ts
expect(customerScreenRoutes).toContainEqual(expect.objectContaining({
  href: '/app/hogar',
  file: 'app/(customer)/app/hogar/page.tsx',
  title: 'Mi hogar'
}))
```

Add a source-boundary assertion that the Hogar page contains no demo fixtures, forms, API calls, navigation, or invented home records.

**Step 2: Run the boundary test and verify it fails**

Expected: FAIL because the route and file do not exist.

**Step 3: Create the placeholder page**

Create `app/(customer)/app/hogar/page.tsx` using the existing `PageScaffold`:

```tsx
import { PageScaffold } from '@/components/layout/page-scaffold'

export default function CustomerHomePage() {
  return (
    <PageScaffold
      eyebrow="Cliente"
      title="Mi hogar"
      description="Acá vas a poder organizar los lugares y direcciones asociados a tus servicios."
    >
      <p className="text-sm text-slate-600">
        Esta sección estará disponible próximamente.
      </p>
    </PageScaffold>
  )
}
```

This is intentionally minimal. Do not add mock homes, calls to action, address duplication, or settings.

**Step 4: Register the route**

Add `CUS-15` to `features/customer/screen-contract.ts` without renumbering existing screens:

```ts
{ id: 'CUS-15', href: '/app/hogar', file: 'app/(customer)/app/hogar/page.tsx', title: 'Mi hogar' }
```

**Step 5: Run the boundary and shell tests**

Run:

```powershell
pnpm exec vitest run tests/unit/customer-page-boundaries.vitest.test.ts tests/unit/client-app-shell.vitest.test.tsx
```

Expected: all tests PASS.

**Step 6: Commit**

```powershell
git add 'app/(customer)/app/hogar/page.tsx' features/customer/screen-contract.ts tests/unit/customer-page-boundaries.vitest.test.ts
git commit -m "feat: add customer household placeholder"
```

### Task 6: Verify behavior, accessibility, and visual structure

**Files:**

- Modify only if a verified defect requires it: `components/app-shell/*.tsx`, `app/globals.css`, related tests.
- Create if visual QA evidence is part of the repository convention: `docs/plans/2026-10-07-client-app-shell-qa.md`

**Step 1: Run the focused unit suite**

```powershell
pnpm exec vitest run tests/unit/client-app-shell.vitest.test.tsx tests/unit/app-shell-integration.vitest.test.tsx tests/unit/customer-page-boundaries.vitest.test.ts tests/unit/app-navigation.vitest.test.tsx tests/unit/app-shell-state.vitest.test.tsx tests/unit/customer-ui-foundations.vitest.test.tsx
```

Expected: PASS.

**Step 2: Run type checking**

```powershell
pnpm typecheck
```

Expected: PASS. If it fails in an unrelated dirty-worktree file, record the exact pre-existing error and still verify every changed file with the focused tests.

**Step 3: Run lint on changed implementation files**

```powershell
pnpm exec eslint components/app-shell 'app/(customer)/app/layout.tsx' 'app/(customer)/app/hogar/page.tsx' features/customer/screen-contract.ts tests/unit/client-app-shell.vitest.test.tsx tests/unit/app-shell-integration.vitest.test.tsx tests/unit/customer-page-boundaries.vitest.test.ts --max-warnings=0
```

Expected: PASS.

**Step 4: Run the application and inspect responsive viewports**

Use the existing authenticated local fixture/session workflow. Inspect at least:

- `/app` at 360 × 800;
- `/app` at 390 × 844;
- `/app` at 430 × 932;
- `/app/equipos` at 390 × 844;
- `/app/hogar` at 390 × 844;
- `/app/solicitar/aire-acondicionado` at 390 × 844;
- `/app` at 1440 × 1000.

Verify:

- no sidebar or hamburger in customer routes;
- top bar content and dimensions remain compact;
- bottom navigation is fixed and not covered by the safe area;
- Pedir rises above the bar and remains the sole strong visual accent;
- page content scrolls without moving the two bars;
- content is not obscured;
- the request flow hides bottom navigation;
- active state follows the route, including nested equipment routes;
- desktop remains app-like and centered;
- no horizontal overflow at 360 px;
- keyboard focus is visible for all five destinations, bell, avatar, and skip link;
- Admin and Professional still use their existing shells.

**Step 5: Run the broader unit suite**

```powershell
pnpm test:unit
```

Expected: PASS, except any independently verified pre-existing failure must be reported precisely and must not be hidden.

**Step 6: Review scope before final commit**

Run:

```powershell
git diff --check
git status --short
git diff -- components/app-shell app/globals.css 'app/(customer)/app/layout.tsx' 'app/(customer)/app/hogar/page.tsx' features/customer/screen-contract.ts tests/unit/client-app-shell.vitest.test.tsx tests/unit/app-shell-integration.vitest.test.tsx tests/unit/customer-page-boundaries.vitest.test.ts
```

Confirm that no customer page body, API, database, payment logic, or unrelated worktree file changed.

**Step 7: Commit verification fixes or QA evidence**

If verification required scoped corrections:

```powershell
git add <only-the-scoped-files>
git commit -m "fix: polish client app shell behavior"
```

If no corrections were needed, do not create an empty commit.

## Definition of done

- Customer routes use `ClientAppShell`.
- Admin and Professional retain their existing shell.
- Top bar contains only Lysto, notification affordance, and Cuenta/avatar access.
- Bottom navigation contains Inicio, Hogar, Pedir, Equipos, and Cuenta in that order.
- Pedir is visually distinct and routes to the current air-conditioning request flow.
- `/app/hogar` exists as a minimal placeholder.
- Focused request routes hide bottom navigation through a tested policy.
- Current routes, content, session checks, and business logic remain intact.
- Focused tests, lint, type checks, and responsive inspection are complete and reported with evidence.
