# Lysto MVP Operativo Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Construir y publicar el MVP operativo completo de Lysto para aire acondicionado en CABA y corredor sur, conectando cliente, profesional y administración con Supabase, Railway y Mercado Pago.

**Architecture:** Partir de la base del ZIP como material recuperable, estabilizarla y convertirla en un monolito modular con Next.js App Router. Las pantallas llamarán servicios de aplicación; las reglas vivirán en módulos de dominio; Supabase será la fuente persistente protegida por RLS y los proveedores externos estarán detrás de adaptadores idempotentes.

**Tech Stack:** Next.js App Router, React, TypeScript estricto, Tailwind CSS, componentes accesibles compatibles con shadcn/ui, Supabase Auth/Postgres/Storage/RLS, Zod, Vitest, Testing Library, Playwright, Mercado Pago, GitHub Actions y Railway.

---

## Reglas de ejecución

- Leer primero `docs/plans/2026-08-19-lysto-mvp-operativo-design.md`.
- Ejecutar este plan en un worktree y una rama de trabajo, nunca directamente en `main`.
- Usar `@test-driven-development` para cada comportamiento y `@verification-before-completion` antes de cerrar cada hito.
- Usar `@supabase` en cualquier tarea que toque Auth, Postgres, Storage, RLS o tipos generados.
- Usar `@supabase-postgres-best-practices` al revisar esquema, índices, consultas y funciones.
- No incluir secretos, contraseñas ni tokens en archivos, comandos versionados, fixtures o capturas.
- No aplicar migraciones a producción hasta que pasen local, staging, pruebas RLS y revisión manual.
- Mantener commits pequeños. Si un paso descubre un cambio de alcance, actualizar primero el diseño aprobado.
- La integración Mercado Pago MCP no es un requisito para desarrollar; la API oficial y el sandbox son la fuente de verdad.

## Línea base comprobada del ZIP

El archivo fuente es `C:\Users\quime\Downloads\lysto-mvp-operativo-v4.zip` y contiene su proyecto bajo `lysto/`.

La auditoría del 19/08/2026 comprobó:

- La instalación resuelve 474 paquetes, pero el ZIP no incluye `pnpm-lock.yaml`.
- `pnpm test:domain` falla en Windows porque usa `URL.pathname` como ruta nativa y produce `C:\C:\...`.
- `pnpm typecheck` falla por contratos divergentes, un import inexistente y tipos incompletos.
- `pnpm lint` informa 14 errores y 1 advertencia.
- `pnpm test:unit` no encuentra archivos compatibles con el patrón configurado.
- `pnpm build` falla porque `app/api/quality/open-case/route.ts` importa `@/lib/quality/support`, que no existe.
- Muchas pantallas y handlers todavía dependen de `lib/mock/lysto-data.ts`.
- Las políticas iniciales de Storage permiten insertar a cualquier usuario autenticado y deben endurecerse.
- La tabla de comprobantes públicos no debe quedar seleccionable en bloque solo por no estar revocada.

No se debe presentar la base importada como funcional hasta completar las tareas 1 a 3.

---

### Task 1: Importar la base recuperable y registrar su procedencia

**Files:**
- Source: `C:\Users\quime\Downloads\lysto-mvp-operativo-v4.zip`
- Preserve: `docs/plans/2026-08-19-lysto-mvp-operativo-design.md`
- Create: `docs/audits/2026-08-19-zip-baseline.md`
- Create: `pnpm-lock.yaml`
- Modify: `.gitignore`
- Do not import: `tsconfig.tsbuildinfo`

**Step 1: Verify the worktree is clean**

Run: `git status --short --branch`

Expected: only the implementation-plan commit is present and there are no unrelated changes.

**Step 2: Extract to a temporary directory**

Use a new explicit temp directory, expand the ZIP there, and verify that the source root is `<temp>\lysto`. Do not extract over the repository before this check.

Expected: `package.json`, `app`, `lib`, `supabase`, `tests` and `components` exist.

**Step 3: Import the source tree**

Copy the contents of `<temp>\lysto` into the worktree, excluding `tsconfig.tsbuildinfo`, `node_modules`, `.next`, `.env*` except `.env.example`, and any nested `.git` directory. Preserve the approved files already under `docs/plans/`.

**Step 4: Record the audit**

Create `docs/audits/2026-08-19-zip-baseline.md` with the verified failures listed in “Línea base comprobada del ZIP”, the ZIP name and its SHA-256 hash. Do not include local credentials.

**Step 5: Install and lock dependencies**

Run: `pnpm install --frozen-lockfile=false`

Expected: installation completes and creates `pnpm-lock.yaml`.

Run: `pnpm install --frozen-lockfile`

Expected: PASS without modifying the lockfile.

**Step 6: Capture the failing baseline**

Run separately:

```powershell
pnpm test:domain
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm build
```

Expected: failures match the audit. Unexpected new failures are added to the audit before continuing.

**Step 7: Commit the import**

```powershell
git add -- . ':!tsconfig.tsbuildinfo'
git commit -m "chore: import recoverable Lysto MVP baseline"
```

---

### Task 2: Estabilizar toolchain, contratos y build

**Files:**
- Modify: `tests/domain/schema-contract.test.ts`
- Modify: `app/api/admin/assign-professional/route.ts`
- Modify: `app/api/professional/respond-request/route.ts`
- Modify: `app/api/quality/open-case/route.ts`
- Modify: `lib/forms/customer-request-form.ts`
- Modify: `lib/supabase/server.ts`
- Modify: `lib/data-access/supabase/repository.ts`
- Modify: `components/layout/marketing-header.tsx`
- Modify: `eslint.config.mjs`
- Modify: `next.config.ts`
- Create: `tests/unit/support-cases.vitest.test.ts`
- Create: `tests/unit/repository-mappers.vitest.test.ts`
- Modify: `vitest.config.ts`
- Modify: `package.json`

**Step 1: Add the Windows path regression test**

Move migration-directory resolution to a helper and test that it returns a valid Windows path:

```ts
import { fileURLToPath } from 'node:url'

export function migrationsDirectory(metaUrl: string): string {
  return fileURLToPath(new URL('../../supabase/migrations/', metaUrl))
}
```

Run: `pnpm test:domain`

