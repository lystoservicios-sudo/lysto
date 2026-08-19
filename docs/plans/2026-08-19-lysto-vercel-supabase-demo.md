# Lysto Vercel + Supabase Demo Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Publicar una demo de preproducción en Vercel con Supabase Auth real, aislamiento por rol y tres cuentas de prueba verificadas.

**Architecture:** Next.js conservará la UI existente y usará `@supabase/ssr` para sesiones en cookies. El middleware y los layouts validarán usuario, `app_metadata.app_role` y perfil persistido antes de permitir `/app`, `/pro` o `/admin`. El proyecto Supabase autorizado recibirá las migraciones mediante link, dry-run y push controlado; las cuentas se aprovisionarán con un script server-only e idempotente y Vercel recibirá sólo variables necesarias para el preview.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase Auth/Postgres/RLS, `@supabase/ssr`, Zod, Vitest, Playwright, Vercel CLI, Supabase CLI.

---

## Reglas de ejecución

- Usar `@supabase`, `@test-driven-development`, `@systematic-debugging`, `@vercel-deploy` y `@verification-before-completion` cuando corresponda.
- Trabajar en `E:\Proyectos\GitHub\Lysto-worktrees\mvp-implementation`, rama `feat/mvp-implementation`.
- No usar `db reset --linked`.
- No continuar si `supabase projects list` no muestra exactamente `dqonlqcurvjnjgsczevu` después de autenticar.
- No exponer `SUPABASE_SERVICE_ROLE_KEY` en Vercel, el navegador, logs o commits.
- No escribir contraseñas demo en archivos. Inyectarlas sólo mediante variables del proceso de aprovisionamiento.
- Desplegar Vercel como preview; no usar `--prod`.
- Mantener Mercado Pago, email, WhatsApp e IA en modo mock/deshabilitado.

### Task 1: Contrato puro de sesión y rutas por rol

**Files:**
- Create: `lib/auth/session-routing.ts`
- Create: `tests/unit/auth-session-routing.vitest.test.ts`

**Step 1: Write the failing tests**

Cubrir estas decisiones:

```ts
expect(readTrustedRole({ app_role: 'customer' })).toBe('customer')
expect(readTrustedRole({ app_role: 'owner' })).toBeNull()
expect(requiredRoleForPath('/app/trabajos')).toBe('customer')
expect(requiredRoleForPath('/pro/dashboard')).toBe('professional')
expect(requiredRoleForPath('/admin/dashboard')).toBe('admin')
expect(roleHome('customer')).toBe('/app')
expect(roleHome('professional')).toBe('/pro/dashboard')
expect(roleHome('admin')).toBe('/admin/dashboard')
expect(canRoleAccessPath('customer', '/admin')).toBe(false)
expect(canRoleAccessPath('admin', '/app')).toBe(false)
```

La última regla es deliberadamente estricta para la demo: cada credencial entra sólo en su superficie.

**Step 2: Run the tests and prove RED**

Run:

```powershell
corepack pnpm vitest run tests/unit/auth-session-routing.vitest.test.ts --maxWorkers=1 --minWorkers=1 --no-file-parallelism
```

Expected: FAIL porque `lib/auth/session-routing.ts` no existe.

**Step 3: Implement the minimum pure contract**

```ts
import type { UserRole } from '../domain/types'

const homes: Record<UserRole, string> = {
  customer: '/app',
  professional: '/pro/dashboard',
  admin: '/admin/dashboard'
}

export function readTrustedRole(metadata: unknown): UserRole | null
export function requiredRoleForPath(pathname: string): UserRole | null
export function roleHome(role: UserRole): string
export function canRoleAccessPath(role: UserRole | null, pathname: string): boolean
```

`readTrustedRole` sólo acepta `customer`, `professional` o `admin` en `app_role`. Las rutas no protegidas retornan `null` en `requiredRoleForPath`.

