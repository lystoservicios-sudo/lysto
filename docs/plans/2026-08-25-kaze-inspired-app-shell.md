# Kaze-Inspired Lysto App Shell Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a maintainable, accessible and responsive App Shell for Lysto inspired by KazeCommerce while preserving all existing routes, domain logic and user-owned local changes.

**Architecture:** Keep `AppShell` as the shared server-side entry point for the Admin, Customer and Professional route groups. Compose it from a small client-side state provider, a role-aware sidebar, a neutral topbar and a flexible main-content surface. Reproduce KazeCommerce's useful behavior with Lysto's current Next.js, React, Tailwind 3 and Lucide stack rather than importing its shadcn/Radix subsystem.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 3, Lucide React, Vitest, Testing Library and Playwright.

---

## Working-tree constraints

- Treat `E:/Proyectos/GitHub/kazecommerce` as read-only.
- Before implementation, record its `HEAD` and tracked status; repeat the same checks at the end.
- Do not stage unrelated modified pages or `components/pro/`.
- Existing changes in `app/globals.css`, `components/layout/app-navigation.tsx`, `components/layout/page-shell.tsx` and `components/layout/page-scaffold.tsx` overlap this feature. Preserve useful user changes and inspect the final diff rather than replacing files from `HEAD`.
- The implementation must not add KazeCommerce paths, imports or runtime dependencies.

### Task 1: Record the verification baseline

**Files:**
- Read: `package.json`
- Read: `tests/unit/app-navigation.vitest.test.tsx`
- Read: `components/layout/app-navigation-config.ts`
- Read: `components/layout/page-shell.tsx`
- Read only: `E:/Proyectos/GitHub/kazecommerce/src/app/dashboard/layout.tsx`
- Read only: `E:/Proyectos/GitHub/kazecommerce/src/components/ui/sidebar.tsx`

**Step 1: Record Lysto's current checks without changing source**

Run:

```powershell
pnpm exec vitest run tests/unit/app-navigation.vitest.test.tsx
pnpm run typecheck
```

Expected: capture the exact baseline. The navigation test is expected to fail because it imports the former `AppNavigation` API while the dirty implementation exports `AppSidebar`.

**Step 2: Record the KazeCommerce guard values**

Run from `E:/Proyectos/GitHub/kazecommerce`:

```powershell
git rev-parse HEAD
git status --short --untracked-files=no
```

Expected: `HEAD` is recorded and tracked status is empty.

**Step 3: Confirm no cross-repository references exist**

Run:

```powershell
rg -n -S "kazecommerce|E:/Proyectos/GitHub/kazecommerce|E:\\Proyectos\\GitHub\\kazecommerce" app components lib package.json tsconfig.json
```

Expected: no matches.

### Task 2: Specify provider and navigation behavior with failing tests

**Files:**
- Modify: `tests/unit/app-navigation.vitest.test.tsx`
- Create: `tests/unit/app-shell-state.vitest.test.tsx`
- Test: `components/layout/app-shell-provider.tsx`
- Test: `components/layout/app-sidebar.tsx`
- Test: `components/layout/app-topbar.tsx`

**Step 1: Replace the obsolete component contract in the navigation test**

Mock `next/navigation` with `/admin/trabajos`, render a provider containing `AppSidebar` and `AppTopbar`, and assert:

```tsx
render(
  <AppShellProvider defaultOpen>
    <AppSidebar role="Admin" />
    <AppTopbar role="Admin" />
  </AppShellProvider>
)

expect(screen.getByRole('link', { name: 'Trabajos' })).toHaveAttribute('aria-current', 'page')
expect(screen.queryByText('Productos')).not.toBeInTheDocument()
expect(screen.queryByText('Pedidos')).not.toBeInTheDocument()
```

Add a desktop test that clicks `Contraer navegación`, expects the sidebar to expose `data-state="collapsed"`, and checks that the trigger name changes to `Expandir navegación`.