Expected before fix: FAIL with the duplicated drive prefix. Replace the use of `migrationsDir.pathname` with the helper and rerun.

Expected after fix: the domain runner reaches the remaining tests without `ENOENT`.

**Step 2: Characterize the quality-case endpoint dependency**

Create a Vitest test importing `classifySupportCase` from `lib/support/cases.ts` and cover safety, payment, delay and empty description. Update `app/api/quality/open-case/route.ts` to import that real module and map the request to `SupportCaseInput`.

Run: `pnpm vitest run tests/unit/support-cases.vitest.test.ts`

Expected: PASS.

**Step 3: Align assignment and response handlers**

Update the admin route to construct `AssignmentInput` using `requestId`, `paid`, `mode`, `selectedProfessionalId`, `adminProfileId` and `candidates`. Return `errors`/`ranking` on failure and `assignedProfessionalId`/`ranking` on success.

Update the professional route to call `handleProfessionalResponse` with `professionalId`, `assignedProfessionalId`, `response: 'accept' | 'reject'` and `reason`.

Run: `pnpm typecheck`

Expected: the assignment and professional-response errors disappear.

**Step 4: Replace untyped repository rows**

Export and unit-test pure row mappers. Use generated-table-shaped interfaces temporarily rather than `any`; Task 4 will replace them with generated Supabase types.

Run: `pnpm vitest run tests/unit/repository-mappers.vitest.test.ts`

Expected: PASS for nullables, numeric amount conversion and snake_case mapping.

**Step 5: Fix remaining strict-type and lint failures**

- Type the Supabase cookie setter using the parameters expected by `@supabase/ssr`.
- Narrow schedule values through the configured slot union.
- Use `next/link` for internal navigation.
- Name the exported ESLint configuration.
- Move `typedRoutes` out of `experimental` or remove it until enabled intentionally.

Run: `pnpm typecheck && pnpm lint`

Expected: PASS with zero warnings.

**Step 6: Make unit-test discovery meaningful**

Keep the `*.vitest.test.ts(x)` convention, ensure the two new tests are found, and change `test:unit` to fail only on real failures, not because there are no tests.

Run: `pnpm test:unit`

Expected: at least the support and repository suites PASS.

**Step 7: Verify the baseline gate**

Run: `pnpm test:domain && pnpm test:unit && pnpm typecheck && pnpm lint && pnpm build`

Expected: all commands PASS.

**Step 8: Commit**

```powershell
git add tests app lib components eslint.config.mjs next.config.ts vitest.config.ts package.json pnpm-lock.yaml
git commit -m "fix: establish a verified application baseline"
```

---

### Task 3: Fijar configuración, secretos y CI reproducible

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `.gitignore`
- Modify: `lib/supabase/env.ts`
- Create: `lib/config/env.ts`
- Create: `tests/unit/env.vitest.test.ts`
- Modify: `.github/workflows/ci.yml`
- Create: `.node-version`
- Create: `docs/development/local-setup.md`

**Step 1: Write environment-validation tests**

Test three groups:

```ts
expect(parsePublicEnv({})).toFailWith('NEXT_PUBLIC_SUPABASE_URL')
expect(parseServerEnv({ ...publicOnly })).toFailWith('SUPABASE_SERVICE_ROLE_KEY')
expect(parseServerEnv(valid)).not.toExposeSecrets()
```

Run: `pnpm vitest run tests/unit/env.vitest.test.ts`

Expected: FAIL because the parsers do not exist.

**Step 2: Implement separated env schemas**

Create Zod schemas for public, server, Mercado Pago, notifications and optional AI configuration. Only parse provider-specific variables when that provider is enabled. Never prefix secrets with `NEXT_PUBLIC_`.

Run the test again.

Expected: PASS.

**Step 3: Pin the runtime and package manager**

Use Node 22 LTS in `.node-version` and an exact pnpm version in `packageManager`. Keep the verified Next.js major during baseline stabilization; dependency upgrades must be a separate PR with build and E2E evidence.

Run: `corepack pnpm --version`

Expected: the pinned pnpm version.

**Step 4: Harden `.env.example` and ignores**

Keep values blank, document feature flags such as `PAYMENTS_PROVIDER=mock`, `NOTIFICATIONS_EMAIL_ENABLED=false` and `WHATSAPP_ENABLED=false`, and ignore `.env`, `.env.local`, generated types build info, Playwright output and Supabase temp files.

**Step 5: Update CI**

CI must use the lockfile and run:

```yaml
- run: pnpm install --frozen-lockfile
- run: pnpm lint
- run: pnpm typecheck
- run: pnpm test
- run: pnpm build
```

Add a Windows job for `pnpm test:domain` so the fixed path behavior remains covered. Add Playwright only after Task 6 creates a runnable authenticated fixture.

**Step 6: Document local setup**

Explain Node/pnpm, local Supabase, `.env.local`, test commands and the rule that secrets never enter Git. Refer to the project ref only as a non-secret identifier.

**Step 7: Verify and commit**

Run: `pnpm test:ci`

Expected: PASS.

```powershell
git add package.json pnpm-lock.yaml .env.example .gitignore .node-version lib/config lib/supabase/env.ts tests/unit .github/workflows/ci.yml docs/development/local-setup.md
git commit -m "chore: make local and CI environments reproducible"
```

---

### Task 4: Auditar y endurecer el esquema Supabase

**Files:**
- Review: `supabase/migrations/202608190001_initial_schema.sql`
- Review: `supabase/migrations/202608190002_operational_extensions.sql`
- Review: `supabase/migrations/202608190003_operational_functions.sql`
- Review: `supabase/migrations/202608190004_transactional_workflows.sql`
- Create: `supabase/migrations/202608190005_security_and_roles.sql`
- Create: `supabase/migrations/202608190006_storage_buckets.sql`
- Create: `supabase/migrations/202608190007_outbox_and_idempotency.sql`
- Create: `supabase/tests/database/schema.test.sql`
- Create: `supabase/tests/database/rls_customer.test.sql`
- Create: `supabase/tests/database/rls_professional.test.sql`
- Create: `supabase/tests/database/rls_admin.test.sql`
- Create: `supabase/tests/database/storage.test.sql`
- Create: `lib/supabase/database.types.ts`
- Modify: `supabase/seed.sql`

**Step 1: Start local Supabase and prove the schema resets**

