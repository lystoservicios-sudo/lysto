# Client Navigation Restructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Change the customer bottom navigation to Inicio, Servicios, Pedir, Hogar, and Más; group existing routes under the correct active tab; and add a minimal `/app/mas` placeholder without redesigning existing screens.

**Architecture:** Keep the current Client App Shell and bottom-navigation structure. Extend each navigation item with explicit semantic route families so active state is independent from the item's main `href`, update only the icons needed by the new labels, and register a new placeholder route for Más. Existing customer pages, routes, APIs, and business logic remain unchanged.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, Lucide React, Vitest, Testing Library.

---

## Reference and constraints

- Follow `docs/plans/2026-10-12-client-navigation-restructure-design.md`.
- Use @test-driven-development while implementing.
- Use @verification-before-completion before reporting completion.
- Preserve all unrelated working-tree changes.
- Do not redesign or move Inicio, Trabajos, Solicitudes, Presupuestos, Hogar, Equipos, Perfil, Pagos, Garantías, Direcciones, or Mantenimientos.
- Do not modify APIs, authentication, database code, payments, or customer data models.
- Do not change the top bar or the central Pedir treatment.
- Do not remove any current route.

### Task 1: Define semantic navigation groups

**Files:**

- Modify: `tests/unit/client-app-shell.vitest.test.tsx`
- Modify: `components/app-shell/client-navigation.ts`

**Step 1: Replace the old navigation-order assertion with the approved destinations**

In `tests/unit/client-app-shell.vitest.test.tsx`, update the first policy test:

```tsx
it('defines the five approved customer destinations in order', () => {
  expect(clientNavigationItems.map(({ label, href }) => ({ label, href }))).toEqual([
    { label: 'Inicio', href: '/app' },
    { label: 'Servicios', href: '/app/trabajos' },
    { label: 'Pedir', href: '/app/solicitar/aire-acondicionado' },
    { label: 'Hogar', href: '/app/hogar' },
    { label: 'Más', href: '/app/mas' }
  ])
})
```

**Step 2: Add failing active-family tests**

Replace the old equipment-only policy test with:

```tsx
it.each([
  ['/app', 'home'],
  ['/app/trabajos', 'services'],
  ['/app/trabajos/job-1', 'services'],
  ['/app/solicitudes', 'services'],
  ['/app/solicitudes/request-1', 'services'],
  ['/app/presupuestos', 'services'],
  ['/app/hogar', 'household'],
  ['/app/equipos', 'household'],
  ['/app/equipos/equipment-1', 'household'],
  ['/app/mas', 'more'],
  ['/app/perfil', 'more'],
  ['/app/pagos', 'more'],
  ['/app/pagos/mercadopago', 'more'],
  ['/app/garantias', 'more'],
  ['/app/direcciones', 'more'],
  ['/app/mantenimientos', 'more']
])('maps %s to the %s navigation group', (pathname, expectedId) => {
  const activeItems = clientNavigationItems.filter((item) =>
    isClientNavigationItemActive(pathname, item)
  )

  expect(activeItems.map((item) => item.id)).toEqual([expectedId])
})

it('does not keep Inicio active on nested app routes', () => {
  const home = clientNavigationItems.find((item) => item.id === 'home')!
  expect(isClientNavigationItemActive('/app/trabajos', home)).toBe(false)
})
```

Keep the focused-flow visibility tests unchanged.

**Step 3: Run the focused test and verify it fails**

Run:

```powershell
pnpm exec vitest run tests/unit/client-app-shell.vitest.test.tsx
```

Expected: FAIL because the current items still use Hogar, Equipos, and Cuenta, and the active function accepts only an `href`.

**Step 4: Implement navigation items with explicit active paths**

Replace `clientNavigationItems` in `components/app-shell/client-navigation.ts` with:

```ts
export const clientNavigationItems = [
  {
    id: 'home',
    label: 'Inicio',
    href: '/app',
    icon: 'grid',
    activePaths: ['/app'],
    exact: true
  },
  {
    id: 'services',
    label: 'Servicios',
    href: '/app/trabajos',
    icon: 'services',
    activePaths: ['/app/trabajos', '/app/solicitudes', '/app/presupuestos']
  },
  {
    id: 'request',
    label: 'Pedir',
    href: '/app/solicitar/aire-acondicionado',
    icon: 'plus',
    activePaths: ['/app/solicitar'],
    primary: true
  },
  {
    id: 'household',
    label: 'Hogar',
    href: '/app/hogar',
    icon: 'home',
    activePaths: ['/app/hogar', '/app/equipos']
  },
  {
    id: 'more',
    label: 'Más',
    href: '/app/mas',
    icon: 'more',
    activePaths: [
      '/app/mas',
      '/app/perfil',
      '/app/pagos',
      '/app/garantias',
      '/app/direcciones',
      '/app/mantenimientos'
    ]
  }
] as const
```