**Step 2: Add mobile accessibility tests**

Stub `window.matchMedia` and set `window.innerWidth = 390`. Assert:

```tsx
fireEvent.click(screen.getByRole('button', { name: 'Abrir navegación' }))
const dialog = screen.getByRole('dialog', { name: 'Navegación principal' })
expect(dialog).toBeInTheDocument()
expect(document.body.style.overflow).toBe('hidden')
expect(screen.getByRole('button', { name: 'Cerrar navegación' })).toHaveFocus()

fireEvent.keyDown(document, { key: 'Escape' })
expect(screen.queryByRole('dialog', { name: 'Navegación principal' })).not.toBeInTheDocument()
expect(screen.getByRole('button', { name: 'Abrir navegación' })).toHaveFocus()
```

Also test backdrop close, link close, focus cycling with Tab/Shift+Tab and body-scroll restoration.

**Step 3: Add state persistence tests**

Render with `defaultOpen`, collapse desktop navigation and assert:

```tsx
expect(document.cookie).toContain('sidebar_state=false')
```

Dispatch `Ctrl+B` and assert the state toggles back. Add cleanup that restores cookies, viewport, body overflow and DOM between cases.

**Step 4: Run tests to verify they fail**

Run:

```powershell
pnpm exec vitest run tests/unit/app-navigation.vitest.test.tsx tests/unit/app-shell-state.vitest.test.tsx
```

Expected: FAIL because the new provider, sidebar and topbar modules do not exist.

### Task 3: Implement the App Shell state provider

**Files:**
- Create: `components/layout/app-shell-provider.tsx`
- Test: `tests/unit/app-shell-state.vitest.test.tsx`

**Step 1: Define the focused context contract**

Implement this public contract:

```tsx
type AppShellContextValue = {
  desktopOpen: boolean
  mobileOpen: boolean
  setDesktopOpen: (open: boolean) => void
  setMobileOpen: (open: boolean) => void
  toggleSidebar: () => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

export function useAppShell(): AppShellContextValue
export function AppShellProvider(props: {
  children: React.ReactNode
  defaultOpen?: boolean
}): React.JSX.Element
```

`toggleSidebar` must use `window.innerWidth < 768` to choose the mobile drawer or desktop collapse. Desktop changes write `sidebar_state=<boolean>; path=/; max-age=604800; samesite=lax`. Register `Ctrl/Cmd+B`, close mobile on a transition to desktop and restore all listeners on unmount.

**Step 2: Implement body-scroll ownership safely**

When mobile opens, save the previous `document.body.style.overflow`, set it to `hidden`, and restore the saved value on close or unmount. Do not unconditionally erase another component's pre-existing overflow value.

**Step 3: Run provider tests**

Run:

```powershell
pnpm exec vitest run tests/unit/app-shell-state.vitest.test.tsx
```

Expected: provider state, cookie, shortcut and scroll tests PASS; component tests can still fail.

**Step 4: Commit only the new provider and its test if staging is clean**

```powershell
git add -- components/layout/app-shell-provider.tsx tests/unit/app-shell-state.vitest.test.tsx
git diff --cached --check
git commit -m "feat: add Lysto app shell state"
```

If the test file contains unrelated pre-existing edits, leave it unstaged and report that constraint instead of committing mixed work.

### Task 4: Build the role-aware sidebar and neutral topbar

**Files:**
- Create: `components/layout/app-sidebar.tsx`
- Create: `components/layout/app-topbar.tsx`
- Modify: `components/layout/app-navigation-config.ts`
- Modify: `tests/unit/app-navigation.vitest.test.tsx`

**Step 1: Keep navigation data separate from presentation**

Preserve the existing role maps and active-route helper. Add a role presentation map only if required:

```ts
export const appRoleLabels: Record<AppRole, string> = {
  Admin: 'Administración',
  Cliente: 'Espacio cliente',
  Profesional: 'Espacio profesional'
}
```

Do not add new routes or ecommerce labels.