Run: `pnpm exec supabase start`

Run: `pnpm exec supabase db reset`

Expected: all existing migrations and seed apply from an empty database. If an existing migration fails, fix only what prevents first application because the remote project is still greenfield; record the change in the migration header.

**Step 2: Write schema invariant tests**

Use pgTAP to assert primary/foreign keys, unique provider event IDs, nonnegative monetary amounts, required timestamps, allowed state relationships and all exposed tables having RLS enabled.

Run: `pnpm exec supabase test db`

Expected: FAIL until the security migrations are present.

**Step 3: Separate role from editable profile data**

Add helpers that read the trusted role from `auth.jwt()->'app_metadata'`, map admin permissions from controlled tables and prevent users from promoting themselves. Do not trust `user_metadata` for authorization.

Create admin permission values: `operations`, `finance`, `quality`, `owner`.

**Step 4: Harden data policies**

Add positive and negative tests proving:

- Customer A cannot read Customer B, their address, request, media metadata, job, payment or equipment.
- A professional cannot read unassigned jobs or full customer addresses before assignment.
- An assigned professional can read only the fields needed for the work.
- A professional cannot approve their own profile, change prices or alter financial rows.
- Operations admin cannot read provider secrets or execute owner-only settings.
- Finance can operate refunds but cannot approve professionals unless separately permitted.

Implement least-privilege RLS until every test passes.

**Step 5: Create private Storage buckets and policies**

Create `request-media`, `professional-documents`, `equipment-media` and `job-evidence` as private buckets; create `public-avatars` explicitly as public. Policies must validate the first folder segment against the authenticated owner or assigned entity. Remove broad “authenticated upload” policies.

Do not expose `storage.objects` rows across customers. Model object keys as immutable; replacement requires explicit select/update authorization.

**Step 6: Fix public receipts**

Remove any policy that lets anonymous users select every non-revoked receipt. Provide a narrowly scoped server function in a private schema or a server-only query that accepts the full high-entropy token and returns a minimal projection. Add tests for valid, invalid, expired and revoked tokens.

**Step 7: Add inbox/outbox and idempotency records**

Create durable records for external events, processed-at timestamp, attempt count, last error and unique provider/event key. Create an outbox for notifications and asynchronous side effects committed in the same transaction as the domain change.

**Step 8: Seed the pilot**

Seed air-conditioning issues/questions, initial tools, CABA and southern zones including Berazategui and Hudson, default slots, Flexible/Prioridad configuration and nonbinding sample prices clearly marked for staging.

**Step 9: Generate types**

Run: `pnpm exec supabase gen types typescript --local > lib/supabase/database.types.ts`

Replace temporary repository types with generated `Database` types.

**Step 10: Run database and application gates**

Run:

```powershell
pnpm exec supabase db reset
pnpm exec supabase test db
pnpm typecheck
pnpm test
```

Expected: PASS.

**Step 11: Commit**

```powershell
git add supabase lib/supabase/database.types.ts lib/data-access tests
git commit -m "feat: secure the Supabase data foundation"
```

---

### Task 5: Implementar autenticación, perfiles y protección por rol

**Files:**
- Modify: `middleware.ts`
- Modify: `lib/supabase/client.ts`
- Modify: `lib/supabase/server.ts`
- Create: `lib/auth/session.ts`
- Create: `lib/auth/guards.ts`
- Create: `lib/auth/actions.ts`
- Create: `tests/unit/auth-guards.vitest.test.ts`
- Modify: `app/(auth)/login/page.tsx`
- Modify: `app/(auth)/registro/page.tsx`
- Create: `app/(auth)/recuperar-clave/page.tsx`
- Create: `app/auth/callback/route.ts`
- Create: `app/auth/signout/route.ts`
- Modify: `app/(customer)/app/layout.tsx`
- Modify: `app/(professional)/pro/layout.tsx`
- Modify: `app/(admin)/admin/layout.tsx`

**Step 1: Test role redirects and denials**

Cover anonymous access, customer opening `/pro`, professional opening `/admin`, suspended professional and admin subpermission checks.

Run: `pnpm vitest run tests/unit/auth-guards.vitest.test.ts`

Expected: FAIL before guards exist.

**Step 2: Implement session and guard services**

Return typed outcomes rather than booleans:

```ts
type AccessDecision =
  | { allowed: true; profileId: string; role: AppRole; permissions: AdminPermission[] }
  | { allowed: false; reason: 'anonymous' | 'wrong_role' | 'inactive'; redirectTo: string }
```

Read identity from the Supabase session and authorization from trusted claims/database state.

**Step 3: Implement customer registration**

Validate name, surname, email, phone, password and terms version with Zod. Create Auth user; create profile/customer record through a safe trigger or transactional server operation. Make retries idempotent by auth user ID.

**Step 4: Implement login, callback, recovery and sign-out**

Use Supabase SSR cookies. Redirect by role and status. Never reveal whether an email exists during recovery.

**Step 5: Protect layouts and middleware**

Middleware only refreshes sessions and performs coarse routing. Server layouts enforce the authoritative role/status check.

**Step 6: Add integration and E2E smoke tests**

Create test users through a server-only fixture. Verify customer login, redirect, logout and denial across roles.

Run: `pnpm test && pnpm test:e2e --grep "auth"`

Expected: PASS.

**Step 7: Commit**

```powershell
git add middleware.ts lib/auth lib/supabase app tests
git commit -m "feat: add Supabase authentication and role boundaries"
```

---

### Task 6: Consolidar el sistema visual y los shells accesibles

**Files:**
- Modify: `app/globals.css`
- Modify: `tailwind.config.ts`
- Modify: `app/layout.tsx`
- Modify: `components/ui/button.tsx`
- Modify: `components/ui/input.tsx`
- Modify: `components/ui/card.tsx`
- Create: `components/ui/field-error.tsx`
- Create: `components/ui/async-state.tsx`
- Create: `components/ui/dialog.tsx`
- Create: `components/layout/customer-shell.tsx`
- Create: `components/layout/professional-shell.tsx`
- Create: `components/layout/admin-shell.tsx`
- Modify: the three protected layouts
- Create: `tests/unit/ui-accessibility.vitest.test.tsx`
- Modify: `app/(public)/page.tsx`
- Modify: `app/(public)/servicios/aire-acondicionado/page.tsx`
- Modify: `app/(public)/como-funciona/page.tsx`
- Modify: `app/(public)/ayuda/page.tsx`