Use a type derived from the array and replace `isClientNavigationItemActive` with:

```ts
export type ClientNavigationItem = (typeof clientNavigationItems)[number]

export function isClientNavigationItemActive(
  pathname: string,
  item: ClientNavigationItem
) {
  if ('exact' in item && item.exact) return pathname === item.href

  return item.activePaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}
```

Do not add aliases, redirects, or new URLs for Servicios or Hogar.

**Step 5: Run the focused test and verify the policy tests pass**

Run the same Vitest command.

Expected: policy tests PASS; rendering tests may still fail until icons and component calls are updated in Task 2.

**Step 6: Commit the policy change**

```powershell
git add components/app-shell/client-navigation.ts tests/unit/client-app-shell.vitest.test.tsx
git commit -m "feat: group client routes by navigation section"
```

### Task 2: Update bottom-navigation labels, icons, and rendering

**Files:**

- Modify: `components/app-shell/client-nav-item.tsx`
- Modify: `components/app-shell/client-bottom-navigation.tsx`
- Modify: `tests/unit/client-app-shell.vitest.test.tsx`

**Step 1: Add failing rendering tests for the new labels and active states**

Replace the old Equipos rendering test with:

```tsx
it('renders the approved five destinations and marks Servicios active', () => {
  navigation.pathname = '/app/solicitudes/request-1'
  render(<ClientBottomNavigation />)
  const nav = screen.getByRole('navigation', { name: 'Navegación principal del cliente' })

  expect(within(nav).getAllByRole('link')).toHaveLength(5)
  expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual([
    'Inicio',
    'Servicios',
    'Pedir',
    'Hogar',
    'Más'
  ])
  expect(within(nav).getByRole('link', { name: 'Servicios' }).getAttribute('aria-current')).toBe('page')
  expect(within(nav).getByRole('link', { name: 'Inicio' }).hasAttribute('aria-current')).toBe(false)
})

it('marks Hogar active on equipment routes and Más active on secondary routes', () => {
  navigation.pathname = '/app/equipos/equipment-1'
  const { rerender } = render(<ClientBottomNavigation />)
  expect(screen.getByRole('link', { name: 'Hogar' }).getAttribute('aria-current')).toBe('page')

  navigation.pathname = '/app/pagos/mercadopago'
  rerender(<ClientBottomNavigation />)
  expect(screen.getByRole('link', { name: 'Más' }).getAttribute('aria-current')).toBe('page')
})
```

Keep the existing Pedir test unchanged.

**Step 2: Run the test and verify it fails**

Expected: FAIL because the icon union and bottom navigation still use the old function contract.

**Step 3: Update the icon set**

In `components/app-shell/client-nav-item.tsx`:

- import `House`, `LayoutGrid`, `MoreHorizontal`, `Plus`, and `Wrench` from `lucide-react`;
- remove `AirVent` and `CircleUserRound` from this component;
- define:

```tsx
type ClientNavigationIcon = 'grid' | 'services' | 'plus' | 'home' | 'more'

const icons = {
  grid: LayoutGrid,
  services: Wrench,
  plus: Plus,
  home: House,
  more: MoreHorizontal
} as const
```

Do not change sizing, focus treatment, touch targets, or the special Pedir presentation.

**Step 4: Pass the full item to the active-state helper**

In `components/app-shell/client-bottom-navigation.tsx`, change:

```tsx
active={isClientNavigationItemActive(pathname, item.href)}
```

to:

```tsx
active={isClientNavigationItemActive(pathname, item)}
```

Do not change the fixed positioning, safe-area padding, five-column grid, or maximum width.

**Step 5: Run the focused test**

```powershell
pnpm exec vitest run tests/unit/client-app-shell.vitest.test.tsx
```

Expected: all client shell and navigation tests PASS.

**Step 6: Commit**

```powershell
git add components/app-shell/client-nav-item.tsx components/app-shell/client-bottom-navigation.tsx tests/unit/client-app-shell.vitest.test.tsx
git commit -m "feat: update client bottom navigation destinations"
```

### Task 3: Add the minimal Más route

**Files:**

- Create: `app/(customer)/app/mas/page.tsx`
- Modify: `features/customer/screen-contract.ts`
- Modify: `tests/unit/customer-page-boundaries.vitest.test.ts`

**Step 1: Add the failing route-contract assertion**

In `tests/unit/customer-page-boundaries.vitest.test.ts`:

- change the expected route count from 15 to 16;
- add:

```tsx
expect(customerScreenRoutes).toContainEqual(expect.objectContaining({
  id: 'CUS-16',
  href: '/app/mas',
  file: 'app/(customer)/app/mas/page.tsx',
  title: 'Más opciones'
}))
```