**Step 2: Implement desktop sidebar structure**

`AppSidebar` must render:

- a desktop `aside` visible from `md` upward;
- width transition between `16rem` and `3.5rem`;
- Lysto identity in the header;
- one labeled navigation group using current role data;
- `aria-current="page"` and `data-active` on active links;
- icon-only links with accessible labels and native `title` when collapsed;
- a neutral footer saying that navigation is provisional, with no fake user or logout data.

Use `cn` and literal Tailwind classes compatible with Tailwind 3. Avoid Tailwind 4-only syntax such as `size-*`, `w-(--token)`, `outline-hidden` and `group-has-data-*`.

**Step 3: Implement the modal mobile sidebar**

Render the overlay at document level with `createPortal` after mount. Use:

```tsx
<aside
  id="mobile-app-navigation"
  role="dialog"
  aria-modal="true"
  aria-label="Navegación principal"
>
```

Focus the close control on open. Trap Tab and Shift+Tab inside the dialog, close on Escape, backdrop or destination, and return focus to `triggerRef` after close. Use a real button for the backdrop with an accessible name.

**Step 4: Implement the topbar**

`AppTopbar` must render a sticky 64 px bar with:

- the shared trigger using `triggerRef`;
- dynamic accessible name for mobile open and desktop expand/collapse;
- Lysto identity on mobile;
- the current role label;
- no notification, storefront, theme, avatar or logout placeholders.

**Step 5: Run focused tests**

Run:

```powershell
pnpm exec vitest run tests/unit/app-navigation.vitest.test.tsx tests/unit/app-shell-state.vitest.test.tsx
```

Expected: PASS.

**Step 6: Commit new components and scoped navigation changes if staging remains isolated**

```powershell
git add -- components/layout/app-sidebar.tsx components/layout/app-topbar.tsx components/layout/app-navigation-config.ts tests/unit/app-navigation.vitest.test.tsx
git diff --cached --check
git commit -m "feat: add responsive role-aware app navigation"
```

### Task 5: Integrate the new shell and preserve current screens

**Files:**
- Modify: `components/layout/page-shell.tsx`
- Modify: `app/globals.css`
- Delete: `components/layout/app-navigation.tsx`
- Verify unchanged: `app/(admin)/admin/layout.tsx`
- Verify unchanged: `app/(customer)/app/layout.tsx`
- Verify unchanged: `app/(professional)/pro/layout.tsx`

**Step 1: Read the persisted default on the server**

Make `AppShell` asynchronous and read `sidebar_state` using `cookies()` from `next/headers`. Treat only the literal value `false` as collapsed so missing or invalid values safely default to expanded.

Compose:

```tsx
<AppShellProvider defaultOpen={defaultOpen}>
  <div className="flex min-h-screen w-full bg-[var(--shell-background)]">
    <AppSidebar role={role} />
    <div className="flex min-w-0 flex-1 flex-col">
      <AppTopbar role={role} />
      <main id="main-content" className="min-w-0 flex-1 px-4 pb-8 pt-6 md:px-6">
        <div className="mx-auto w-full max-w-[90rem]">{children}</div>
      </main>
    </div>
  </div>
</AppShellProvider>
```

Keep `PublicShell` behavior and public routes intact.

**Step 2: Add minimal shell tokens and motion rules**

Extend the existing `:root` rather than replacing it:

```css
--shell-background: #f8fafc;
--shell-surface: #ffffff;
--shell-foreground: #0f172a;
--shell-muted: #64748b;
--shell-border: #e2e8f0;
--shell-accent: #2563eb;
--shell-accent-soft: #eff6ff;
```

Keep the user's Inter and premium-card changes. Restore generic link/control inheritance if missing. Replace obsolete drawer animation selectors with the new names and retain a `prefers-reduced-motion` override.

**Step 3: Remove only the obsolete navigation implementation**

Delete `components/layout/app-navigation.tsx` after `rg` proves no consumer remains:

```powershell
rg -n -S "app-navigation|AppNavigation" app components tests -g "*.ts" -g "*.tsx"
```

Expected before deletion: no consumers except the obsolete file itself.

**Step 4: Run integration checks**

Run:

```powershell
pnpm run typecheck
pnpm exec eslint components/layout app/globals.css tests/unit/app-navigation.vitest.test.tsx tests/unit/app-shell-state.vitest.test.tsx --max-warnings=0
pnpm exec vitest run tests/unit/app-navigation.vitest.test.tsx tests/unit/app-shell-state.vitest.test.tsx
```

Expected: PASS. If ESLint does not accept CSS paths, rerun the same scoped command without `app/globals.css` and verify CSS through the build.

**Step 5: Inspect overlap before any commit**

Run:

```powershell
git diff -- components/layout/page-shell.tsx app/globals.css components/layout/app-navigation.tsx
git diff --cached --stat
```

Do not commit a mixed hunk merely to satisfy the plan. Leave overlapping integration changes unstaged if they cannot be separated safely from the user's prior work.

### Task 6: Verify responsive behavior in the real app

**Files:**
- Create: `tests/e2e/app-shell.spec.ts`
- Read: `playwright.config.ts`

**Step 1: Add shell-only browser acceptance cases**

Test an existing lightweight authenticated-layout route without changing its screen content. Cover:

```ts
test('desktop sidebar collapses without hiding main content')
test('mobile navigation opens, selects a route and closes')
test('shell has no horizontal overflow at 390px, 768px and 1440px')
```

Use role/name assertions. At each viewport assert `document.documentElement.scrollWidth <= document.documentElement.clientWidth` and that `#main-content` is visible.

**Step 2: Run the focused browser suite**

Run:

```powershell
pnpm exec playwright test tests/e2e/app-shell.spec.ts --project=chromium
```

Expected: PASS. If application authentication redirects prevent using a route, test the route that already works under the repository's current test setup; do not add an auth bypass.

**Step 3: Perform visual inspection**

Inspect at 390 × 844, 768 × 1024 and 1440 × 900. Verify sidebar geometry, active state, topbar, content spacing, scroll behavior, close controls and absence of clipped focus rings.

### Task 7: Run the complete quality gate and prove repository isolation

**Files:**
- Verify all changed files
- Read only: `E:/Proyectos/GitHub/kazecommerce`

**Step 1: Run Lysto's automated gate**

Run in order:

```powershell
git diff --check
pnpm run lint
pnpm run typecheck
pnpm run test:unit
pnpm run build
```

Expected: every command exits 0. If an unrelated pre-existing failure occurs, record the exact failure and prove whether the touched files caused it; do not describe the gate as passing.

**Step 2: Scan for prohibited coupling and out-of-scope concepts**

Run:

```powershell
rg -n -S "kazecommerce|E:/Proyectos/GitHub/kazecommerce|Pedidos|Productos|Ver tienda|Cambiar tienda|Clerk" app components lib package.json
```

Expected: no KazeCommerce reference and no ecommerce-only shell label. Existing unrelated domain text must be classified rather than deleted.

**Step 3: Prove KazeCommerce stayed read-only**

Run from `E:/Proyectos/GitHub/kazecommerce`:

```powershell
git rev-parse HEAD
git status --short --untracked-files=no
```

Expected: `HEAD` matches Task 1 and tracked status remains empty.

**Step 4: Review final Lysto scope**

Run:

```powershell
git status --short
git diff --stat
git diff --check
```

Confirm no application page, domain module, API route, Supabase file or user-owned `components/pro/` file was unintentionally changed by this feature.

**Step 5: Update documentation status**

After all verification passes, change `Estado: Aprobado` to `Estado: Implementado y verificado` in `docs/plans/2026-08-25-kaze-inspired-app-shell-design.md` and record the verification date.

Commit only documentation or safely isolated feature paths. Do not stage the entire dirty working tree.