**Step 4: Run GREEN and lint**

Run:

```powershell
corepack pnpm vitest run tests/unit/auth-session-routing.vitest.test.ts --maxWorkers=1 --minWorkers=1 --no-file-parallelism
corepack pnpm exec eslint lib/auth/session-routing.ts tests/unit/auth-session-routing.vitest.test.ts
```

Expected: PASS.

**Step 5: Commit**

```powershell
git add lib/auth/session-routing.ts tests/unit/auth-session-routing.vitest.test.ts
git commit -m "feat: define trusted demo session routing"
```

### Task 2: Refrescar sesión y proteger rutas en middleware

**Files:**
- Create: `lib/supabase/middleware.ts`
- Modify: `middleware.ts`
- Create: `tests/unit/auth-middleware.vitest.test.ts`

**Step 1: Write failing middleware-decision tests**

Extraer una función pura `decideSessionRoute` que reciba:

```ts
type SessionRouteInput = {
  pathname: string
  hasUser: boolean
  jwtRole: UserRole | null
  profileRole: UserRole | null
  professionalStatus?: ProfessionalStatus
}
```

Debe devolver `{ kind: 'next' }` o `{ kind: 'redirect'; destination: string; reason: string }`.

Probar:

- anónimo en `/app` → `/login`;
- cliente en `/app` → next;
- cliente en `/admin` → `/app`;
- técnico aprobado en `/pro` → next;
- técnico no aprobado en `/pro` → `/pro/perfil?estado=revision`;
- admin en `/admin` → next;
- JWT y perfil discordantes → `/login?error=invalid_profile`;
- sesión válida en `/login` → home del rol;
- ruta pública → next.

**Step 2: Run RED**

```powershell
corepack pnpm vitest run tests/unit/auth-middleware.vitest.test.ts --maxWorkers=1 --minWorkers=1 --no-file-parallelism
```

Expected: FAIL por helper ausente.

**Step 3: Implement the SSR middleware adapter**

`lib/supabase/middleware.ts` debe:

1. crear `createServerClient<Database>` con `request.cookies.getAll()`;
2. copiar cada cookie refrescada al request y a la response;
3. llamar `auth.getUser()` para verificar la sesión;
4. leer `app_metadata.app_role` con `readTrustedRole`;
5. consultar `profiles(role)` por `auth_user_id`;
6. si es profesional, consultar `professional_profiles(status)`;
7. ejecutar `decideSessionRoute`;
8. conservar las cookies refrescadas también en redirects.

`middleware.ts` queda como adaptador fino:

```ts
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}
```

No confiar en query params para elegir el destino. No registrar JWT, email ni cookies.

**Step 4: Run GREEN, typecheck and lint**

```powershell
corepack pnpm vitest run tests/unit/auth-session-routing.vitest.test.ts tests/unit/auth-middleware.vitest.test.ts --maxWorkers=1 --minWorkers=1 --no-file-parallelism
corepack pnpm typecheck
corepack pnpm exec eslint middleware.ts lib/supabase/middleware.ts tests/unit/auth-middleware.vitest.test.ts
```

Expected: PASS.

**Step 5: Commit**

```powershell
git add middleware.ts lib/supabase/middleware.ts tests/unit/auth-middleware.vitest.test.ts
git commit -m "feat: enforce Supabase sessions by role"
```

### Task 3: Login y logout reales

**Files:**
- Create: `lib/auth/login-contract.ts`
- Create: `tests/unit/login-contract.vitest.test.ts`
- Create: `app/(auth)/actions.ts`
- Modify: `app/(auth)/login/page.tsx`
- Modify: `components/layout/page-shell.tsx`

**Step 1: Write failing login-contract tests**

Probar que:

```ts
expect(parseLoginInput({ email: ' CLIENTE@EXAMPLE.COM ', password: 'abcdefgh' }))
  .toEqual({ email: 'cliente@example.com', password: 'abcdefgh' })
expect(() => parseLoginInput({ email: 'bad', password: '' })).toThrow()
expect(loginErrorMessage('invalid_credentials')).toBe('Email o contraseña incorrectos.')
expect(loginErrorMessage('invalid_profile')).toBe('La cuenta no tiene un perfil habilitado.')
expect(loginErrorMessage('anything-else')).toBe('No pudimos iniciar sesión. Intentá nuevamente.')
```

**Step 2: Run RED**

```powershell
corepack pnpm vitest run tests/unit/login-contract.vitest.test.ts --maxWorkers=1 --minWorkers=1 --no-file-parallelism
```

Expected: FAIL por módulo ausente.

**Step 3: Implement the pure login contract**

Usar Zod con email válido y contraseña de 8–128 caracteres. Normalizar sólo email; nunca transformar la contraseña. Mapear códigos públicos conocidos a mensajes genéricos.

**Step 4: Implement server actions**

En `app/(auth)/actions.ts`:

```ts
'use server'

export async function login(formData: FormData): Promise<never>
export async function logout(): Promise<never>
```

`login` debe:

- validar input;
- llamar `supabase.auth.signInWithPassword`;
- verificar inmediatamente `auth.getUser()`;
- comprobar rol JWT + perfil persistido;
- comprobar `professional_profiles.status = approved` para el técnico demo;
- hacer `signOut()` si el perfil es inválido;
- redirigir con `roleHome`.

Los fallos sólo redirigen a códigos permitidos:

```text
/login?error=invalid_input
/login?error=invalid_credentials
/login?error=invalid_profile
/login?error=service_unavailable
```

`logout` llama `auth.signOut()` y redirige a `/login`.

**Step 5: Wire the UI**

- Convertir el bloque de login en `<form action={login}>`.
- Agregar `name="email"`, `name="password"`, `required` y `autoComplete` correctos.
- Mostrar un mensaje accesible `role="alert"` a partir de `searchParams.error`.
- No prellenar credenciales en HTML.
- Agregar en `AppShell` un `<form action={logout}>` con botón `Cerrar sesión`.

**Step 6: Run GREEN and app gates**

```powershell
corepack pnpm vitest run tests/unit/login-contract.vitest.test.ts --maxWorkers=1 --minWorkers=1 --no-file-parallelism
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
```

Expected: PASS. Si `next-env.d.ts` cambia por el build, excluir ese cambio generado antes del commit.

**Step 7: Commit**

```powershell
git add lib/auth/login-contract.ts tests/unit/login-contract.vitest.test.ts 'app/(auth)/actions.ts' 'app/(auth)/login/page.tsx' components/layout/page-shell.tsx
git commit -m "feat: connect the Lysto login to Supabase Auth"
```

### Task 4: Defensa en profundidad en los layouts

**Files:**
- Create: `lib/auth/require-session-role.ts`
- Create: `tests/unit/require-session-role.vitest.test.ts`
- Modify: `app/(customer)/app/layout.tsx`
- Modify: `app/(professional)/pro/layout.tsx`
- Modify: `app/(admin)/admin/layout.tsx`

**Step 1: Write failing resolver tests**

Diseñar `resolveRequiredSession` con dependencias inyectables para probar:

- usuario faltante;
- rol JWT faltante;
- perfil persistido faltante;
- discordancia JWT/DB;
- profesional no aprobado;
- rol correcto.

Expected outputs: un perfil confiable o un código `anonymous`, `invalid_profile`, `wrong_role`, `professional_not_approved`.

**Step 2: Run RED**

```powershell
corepack pnpm vitest run tests/unit/require-session-role.vitest.test.ts --maxWorkers=1 --minWorkers=1 --no-file-parallelism
```

**Step 3: Implement the server guard**

`requireSessionRole(expectedRole)` debe verificar `auth.getUser()`, JWT, perfil y subtipo. Los layouts deben ejecutar:

```ts
await requireSessionRole('customer')
await requireSessionRole('professional')
await requireSessionRole('admin')
```

Ante fallo, redirigir al login o al home correcto. Esto complementa middleware y RLS; no los reemplaza.

**Step 4: Run GREEN and build**

```powershell
corepack pnpm vitest run tests/unit/require-session-role.vitest.test.ts --maxWorkers=1 --minWorkers=1 --no-file-parallelism
corepack pnpm typecheck
corepack pnpm build
```

Expected: PASS, áreas privadas renderizadas dinámicamente.

**Step 5: Commit**

```powershell
git add lib/auth/require-session-role.ts tests/unit/require-session-role.vitest.test.ts 'app/(customer)/app/layout.tsx' 'app/(professional)/pro/layout.tsx' 'app/(admin)/admin/layout.tsx'
git commit -m "feat: guard every role layout on the server"
```

### Task 5: Aprovisionamiento idempotente de cuentas demo

**Files:**
- Create: `lib/demo/accounts.ts`
- Create: `tests/unit/demo-accounts.vitest.test.ts`
- Create: `scripts/provision-demo-users.ts`
- Modify: `package.json`

**Step 1: Write failing account-definition tests**

La definición debe tener exactamente tres cuentas, emails únicos y estos roles:

```ts
[
  { key: 'customer', email: 'cliente.demo@lysto.test', role: 'customer' },
  { key: 'professional', email: 'tecnico.demo@lysto.test', role: 'professional' },
  { key: 'admin', email: 'admin.demo@lysto.test', role: 'admin' }
]
```

Probar además que cada cuenta resuelve el nombre de variable de contraseña correcto y que ninguna contraseña forma parte de la definición.

**Step 2: Run RED**

```powershell
corepack pnpm vitest run tests/unit/demo-accounts.vitest.test.ts --maxWorkers=1 --minWorkers=1 --no-file-parallelism
```

**Step 3: Implement the account definitions**

Usar nombres y apellidos de demo no reales. El técnico debe declararse `approved`; el admin debe solicitar permiso `owner`.

**Step 4: Implement the server-only provisioning script**