**Step 1: Write accessibility tests**

Assert associated labels, visible focus, disabled/loading semantics, error announcements and keyboard-operable dialogs.

Run: `pnpm vitest run tests/unit/ui-accessibility.vitest.test.tsx`

Expected: FAIL for missing primitives.

**Step 2: Define tokens**

Create CSS variables for Lysto blue, ink, neutral surfaces, success, warning and danger; define radius, shadow, spacing and typography. Respect reduced motion and minimum touch size.

**Step 3: Implement primitives and async states**

Add standardized loading, empty, error, retry and offline messages. Buttons must prevent duplicate submission while pending.

**Step 4: Build responsive shells**

Mobile uses compact navigation; desktop uses side navigation and content width appropriate to each role. Admin tables gain card/list fallbacks on narrow screens.

**Step 5: Refine public pages**

Match the approved direction: confidence, verified professionals, protected payment, guarantee and one clear “Solicitar servicio” action. Keep claims factual and configurable.

**Step 6: Add Playwright visual-flow smoke tests**

Test 390×844 and 1440×900 viewports, navigation, focus order and absence of horizontal overflow.

Run: `pnpm test:unit && pnpm test:e2e --grep "public|shell"`

Expected: PASS.

**Step 7: Commit**

```powershell
git add app components tailwind.config.ts tests
git commit -m "feat: establish the Lysto responsive design system"
```

---

### Task 7: Implementar direcciones y borrador persistente de solicitud

**Files:**
- Create: `lib/customer/address-schema.ts`
- Create: `lib/service-request/draft-schema.ts`
- Create: `lib/service-request/service.ts`
- Create: `tests/unit/request-draft.vitest.test.ts`
- Create: `tests/integration/customer-request.vitest.test.ts`
- Modify: `lib/data-access/contracts.ts`
- Modify: `lib/data-access/supabase/service-request-writes.ts`
- Modify: `app/(customer)/app/direcciones/page.tsx`
- Modify: `app/(customer)/app/solicitar/aire-acondicionado/page.tsx`
- Modify: `features/service-request/air-conditioning-wizard.tsx`
- Create: `app/api/customer/addresses/route.ts`
- Modify: `app/api/customer/request/submit/route.ts`

**Step 1: Write address and draft tests**

Cover required fields, CABA/province normalization, access details, ownership and resuming a partial request.

Expected: FAIL before service implementation.

**Step 2: Implement schemas and repository contracts**

Use explicit commands such as `saveAddress`, `createDraft`, `saveDraftStep` and `getOwnDraft`. The server derives customer ID from the session; it never accepts it as trusted request input.

**Step 3: Persist every wizard step**

Debounce noncritical text changes; persist immediately on step completion. Display “Guardado” and retry states. Prevent skipping required completed steps on the server.

**Step 4: Replace mock address and request data**

Pages read only the signed-in customer’s records. Add empty and error states.

**Step 5: Integration test RLS and retry**

Attempt to read/update the draft as another customer and expect denial. Repeat the same save command and expect one logical result.

Run: `pnpm vitest run tests/unit/request-draft.vitest.test.ts tests/integration/customer-request.vitest.test.ts`

Expected: PASS.

**Step 6: Commit**

```powershell
git add lib app features tests
git commit -m "feat: persist customer addresses and request drafts"
```

---

### Task 8: Conectar preguntas, diagnóstico y archivos privados

**Files:**
- Modify: `lib/diagnosis/rules.ts`
- Create: `lib/diagnosis/service.ts`
- Create: `lib/uploads/object-key.ts`
- Modify: `lib/uploads/validation.ts`
- Modify: `app/api/uploads/sign/route.ts`
- Modify: `app/api/diagnosis/generate/route.ts`
- Modify: `features/service-request/air-conditioning-wizard.tsx`
- Create: `components/uploads/media-uploader.tsx`
- Create: `tests/unit/diagnosis-service.vitest.test.ts`
- Create: `tests/unit/upload-validation.vitest.test.ts`
- Create: `tests/integration/storage-access.vitest.test.ts`

**Step 1: Test deterministic diagnosis**

Given issue, answers and rules version, assert ordered causes, internal checklist, cautious customer summary and absence of unsupported certainty.

**Step 2: Implement the rules engine service**

Store the structured result and rules version. Optional AI may rewrite the summary only; validate its output and fall back to deterministic copy.

**Step 3: Test file acceptance and object keys**

Cover allowed JPG/PNG and MP4/MOV, photo/video limits, random immutable object name, path ownership and rejected masqueraded file types.

**Step 4: Implement signed upload flow**

The server validates session, draft ownership, requested bucket and declared metadata before issuing a short-lived signed upload URL. After upload, create metadata only after verifying the object exists and matches limits.

**Step 5: Build uploader recovery states**

Each file has progress, success, failure, retry and remove. A failed video must not erase successful photos.

**Step 6: Verify cross-user denial**

Customer B and an unassigned professional cannot sign or read Customer A’s media. Assigned professional access becomes available only after assignment.

Run: `pnpm test:unit && pnpm vitest run tests/integration/storage-access.vitest.test.ts`

Expected: PASS.

**Step 7: Commit**

```powershell
git add lib/diagnosis lib/uploads app/api components/uploads features tests
git commit -m "feat: add structured diagnosis and private request media"
```

---

### Task 9: Implementar agenda, zonas y presupuesto preliminar

**Files:**
- Modify: `lib/scheduling/service-slot.ts`
- Modify: `lib/scheduling/availability.ts`
- Modify: `lib/pricing/calculate-price.ts`
- Create: `lib/pricing/service.ts`
- Create: `tests/unit/pricing-service.vitest.test.ts`
- Create: `tests/unit/scheduling-zones.vitest.test.ts`
- Modify: `app/api/service-request/preview/route.ts`
- Modify: `features/service-request/air-conditioning-wizard.tsx`
- Modify: `app/(admin)/admin/precios/page.tsx`
- Modify: `app/(admin)/admin/zonas/page.tsx`

**Step 1: Test pricing invariants**

Assert integer minor-unit calculations, no floating-point money, effective-date selection, zone/access adjustments, Priority greater than or equal to Flexible and same verification benefits in both.