Add a source assertion that the page contains `PageScaffold` and does not contain API calls, demo fixtures, forms, or its own navigation.

**Step 2: Run the boundary test and verify it fails**

Run:

```powershell
pnpm exec vitest run tests/unit/customer-page-boundaries.vitest.test.ts
```

Expected: FAIL because `/app/mas` is not registered and the page does not exist.

**Step 3: Create the placeholder page**

Create `app/(customer)/app/mas/page.tsx`:

```tsx
import { PageScaffold } from '@/components/layout/page-scaffold'

export default function CustomerMorePage() {
  return (
    <PageScaffold
      eyebrow="Cliente"
      title="Más"
      description="Acá vas a encontrar los accesos secundarios y la configuración de tu cuenta."
    >
      <p className="text-sm text-slate-600">
        Esta sección estará disponible próximamente.
      </p>
    </PageScaffold>
  )
}
```

Do not add links, cards, logout, settings, fake counts, or unavailable actions yet.

**Step 4: Register the route without renumbering existing screens**

Append to `features/customer/screen-contract.ts`:

```ts
{ id: 'CUS-16', href: '/app/mas', file: 'app/(customer)/app/mas/page.tsx', title: 'Más opciones' }
```

**Step 5: Run the boundary test**

Expected: PASS.

**Step 6: Commit**

```powershell
git add 'app/(customer)/app/mas/page.tsx' features/customer/screen-contract.ts tests/unit/customer-page-boundaries.vitest.test.ts
git commit -m "feat: add customer more placeholder"
```

### Task 4: Verify scope and regressions

**Files:**

- Modify only if a verified defect requires it: `components/app-shell/client-navigation.ts`, `components/app-shell/client-nav-item.tsx`, `components/app-shell/client-bottom-navigation.tsx`, `app/(customer)/app/mas/page.tsx`, and their tests.

**Step 1: Run focused tests**

```powershell
pnpm exec vitest run tests/unit/client-app-shell.vitest.test.tsx tests/unit/customer-page-boundaries.vitest.test.ts tests/unit/app-shell-integration.vitest.test.tsx tests/unit/app-navigation.vitest.test.tsx
```

Expected: PASS.

**Step 2: Run type checking**

```powershell
pnpm typecheck
```

Expected: PASS. If an unrelated dirty-worktree file fails, record the exact pre-existing failure and still validate every changed file with focused tests.

**Step 3: Run scoped lint**

```powershell
pnpm exec eslint components/app-shell/client-navigation.ts components/app-shell/client-nav-item.tsx components/app-shell/client-bottom-navigation.tsx 'app/(customer)/app/mas/page.tsx' features/customer/screen-contract.ts tests/unit/client-app-shell.vitest.test.tsx tests/unit/customer-page-boundaries.vitest.test.ts --max-warnings=0
```

Expected: PASS.

**Step 4: Inspect the menu at representative routes**

Using the authenticated local environment, check at 390 × 844 and 1440 × 1000:

- `/app` → Inicio active;
- `/app/trabajos` → Servicios active;
- `/app/solicitudes` → Servicios active;
- `/app/equipos` → Hogar active;
- `/app/perfil` → Más active;
- `/app/mas` → Más active;
- `/app/solicitar/aire-acondicionado` → bottom navigation hidden as before.

Confirm that labels do not wrap or overflow at 360 px and that Pedir remains centered and elevated.

**Step 5: Check the final diff**

```powershell
git diff --check
git status --short
git diff -- components/app-shell/client-navigation.ts components/app-shell/client-nav-item.tsx components/app-shell/client-bottom-navigation.tsx 'app/(customer)/app/mas/page.tsx' features/customer/screen-contract.ts tests/unit/client-app-shell.vitest.test.tsx tests/unit/customer-page-boundaries.vitest.test.ts
```

Confirm that no existing screen body, API, payment logic, authentication code, or unrelated dirty file changed.

**Step 6: Commit verification fixes only if needed**

```powershell
git add <only-scoped-files>
git commit -m "fix: polish client navigation restructure"
```

Do not create an empty commit.

## Definition of done

- Bottom navigation displays Inicio, Servicios, Pedir, Hogar, and Más in that order.
- Main destinations are `/app`, `/app/trabajos`, `/app/solicitar/aire-acondicionado`, `/app/hogar`, and `/app/mas`.
- Servicios is active across Trabajos, Solicitudes, and Presupuestos.
- Hogar is active across Hogar and Equipos.
- Más is active across Más, Perfil, Pagos, Garantías, Direcciones, and Mantenimientos.
- Inicio is active only on `/app`.
- Pedir retains its current visual treatment and focused-flow behavior.
- `/app/mas` exists as a minimal placeholder.
- Existing routes and screen logic remain unchanged.
- Focused tests, type checking, scoped lint, and responsive inspection are completed and reported.