El script debe exigir:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
DEMO_CUSTOMER_PASSWORD
DEMO_PROFESSIONAL_PASSWORD
DEMO_ADMIN_PASSWORD
```

Por cada cuenta:

1. buscar por email con `auth.admin.listUsers`;
2. crear o actualizar mediante `auth.admin.createUser` / `updateUserById`;
3. fijar `email_confirm: true` y `app_metadata: { app_role: role }`;
4. upsert en `public.profiles` por `auth_user_id`;
5. upsert del subtipo correcto;
6. para técnico, estado `approved`;
7. para admin, llamar `set_admin_permissions(..., ['owner'])` con service role;
8. verificar que Auth y perfil persistido coincidan.

No imprimir passwords, service key o tokens. Imprimir únicamente email, rol, UUID y estado `ready`.

Agregar:

```json
"demo:provision": "node --experimental-strip-types scripts/provision-demo-users.ts"
```

**Step 5: Run GREEN, lint and typecheck**

```powershell
corepack pnpm vitest run tests/unit/demo-accounts.vitest.test.ts --maxWorkers=1 --minWorkers=1 --no-file-parallelism
corepack pnpm exec eslint lib/demo/accounts.ts scripts/provision-demo-users.ts tests/unit/demo-accounts.vitest.test.ts
corepack pnpm typecheck
```

**Step 6: Commit**

```powershell
git add lib/demo/accounts.ts tests/unit/demo-accounts.vitest.test.ts scripts/provision-demo-users.ts package.json
git commit -m "feat: provision isolated Lysto demo accounts"
```

### Task 6: Autenticar y migrar el Supabase remoto autorizado

**Files:**
- No repository changes expected.

**Step 1: Authenticate the owning account**

Run interactively:

```powershell
corepack pnpm supabase login
corepack pnpm supabase projects list
```

Expected: la lista contiene `dqonlqcurvjnjgsczevu`. Si no aparece, STOP y pedir la cuenta correcta; no intentar otro proyecto.

**Step 2: Link explicitly**

```powershell
corepack pnpm supabase link --project-ref dqonlqcurvjnjgsczevu
corepack pnpm supabase projects list
```

Ingresar la contraseña de base sólo en el prompt seguro. Expected: el proyecto figura `linked: true`.

**Step 3: Inspect before mutation**

```powershell
corepack pnpm supabase migration list --linked
corepack pnpm supabase db push --linked --include-all --dry-run
```

Expected: sólo migraciones 001–007 pendientes, sin objetos inesperados ni reparaciones de historial. Si el remoto no está vacío o el diff no coincide, STOP; no ejecutar reset ni repair.

**Step 4: Apply migrations and seed**

```powershell
corepack pnpm supabase db push --linked --include-all --include-seed
```

Expected: 001–007 aplicadas y seed piloto cargado.

**Step 5: Verify the remote schema**

```powershell
corepack pnpm supabase migration list --linked
corepack pnpm supabase db lint --linked --schema public --schema private --level warning --fail-on warning
corepack pnpm supabase test db --linked
```

Expected: historia alineada, lint limpio y 376 pgTAP aprobados. Si la extensión pgTAP no está disponible en el plan remoto, registrar el motivo y ejecutar las suites RLS críticas mediante el mecanismo soportado; no declarar verde sin prueba equivalente.

### Task 7: Crear y verificar las tres cuentas reales

**Files:**
- Create temporarily only: process environment values; do not write `.env.demo`.

**Step 1: Retrieve project API details securely**

Usar la CLI autenticada o el dashboard para obtener:

- Project URL;
- publishable key;
- secret/service key sólo para el proceso local.

No usar `--reveal` en un comando cuyo output quede registrado. Preferir prompt o canal seguro.

**Step 2: Generate three different strong passwords**

Usar un generador criptográfico con al menos 20 caracteres, mayúsculas, minúsculas, números y símbolos. Mantenerlas sólo en variables del proceso.

**Step 3: Run the idempotent provisioner**

```powershell
corepack pnpm demo:provision
```

Expected: tres líneas `ready`, una por email, sin imprimir secretos.

**Step 4: Verify real sign-in**

Con un cliente Supabase usando la publishable key, iniciar sesión con cada cuenta y comprobar:

- `app_metadata.app_role` esperado;
- `profiles.role` coincidente;
- subtipo existente;
- técnico `approved`;
- admin con permiso `owner`.

Cerrar cada sesión después de verificar.

### Task 8: E2E de login y aislamiento por rol

**Files:**
- Create: `tests/e2e/demo-auth.spec.ts`
- Modify: `playwright.config.ts`
- Modify: `package.json`

**Step 1: Write the E2E tests**

El spec usa emails públicos de demo y passwords sólo desde:

```text
DEMO_CUSTOMER_PASSWORD
DEMO_PROFESSIONAL_PASSWORD
DEMO_ADMIN_PASSWORD
```

Casos desktop Chromium:

- cliente inicia sesión, llega a `/app`, no entra a `/admin`;
- técnico llega a `/pro/dashboard`, no entra a `/app`;
- admin llega a `/admin/dashboard`, no entra a `/pro`;
- logout vuelve a `/login` y bloquea la ruta privada.

**Step 2: Configure a targeted script**

Agregar:

```json
"test:e2e:demo": "playwright test tests/e2e/demo-auth.spec.ts --project=chromium-desktop"
```

Configurar `playwright.config.ts` para que `webServer.command` use `corepack pnpm dev`, sin hardcodear secretos.

**Step 3: Run against local Next + remote demo Supabase**

```powershell
corepack pnpm test:e2e:demo
```

Expected: PASS para las tres cuentas. Si falta el navegador, instalar únicamente Chromium mediante el comando oficial de Playwright y repetir una vez.

**Step 4: Commit**

```powershell
git add tests/e2e/demo-auth.spec.ts playwright.config.ts package.json
git commit -m "test: cover hosted demo authentication"
```

### Task 9: Crear el preview de Vercel

**Files:**
- Modify: `README.md`
- Create: `docs/development/demo-environment.md`
- Local ignored output: `.vercel/`

**Step 1: Document the environment honestly**

Documentar:

- demo/preproducción, no producción;
- Supabase project ref;
- tres emails sin contraseñas;
- integraciones mock;
- cómo rotar/eliminar cuentas;
- nunca usar `db reset --linked`;
- URL preview después del deploy.

**Step 2: Commit documentation**

```powershell
git add README.md docs/development/demo-environment.md
git commit -m "docs: describe the hosted demo environment"
```

**Step 3: Create and link the Vercel project**

```powershell
vercel project add lysto-demo
vercel link --project lysto-demo --yes
```

Expected: `.vercel/project.json` existe y permanece ignorado.

**Step 4: Add preview environment variables**

Agregar mediante prompt/stdin, no mediante valores visibles en el comando:

```text
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
PAYMENTS_PROVIDER=mock
NOTIFICATIONS_EMAIL_ENABLED=false
WHATSAPP_ENABLED=false
AI_ENABLED=false
```

No agregar `SUPABASE_SERVICE_ROLE_KEY` ni passwords demo a Vercel.

Confirmar con:

```powershell
vercel env list preview
```

La lista debe mostrar nombres y targets, no valores secretos.

**Step 5: Dry-inspect deployment inputs**

```powershell
vercel deploy . --project lysto-demo --dry
```

Expected: framework Next.js, sin `.env.local`, `.supabase`, `.next`, `node_modules` ni archivos de credenciales incluidos.

**Step 6: Deploy preview**

```powershell
vercel deploy . --project lysto-demo --yes
```

Expected: URL preview y build exitoso. No usar `--prod`. Según la guía de despliegue, no hacer `curl` ni fetch automático de la URL; entregarla para validación manual.

### Task 10: Final verification and handoff

**Files:**
- Modify if needed: `checks/TEST_RESULTS.md`
- Modify if needed: `docs/development/demo-environment.md`

**Step 1: Run all local gates**

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm test:e2e:demo
git diff --check
```