**Step 2: Test pilot coverage and slots**

Cover CABA, Berazategui, Hudson, unsupported locality, closed day, full slot and timezone `America/Buenos_Aires`.

**Step 3: Implement server-side quote creation**

The server loads active rules, calculates both options, stores inputs, outputs and rules version, then returns display values. The client cannot submit an arbitrary total.

**Step 4: Implement admin configuration**

Changes require finance/owner permission, effective dates and audit log. Existing quotes remain reproducible from their snapshot.

**Step 5: Complete the wizard screens**

Show availability honestly, explain Flexible/Prioridad and clarify that the initial payment covers visit/diagnosis while final repair price is confirmed onsite.

Run: `pnpm test && pnpm test:e2e --grep "pricing|schedule"`

Expected: PASS.

**Step 6: Commit**

```powershell
git add lib/pricing lib/scheduling app features tests
git commit -m "feat: calculate zoned schedules and preliminary quotes"
```

---

### Task 10: Crear el contrato de pagos y el flujo de pago simulado

**Files:**
- Create: `lib/payments/provider.ts`
- Create: `lib/payments/mock-provider.ts`
- Modify: `lib/payments/idempotency.ts`
- Modify: `lib/use-cases/payment-flow.ts`
- Create: `tests/unit/payment-provider.vitest.test.ts`
- Create: `tests/integration/payment-webhook.vitest.test.ts`
- Modify: `app/api/mercadopago/create-preference/route.ts`
- Modify: `app/api/payments/webhook/apply/route.ts`
- Modify: `app/(customer)/app/pagos/page.tsx`

**Step 1: Define and test the provider contract**

```ts
export interface PaymentProvider {
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>
  parseWebhook(request: Request): Promise<VerifiedPaymentEvent>
  refund(input: RefundInput): Promise<RefundResult>
}
```

Test unique request reference, amount snapshot, safe redirect URLs and rejected unsigned webhook.

**Step 2: Implement the mock provider**

Allow deterministic approval/rejection only outside production. It must emit the same normalized events as Mercado Pago will later emit.

**Step 3: Apply webhook transactionally**

Insert the inbox event, reject duplicates, update payment, transition request to `payment_approved`, create or activate matching work and enqueue notifications in one database transaction.

**Step 4: Implement recovery views**

Show pending, approved, rejected and retry-safe states. Refreshing a return URL must not create a new payment.

Run: `pnpm vitest run tests/unit/payment-provider.vitest.test.ts tests/integration/payment-webhook.vitest.test.ts`

Expected: PASS.

**Step 5: Commit**

```powershell
git add lib/payments lib/use-cases app tests
git commit -m "feat: establish an idempotent payment boundary"
```

---

### Task 11: Conectar matching y asignación administrativa

**Files:**
- Modify: `lib/matching/score-professionals.ts`
- Modify: `lib/admin/assignment.ts`
- Create: `lib/matching/service.ts`
- Create: `tests/unit/matching-explanations.vitest.test.ts`
- Create: `tests/integration/assignment.vitest.test.ts`
- Modify: `app/api/admin/assign-professional/route.ts`
- Modify: `app/(admin)/admin/matching/page.tsx`
- Modify: `app/(admin)/admin/solicitudes/[id]/page.tsx`
- Modify: `app/(customer)/app/solicitudes/[id]/page.tsx`

**Step 1: Test cold-start and exclusions**

New approved professionals receive a neutral prior; suspended, unavailable, wrong-zone, missing-license or missing-required-tool candidates are excluded with explicit reasons.

**Step 2: Persist ranking runs**

Store candidate input snapshot, score components, exclusions, selected candidate, actor and timestamp. Ranking itself does not assign.

**Step 3: Implement admin confirmation**

Require operations permission and approved payment. Use the transactional DB function to create/update job, assignment and audit event. A duplicate confirmation returns the existing assignment.

**Step 4: Implement rejection/reassignment loop**

Professional rejection records reason and sends the request back to matching without losing payment or request evidence.

**Step 5: Replace mock matching screens**

Admin sees candidates and explanations. Customer sees a calm progress state without exposing internal scores or false timing.

Run: `pnpm test && pnpm test:e2e --grep "matching"`

Expected: PASS.

**Step 6: Commit**

```powershell
git add lib/matching lib/admin app tests
git commit -m "feat: rank and assign verified professionals"
```

---

### Task 12: Implementar invitación, onboarding y aprobación profesional

**Files:**
- Modify: `lib/admin/invitations.ts`
- Modify: `lib/professional/onboarding.ts`
- Modify: `lib/professional/tool-checklist.ts`
- Create: `lib/professional/onboarding-service.ts`
- Create: `tests/unit/professional-onboarding.vitest.test.ts`
- Create: `tests/integration/professional-approval.vitest.test.ts`
- Modify: `app/api/admin/invite-professional/route.ts`
- Modify: `app/api/professional/onboarding/route.ts`
- Modify: `app/api/pro/onboarding/evaluate/route.ts`
- Modify: `app/(professional)/pro/onboarding/[token]/page.tsx`
- Modify: `app/(admin)/admin/profesionales/invitaciones/page.tsx`
- Modify: `app/(admin)/admin/profesionales/[id]/page.tsx`
- Modify: `app/(professional)/pro/perfil/page.tsx`

**Step 1: Test invitation security**

Tokens are random, hashed at rest, one-use, expiring and bound to email. Public registration cannot create a professional role.

**Step 2: Test onboarding completeness**

Cover identity, CUIL/DNI shape, birth date, license, zones, tools, mobility, availability, documents and terms. Submission transitions only from allowed states.

**Step 3: Implement invite and onboarding services**

The public token lookup returns minimal data. Documents use `professional-documents`; the professional can read their own documents, while only authorized admins can review them.

**Step 4: Implement manual approval**

Admin records checklist, decision and reason. Approval updates trusted role/status in a server-controlled operation and emits audit/notification events. Rejection and suspension preserve history.

**Step 5: Replace placeholder forms**

Use typed selects and checklists rather than free text for zones, tools and availability. Display resumable progress and document upload status.

Run: `pnpm test && pnpm test:e2e --grep "professional onboarding"`

Expected: PASS.

**Step 6: Commit**

```powershell
git add lib/professional lib/admin app tests
git commit -m "feat: onboard and approve invited professionals"
```