Expected: all PASS. Restore/exclude the build-generated `next-env.d.ts` change if it appears.

**Step 2: Run remote database gates**

```powershell
corepack pnpm supabase migration list --linked
corepack pnpm supabase db lint --linked --schema public --schema private --level warning --fail-on warning
corepack pnpm supabase test db --linked
```

Expected: 001–007 aligned, lint clean, 376/376 pgTAP.

**Step 3: Check security and repository hygiene**

- no demo passwords in Git;
- no service key in Vercel or client bundles;
- no real `.env` tracked;
- `.vercel`, `.next`, `.supabase`, `node_modules`, Playwright artifacts and logs ignored;
- branch worktree clean after final commit.

**Step 4: Update evidence and commit**

```powershell
git add checks/TEST_RESULTS.md docs/development/demo-environment.md
git commit -m "docs: record the hosted demo verification"
```

Skip this commit if the two files need no changes.

**Step 5: Request independent review**

Review Auth/session security, remote migration evidence, credential hygiene, role isolation and deploy configuration. Fix every Critical/Important issue and rerun proportionate gates.

**Step 6: Handoff to the owner**

Entregar:

- URL preview de Vercel;
- email y password de cliente;
- email y password de técnico;
- email y password de admin;
- lista de integraciones todavía mock;
- confirmación de que no hubo deploy productivo ni push salvo autorización separada.