---

### Task 13: Implementar ciclo del trabajo, ETA y presupuesto final

**Files:**
- Modify: `lib/domain/state-machine.ts`
- Modify: `lib/jobs/workflow.ts`
- Create: `lib/jobs/final-quote.ts`
- Create: `lib/jobs/tracking.ts`
- Create: `tests/unit/job-transitions.vitest.test.ts`
- Create: `tests/integration/job-lifecycle.vitest.test.ts`
- Modify: `app/api/jobs/advance/route.ts`
- Modify: `app/api/jobs/update-status/route.ts`
- Modify: `app/api/pro/jobs/action/route.ts`
- Create: `app/api/jobs/final-quote/route.ts`
- Modify: `app/(professional)/pro/trabajos/[id]/page.tsx`
- Modify: `app/(customer)/app/trabajos/[id]/page.tsx`
- Modify: `components/status/job-tracker.tsx`

**Step 1: Test every allowed and forbidden transition**

Test actor role, current state, required data and idempotent repeat for accepted, on-way, arrived, diagnosis, quote pending, quote approved/rejected, work, pending completion, completed, spare, second visit, unresolved and cancellation.

**Step 2: Implement one transition service**

All endpoints call one service that validates actor and state, invokes a transaction, adds timeline/audit/outbox events and returns the updated aggregate.

**Step 3: Implement ETA without false GPS claims**

Store departure time, optional consented approximate location, manual/calculated ETA and last update. The UI labels estimates as estimates and falls back to the booked window.

**Step 4: Implement final quote**

Use line items and minor-unit totals. The customer must explicitly approve; the professional cannot mark `in_progress` for additional repair before approval.

**Step 5: Replace professional and customer mock views**

Render only actions valid for the current actor/state. Disable duplicate submission and show recoverable errors.

Run: `pnpm test && pnpm test:e2e --grep "job lifecycle"`

Expected: PASS.

**Step 6: Commit**

```powershell
git add lib/domain lib/jobs app components/status tests
git commit -m "feat: operate the complete service lifecycle"
```

---

### Task 14: Implementar equipos, cierre, historial y comprobante

**Files:**
- Modify: `lib/equipment/equipment-registry.ts`
- Modify: `lib/equipment/service-record.ts`
- Modify: `lib/jobs/final-report.ts`
- Modify: `lib/qr/public-receipt.ts`
- Create: `lib/qr/receipt-service.ts`
- Create: `tests/unit/final-report.vitest.test.ts`
- Create: `tests/integration/equipment-history.vitest.test.ts`
- Create: `tests/integration/public-receipt.vitest.test.ts`
- Modify: `app/api/equipment/register/route.ts`
- Modify: `app/api/jobs/final-report/route.ts`
- Modify: `app/comprobante/[token]/page.tsx`
- Modify: `app/(customer)/app/equipos/page.tsx`
- Modify: `app/(customer)/app/equipos/[id]/page.tsx`
- Modify: `app/(professional)/pro/equipos/[id]/page.tsx`

**Step 1: Test equipment ownership and history**

An assigned professional may create/update equipment for that job; other professionals cannot. Service records are append-only and ordered.

**Step 2: Test structured closeout**

Require real diagnosis, work, result, evidence rules and maintenance option. Validate pending-part/second-visit branches.

**Step 3: Implement atomic closeout**

In one transaction create final report, equipment service record, maintenance recommendation, receipt token record, job event and notifications.

**Step 4: Implement minimal public receipt**

Resolve token server-side, return 404 for invalid/revoked/expired, prevent indexing and avoid surname, address, phone, email, DNI/CUIL and financial internals.

**Step 5: Replace equipment/history mocks**

Customer sees their equipment and service history; professional sees assigned context; admin sees audited operational detail.

Run: `pnpm test && pnpm test:e2e --grep "equipment|receipt|closeout"`

Expected: PASS.

**Step 6: Commit**

```powershell
git add lib/equipment lib/jobs lib/qr app tests
git commit -m "feat: record equipment history and secure receipts"
```

---

### Task 15: Implementar review, garantía, reclamos y mantenimiento

**Files:**
- Modify: `lib/reviews/review.ts`
- Modify: `lib/reviews/recalculate-rating.ts`
- Modify: `lib/warranty/claims.ts`
- Modify: `lib/support/cases.ts`
- Modify: `lib/equipment/maintenance.ts`
- Create: `tests/unit/quality-workflows.vitest.test.ts`
- Create: `tests/integration/review-claim.vitest.test.ts`
- Modify: `app/api/reviews/submit/route.ts`
- Modify: `app/api/warranty/claim/route.ts`
- Modify: `app/api/quality/open-case/route.ts`
- Modify: `app/api/maintenance/schedule/route.ts`
- Modify: `app/(customer)/app/trabajos/[id]/review/page.tsx`
- Modify: `app/(customer)/app/garantias/page.tsx`
- Modify: `app/(customer)/app/mantenimientos/page.tsx`
- Modify: `app/(admin)/admin/calidad/page.tsx`
- Modify: `app/(admin)/admin/reclamos/page.tsx`
- Modify: `app/(admin)/admin/garantias/page.tsx`

**Step 1: Test one-review and eligibility rules**

Only the job customer can review a completed job; retries return the existing review. Recalculate rating without allowing self-edit by the professional.

**Step 2: Test claim severity and SLA**

Safety and payment cases escalate; warranty eligibility uses the frozen warranty snapshot from closeout, not current configuration.

**Step 3: Implement transactional workflows**

Submit review, open claim/reopen work and schedule maintenance through services that add audit and notification events.

**Step 4: Replace quality mocks**

Customer sees status and next action. Admin sees SLA, owner, timeline and controlled resolutions.

Run: `pnpm test && pnpm test:e2e --grep "review|claim|maintenance"`

Expected: PASS.

**Step 5: Commit**

```powershell
git add lib/reviews lib/warranty lib/support lib/equipment app tests
git commit -m "feat: close the quality and maintenance loop"
```

---

### Task 16: Conectar paneles operativos y eliminar mocks críticos

**Files:**
- Modify: all pages under `app/(customer)/app`
- Modify: all pages under `app/(professional)/pro`
- Modify: all pages under `app/(admin)/admin`
- Create: `lib/queries/customer-dashboard.ts`
- Create: `lib/queries/professional-dashboard.ts`
- Create: `lib/queries/admin-dashboard.ts`
- Create: `lib/queries/pagination.ts`
- Create: `tests/integration/dashboard-queries.vitest.test.ts`
- Create: `tests/domain/no-critical-mocks.test.ts`
- Restrict: `lib/mock/lysto-data.ts`

**Step 1: Add a critical-mock gate**

Fail if protected production pages or route handlers import `lib/mock/lysto-data.ts`. Allow mocks only in Storybook/test fixtures if added later.

Run: `pnpm test:domain`

Expected: FAIL and list every remaining production import.

**Step 2: Build paginated server queries**

Use role-scoped Supabase clients, explicit selected columns and stable cursor pagination. Add indexes only after explaining the query they support and verifying with `EXPLAIN (ANALYZE, BUFFERS)` on representative staging data.

**Step 3: Replace customer mocks**

Connect dashboard, requests, jobs, payments, guarantees, equipment, maintenance and profile with loading/empty/error states.

**Step 4: Replace professional mocks**

Connect dashboard, requests, work, agenda, payments, equipment, profile and support. Avoid exposing unassigned full addresses.

**Step 5: Replace admin mocks**

Connect dashboards and CRUD/operations for clients, professionals, requests, work, payments, prices, zones, diagnosis, quality, notifications, marketplace, audit and reports with subpermission checks.

**Step 6: Prove the gate**

Run: `rg -n "lib/mock/lysto-data" app lib --glob '!lib/mock/**'`

Expected: no production imports.

Run: `pnpm test:ci`

Expected: PASS.

**Step 7: Commit**

```powershell
git add app lib/queries tests
git commit -m "feat: connect all operational dashboards to Supabase"
```

---

### Task 17: Implementar notificaciones y auditoría confiables

**Files:**
- Modify: `lib/notifications/events.ts`
- Modify: `lib/notifications/templates.ts`
- Create: `lib/notifications/dispatcher.ts`
- Create: `lib/notifications/providers/console.ts`
- Create: `lib/notifications/providers/email.ts`
- Create: `lib/notifications/providers/whatsapp.ts`
- Create: `lib/audit/service.ts`
- Create: `tests/unit/notification-templates.vitest.test.ts`
- Create: `tests/integration/outbox-dispatch.vitest.test.ts`
- Modify: `app/api/notifications/emit/route.ts`
- Create: `app/api/internal/process-outbox/route.ts`
- Modify: `app/(admin)/admin/notificaciones/page.tsx`
- Modify: `app/(admin)/admin/auditoria/page.tsx`

**Step 1: Test safe templates**

Templates receive typed event payloads, avoid DNI/CUIL/payment secrets, include support context and render deterministic Spanish copy.

**Step 2: Test outbox retries**

Cover success, retry with backoff, permanent failure, duplicate dispatch, disabled provider and concurrent worker claim.

**Step 3: Implement provider adapters**

Console is local only. Email and WhatsApp stay disabled until their credentials and approved templates exist. Provider errors never roll back the already-committed domain action.

**Step 4: Protect the worker**

The internal endpoint requires a rotating server secret or Railway private invocation and claims rows atomically. It logs structured IDs, not full personal payloads.

**Step 5: Complete audit views**

Filter by actor/action/entity/date; redact secrets; disallow editing/deleting audit records through the app.

Run: `pnpm test && pnpm test:e2e --grep "notification|audit"`

Expected: PASS.

**Step 6: Commit**

```powershell
git add lib/notifications lib/audit app tests
git commit -m "feat: deliver retryable notifications and immutable audit trails"
```

---

### Task 18: Integrar Mercado Pago Split, OAuth y reembolsos

**Prerequisite:** políticas comerciales, credenciales sandbox y cuentas de prueba autorizadas. No usar credenciales reales en fixtures.

**Files:**
- Create: `lib/payments/mercadopago/client.ts`
- Create: `lib/payments/mercadopago/provider.ts`
- Create: `lib/payments/mercadopago/oauth.ts`
- Create: `lib/payments/mercadopago/signature.ts`
- Create: `lib/payments/mercadopago/reconciliation.ts`
- Create: `tests/unit/mercadopago-signature.vitest.test.ts`
- Create: `tests/integration/mercadopago-sandbox.vitest.test.ts`
- Modify: `app/api/mercadopago/create-preference/route.ts`
- Modify: `app/api/mercadopago/webhook/route.ts`
- Modify: `app/api/mercadopago/oauth/callback/route.ts`
- Create: `app/api/mercadopago/oauth/connect/route.ts`
- Create: `app/api/admin/payments/[id]/refund/route.ts`
- Modify: `app/(professional)/pro/mercadopago/page.tsx`
- Modify: `app/(admin)/admin/marketplace/page.tsx`
- Modify: `app/(admin)/admin/pagos/page.tsx`
- Modify: `docs/10-payments-mercadopago.md`

**Step 1: Confirm current official API contract**

Before coding, verify OAuth scopes, PKCE/state behavior, split field (`marketplace_fee` or `application_fee` for the chosen checkout), webhook signature format, refund behavior and sandbox limitations against official Mercado Pago documentation. Record the chosen flow and date in `docs/10-payments-mercadopago.md`.

**Step 2: Test OAuth security**

State is random, one-use, expiring and tied to the professional. Store provider tokens encrypted or in an approved secrets mechanism, never exposed to browser/client logs.

**Step 3: Test webhook verification and normalization**

Use captured synthetic fixtures without secrets. Invalid signature is 401; unknown event is acknowledged safely; duplicate event produces no duplicate effects.

**Step 4: Implement checkout with split**

Create the visit/diagnostic checkout from the stored quote snapshot, internal request reference and linked seller account. Persist gross, Lysto fee, professional amount and provider IDs separately.

**Step 5: Implement sandbox OAuth and payment test**

Connect a test professional, approve a test payment, receive webhook and reconcile provider state. Never trust the browser return as payment approval.

**Step 6: Implement controlled refund**

Finance/owner permission only. Create a local refund intent and idempotency key, call Mercado Pago, update from webhook/query, display proportional split effects and flag insufficient seller balance for manual handling.

**Step 7: Implement reconciliation**

Compare local payments/events/distributions against provider status. Differences create an alert; automated reconciliation does not silently rewrite audit history.

**Step 8: Run sandbox gate**

Run: `pnpm vitest run tests/unit/mercadopago-signature.vitest.test.ts`

Run integration only when `MERCADOPAGO_SANDBOX_TESTS=true`:

`pnpm vitest run tests/integration/mercadopago-sandbox.vitest.test.ts`

Expected: PASS with approved sandbox accounts.

**Step 9: Commit**

```powershell
git add lib/payments app/api/mercadopago app/api/admin/payments app/'(professional)'/pro/mercadopago app/'(admin)'/admin docs/10-payments-mercadopago.md tests
git commit -m "feat: integrate Mercado Pago marketplace payments"
```

---

### Task 19: Completar E2E, seguridad, observabilidad y recuperación

**Files:**
- Modify: `playwright.config.ts`
- Modify: `tests/e2e/customer-flow.spec.ts`
- Create: `tests/e2e/professional-flow.spec.ts`
- Create: `tests/e2e/admin-flow.spec.ts`
- Create: `tests/e2e/failure-recovery.spec.ts`
- Create: `tests/e2e/payment-flow.spec.ts`
- Create: `tests/e2e/accessibility.spec.ts`
- Create: `lib/observability/logger.ts`
- Create: `lib/observability/request-context.ts`
- Create: `app/api/health/route.ts`
- Create: `docs/operations/incident-runbook.md`
- Create: `docs/operations/backup-restore.md`
- Create: `docs/operations/privacy-retention.md`
- Modify: `tests/qa/manual-release-checklist.md`
- Modify: `.github/workflows/ci.yml`

**Step 1: Create deterministic fixtures**

Seed one customer, two professionals, one operations admin, one finance admin and catalog data in an isolated test environment. Never reuse production IDs or credentials.

**Step 2: Automate the happy path**

Customer registers, drafts request, uploads media, chooses slot/quote, pays; admin assigns; professional accepts, advances, quotes and closes; customer approves and reviews; receipt and equipment history appear.

**Step 3: Automate failure paths**

Cover rejected payment, duplicated webhook, professional rejection, no candidates, final quote rejection, pending part, notification retry, cancellation, refund and invalid receipt token.

**Step 4: Add automated accessibility checks**

Run critical pages at mobile and desktop sizes. Fail on serious/critical violations, missing labels, focus traps and horizontal overflow.

**Step 5: Add structured observability**

Every request has correlation ID. Log domain event names, entity IDs and error codes without secrets or unnecessary PII. Health endpoint checks application process only; deeper dependency checks are protected.

**Step 6: Write and perform backup/restore drill**

Document Supabase database backup and a separate copy of critical Storage objects. Restore into a nonproduction environment and verify row counts, object integrity and signed-access policies.

**Step 7: Write incident and retention runbooks**

Cover payment mismatch, leaked credential, unavailable provider, failed deployment, data-access incident, professional safety issue, refund and customer deletion/export request.

**Step 8: Enable full CI**

Run lint, typecheck, unit/domain/integration, build and Playwright against an ephemeral or dedicated CI Supabase environment. Upload artifacts without secrets.

Run: `pnpm test:ci && pnpm test:e2e`

Expected: PASS.

**Step 9: Commit**

```powershell
git add tests lib/observability app/api/health docs/operations .github/workflows/ci.yml playwright.config.ts
git commit -m "test: prove critical flows and recovery controls"
```

---

### Task 20: Publicar staging en Railway y ejecutar la puerta comercial

**Files:**
- Create: `railway.json` or `railway.toml` according to the verified Railway configuration at execution time
- Create: `docs/deployment/railway.md`
- Create: `docs/release/commercial-launch-checklist.md`
- Modify: `README.md`
- Modify: `checks/IMPLEMENTATION_STATUS.md`
- Modify: `checks/HONEST_SYSTEM_STATUS.md`

**Step 1: Create separate staging resources**

Link Railway staging to a staging branch/environment and a nonproduction Supabase project/branch. Set secrets in the platform UI, never in `railway.*`.

**Step 2: Configure stateless deployment**

Build with the locked package manager, start Next.js on Railway’s provided port, configure health check and at least one worker/cron invocation for the outbox if required. Do not attach a filesystem volume for uploads.

**Step 3: Apply migrations to staging**

Run migration dry-run/diff, review output, apply to staging, regenerate types if needed and run RLS/integration tests against staging.

**Step 4: Configure sandbox providers**

Set Supabase, Mercado Pago sandbox, email test provider and disabled WhatsApp unless approved. Verify webhook URLs and signatures from the public Railway staging domain.

**Step 5: Run the manual release checklist**

Test representative iOS Safari, Android Chrome and desktop browsers; slow network; file limits; payment recovery; admin overrides; receipt privacy; audit; backup/restore evidence.

**Step 6: Complete legal/fiscal gate**

Obtain documented approval for Argentine tax treatment, invoicing, consumer terms, privacy, cancellation/refund, professional relationship and guarantee language. Technical completion does not replace this approval.

**Step 7: Update status honestly**

Mark each capability as simulated, staging-validated or production-validated. Do not retain inherited “tests passing” claims that are not reproduced by CI.

**Step 8: Verify release candidate**

Run:

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Expected: PASS, plus completed manual, security, backup, payment and legal gates.

**Step 9: Commit**

```powershell
git add railway.json railway.toml docs README.md checks
git commit -m "docs: prepare the Lysto staging release"
```

Only after staging acceptance should a separate production-release plan apply the verified configuration to production.

---

## Hitos de control

1. **Base confiable:** Tasks 1–3; todos los gates locales verdes.
2. **Datos seguros:** Task 4; reset, pgTAP y RLS verdes.
3. **Primer recorrido de cliente:** Tasks 5–10; solicitud y pago simulado persistentes.
4. **Operación gestionada:** Tasks 11–17; matching, profesional, trabajo, calidad y admin sin mocks críticos.
5. **Pago comercial:** Task 18; OAuth, split, webhooks, reembolsos y conciliación validados.
6. **Release candidate:** Tasks 19–20; E2E, seguridad, recuperación y staging aprobados.

No comenzar el siguiente hito con gates rojos del anterior. Se puede diseñar o documentar trabajo posterior, pero no integrar sobre una base fallida.

