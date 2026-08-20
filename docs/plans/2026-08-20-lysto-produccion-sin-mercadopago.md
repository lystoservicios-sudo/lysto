# Lysto Production Completion Without Mercado Pago Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Llevar al 100% todos los componentes técnicos, funcionales, operativos y legales de Lysto excepto la integración final de Mercado Pago y split.

**Architecture:** Mantener el monolito modular Next.js y usar Supabase como fuente de verdad para Auth, PostgreSQL y Storage. Las pantallas llaman servicios de aplicación del servidor; estos validan sesión, rol y estado, y luego ejecutan operaciones transaccionales o RPC. Los proveedores externos se conectan mediante interfaces, dejando `PaymentProvider` preparado para recibir al final la implementación reutilizada de otro proyecto.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase Auth/PostgreSQL/Storage/RLS, Zod, Vitest, Playwright, pgTAP, Railway y GitHub Actions.

---

## Alcance y regla de finalización

Este plan resuelve:

1. Datos simulados en pantallas.
2. APIs que validan pero no persisten.
3. Protección incompleta de rutas y operaciones.
4. Registro y perfiles no funcionales.
5. Archivos privados incompletos.
6. Pruebas E2E insuficientes o fallidas.
7. Dependencias vulnerables.
8. Falta de observabilidad, backups y recuperación.
9. Rama principal, CI, staging y despliegue no preparados.
10. Requisitos legales y comerciales pendientes.

Queda expresamente fuera de alcance:

- Mercado Pago real.
- OAuth del profesional con Mercado Pago.
- Split, liquidación, conciliación y reembolsos reales del proveedor.

Se conserva una interfaz de pagos y un proveedor falso para desarrollo y E2E. Producción debe mantener los cobros deshabilitados hasta incorporar y validar el módulo externo. Por lo tanto, completar este plan significa “100% de los puntos no relacionados con pagos”; no autoriza por sí solo el lanzamiento comercial.

## Orden de ejecución

Las tareas son secuenciales. No conectar pantallas antes de cerrar autenticación y persistencia. No desplegar staging antes de tener CI, E2E y auditoría verdes.

---

### Task 1: Consolidar la rama y crear una línea base reproducible

**Resuelve:** código fuera de `main`, repositorio remoto vacío y ausencia de evidencia CI.

**Files:**
- Modify: `README.md`
- Modify: `checks/IMPLEMENTATION_STATUS.md`
- Modify: `checks/HONEST_SYSTEM_STATUS.md`
- Modify: `.github/workflows/ci.yml`
- Create: `docs/release/branch-and-release-policy.md`

**Step 1: Comprobar el estado sin modificarlo**

Run: `git status --short --branch`

Expected: rama `feat/mvp-implementation` limpia.

Run: `git ls-remote --heads origin`

Expected before publication: sin ramas o sin la rama de implementación.

**Step 2: Documentar la estrategia de ramas**

Definir en `docs/release/branch-and-release-policy.md`:

- `main` siempre desplegable.
- cambios mediante PR.
- staging desde PR o rama protegida.
- producción únicamente desde commit aprobado de `main`.
- prohibición de credenciales y datos reales en Git.

**Step 3: Corregir el gate E2E del gestor de paquetes**

Modificar `playwright.config.ts` en Task 12 para iniciar con `corepack pnpm dev`. En CI usar pnpm 9.15.0 fijado por `packageManager`.

**Step 4: Publicar solo con autorización**

Run when authorized: `git push -u origin feat/mvp-implementation`

Expected: rama visible en GitHub y workflow iniciado.

**Step 5: Abrir PR hacia `main` y exigir gates**

Required checks:

- lint;
- typecheck;
- unit/domain;
- Supabase/pgTAP;
- build;
- Playwright.

**Step 6: Commit**

```powershell
git add README.md checks .github/workflows/ci.yml docs/release/branch-and-release-policy.md
git commit -m "chore: establish reproducible release baseline"
```

**Definition of Done:** código publicado, PR revisable, `main` recuperada y CI remoto reproducible.

---

### Task 2: Proteger sesiones, roles, páginas y APIs

**Resuelve:** páginas privadas accesibles sin sesión y APIs que confían en identificadores enviados por el navegador.

**Files:**
- Modify: `middleware.ts`
- Modify: `lib/supabase/server.ts`
- Create: `lib/auth/current-actor.ts`
- Create: `lib/auth/authorize-request.ts`
- Create: `lib/auth/require-api-actor.ts`
- Create: `tests/unit/authorize-request.vitest.test.ts`
- Create: `tests/integration/route-protection.vitest.test.ts`
- Modify: every file under `app/api/**/route.ts`
- Modify: `app/(customer)/app/layout.tsx`
- Modify: `app/(professional)/pro/layout.tsx`
- Modify: `app/(admin)/admin/layout.tsx`

**Step 1: Escribir pruebas fallidas de acceso**

Cubrir:

- anónimo → `/app`, `/pro`, `/admin`: redirección a `/login`;
- cliente → `/admin`: 403 o redirección a `/app`;
- profesional no aprobado → `/pro`: bloqueo;
- admin sin permiso financiero → API financiera: 403;
- body con `adminProfileId` falso: ignorado;
- sesión expirada: 401 en API.

Run: `corepack pnpm vitest run tests/unit/authorize-request.vitest.test.ts tests/integration/route-protection.vitest.test.ts`

Expected: FAIL porque `middleware.ts` actualmente deja continuar todas las solicitudes.

**Step 2: Crear un actor confiable derivado del servidor**

Implementar este contrato en `lib/auth/current-actor.ts`:

```ts
export type CurrentActor = {
  authUserId: string
  profileId: string
  role: 'customer' | 'professional' | 'admin'
  professionalId?: string
  adminPermissions: string[]
}

export async function getCurrentActor(): Promise<CurrentActor | null>
```

La función debe usar `supabase.auth.getUser()`, nunca metadata o IDs recibidos del cliente como fuente de autoridad.

**Step 3: Proteger navegación en middleware**

Crear cliente Supabase con cookies request/response, renovar sesión y aplicar `requiredRoleForPath`. El middleware solamente decide autenticación básica; cada layout y API repite autorización server-side para evitar depender de una única barrera.

**Step 4: Proteger APIs con helpers comunes**

Contrato mínimo:

```ts
export async function requireApiActor(
  roles: CurrentActor['role'][]
): Promise<CurrentActor>
```

Responder 401 sin sesión y 403 sin rol o subpermiso. Eliminar `customerId`, `professionalId` y `adminProfileId` como prueba de identidad desde los cuerpos públicos.

**Step 5: Proteger layouts**

Los layouts `/app`, `/pro` y `/admin` deben cargar al actor, validar rol y pasar únicamente datos mínimos a la navegación.

**Step 6: Ejecutar ataques básicos**

Probar acceso cruzado por URL, IDs ajenos, cookies ausentes y payload manipulado.

Run: `corepack pnpm test && corepack pnpm build`

Expected: PASS.

**Step 7: Commit**

```powershell
git add middleware.ts lib/auth lib/supabase app tests
git commit -m "feat: enforce authenticated role access"
```

**Definition of Done:** ninguna página o mutación privada funciona sin un actor autenticado y autorizado derivado en servidor.

---

### Task 3: Implementar registro, perfil y aceptaciones legales versionadas

**Resuelve:** registro visual sin creación real de cuenta y perfiles con datos fijos.

**Files:**
- Modify: `app/(auth)/registro/page.tsx`
- Create: `app/(auth)/registro/actions.ts`
- Create: `lib/auth/customer-registration.ts`
- Create: `lib/profiles/customer-profile-service.ts`
- Modify: `app/(customer)/app/perfil/page.tsx`
- Create: `app/api/customer/profile/route.ts`
- Create: `tests/unit/customer-registration.vitest.test.ts`
- Create: `tests/integration/customer-registration.vitest.test.ts`
- Modify: `supabase/migrations/202608190005_security_and_roles.sql` only through a new additive migration
- Create: `supabase/migrations/202608200001_registration_and_legal_acceptances.sql`
- Create: `supabase/tests/database/registration.test.sql`

**Step 1: Escribir pruebas fallidas**

Cubrir email normalizado, contraseña segura, teléfono argentino, duplicado, términos obligatorios, versión de términos y rollback si falla el perfil.

**Step 2: Crear operación transaccional de alta**

Flujo:

1. Validar Zod en servidor.
2. Crear usuario Supabase Auth.
3. Crear `profiles` y `customer_profiles`.
4. Registrar `legal_acceptances` con versión, fecha, IP truncada/hasheada según política y user-agent mínimo.
5. Enviar verificación de email.
6. Redirigir a estado “verificá tu correo”.

**Step 3: Implementar edición de perfil**

Leer por sesión; permitir cambiar nombre, apellido, teléfono y preferencias. Email debe seguir el flujo seguro de Supabase Auth.

**Step 4: Añadir control de aceptación vigente**

Si cambia la versión obligatoria, bloquear mutaciones comerciales hasta una nueva aceptación explícita.

**Step 5: Verificar**

Run: `corepack pnpm vitest run tests/unit/customer-registration.vitest.test.ts tests/integration/customer-registration.vitest.test.ts`

Run: `corepack pnpm supabase test db`

Expected: PASS.

**Step 6: Commit**

```powershell
git add app lib/profiles lib/auth supabase tests
git commit -m "feat: register customers and persist profiles"
```

**Definition of Done:** cliente real puede registrarse, verificar correo, iniciar sesión y mantener su perfil sin datos simulados.

---

### Task 4: Conectar solicitudes, diagnóstico, precios y agenda a Supabase

**Resuelve:** wizard visual y APIs que preparan objetos pero no persisten.

**Files:**
- Modify: `features/service-request/air-conditioning-wizard.tsx`
- Modify: `app/(customer)/app/solicitar/aire-acondicionado/page.tsx`
- Modify: `app/api/service-request/preview/route.ts`
- Modify: `app/api/customer/request/submit/route.ts`
- Modify: `lib/data-access/supabase/service-request-writes.ts`
- Create: `lib/service-request/request-service.ts`
- Create: `lib/queries/customer-requests.ts`
- Create: `tests/integration/service-request-persistence.vitest.test.ts`
- Create: `tests/e2e/customer-request.spec.ts`
- Add migration only if the current RPC lacks required transaction or ownership checks.

**Step 1: Escribir prueba de borrador persistente**

Cada paso debe guardarse y retomarse tras recargar o cambiar de dispositivo.

**Step 2: Probar envío atómico**

Solicitud, dirección congelada, respuestas, diagnóstico, opciones de precio y evento de auditoría deben confirmarse juntos. Un fallo no puede dejar datos parciales.

**Step 3: Implementar servicios de aplicación**

Contrato recomendado:

```ts
export async function saveRequestDraft(actor: CurrentActor, input: DraftInput)
export async function previewRequest(actor: CurrentActor, draftId: string)
export async function submitRequest(actor: CurrentActor, draftId: string)
```

El precio mostrado se congela en la solicitud; cambios administrativos futuros no alteran cotizaciones anteriores.

**Step 4: Conectar disponibilidad real**

Leer zonas, franjas, capacidad y reglas vigentes desde Supabase. No hardcodear CABA/Hudson ni horarios en la pantalla.

**Step 5: Mantener pagos fuera del alcance**

Al terminar el wizard, crear estado `pending_payment`. En E2E usar un `FakePaymentProvider` de test o fixture server-side para avanzar a `payment_approved`; nunca exponer un botón productivo que simule aprobación.

**Step 6: Verificar**

Run: `corepack pnpm vitest run tests/integration/service-request-persistence.vitest.test.ts`

Run: `corepack pnpm exec playwright test tests/e2e/customer-request.spec.ts`

Expected: PASS.

**Step 7: Commit**

```powershell
git add features app lib supabase tests
git commit -m "feat: persist customer service requests"
```

**Definition of Done:** el wizard guarda, retoma y envía solicitudes reales con diagnóstico y precios persistidos.

---

### Task 5: Reemplazar todos los mocks del portal cliente

**Resuelve:** 11+ pantallas de cliente con información de ejemplo.

**Files:**
- Modify: all pages under `app/(customer)/app`
- Create: `lib/queries/customer-dashboard.ts`
- Create: `lib/queries/customer-jobs.ts`
- Create: `lib/queries/customer-equipment.ts`
- Create: `lib/queries/customer-quality.ts`
- Create: `lib/queries/pagination.ts`
- Create: `tests/integration/customer-queries.vitest.test.ts`
- Create: `tests/domain/no-critical-mocks.test.ts`

**Step 1: Crear un gate que falle con mocks**

El test debe buscar `lib/mock/lysto-data` dentro de `app`, `app/api` y servicios productivos.

Run: `corepack pnpm test:domain`

Expected: FAIL listando cada import actual.

**Step 2: Crear queries paginadas y acotadas por cliente**

Seleccionar columnas explícitas. Evitar `select('*')`. Agregar índices solo para consultas reales y verificarlos en staging con `EXPLAIN (ANALYZE, BUFFERS)`.

**Step 3: Conectar pantallas en orden**

1. dashboard;
2. solicitudes y detalle;
3. trabajos y detalle;
4. equipos e historial;
5. direcciones;
6. garantías y reclamos;
7. mantenimientos;
8. perfil;
9. pagos como estado informativo del contrato pendiente, sin integración real.

**Step 4: Añadir estados de interfaz**

Cada pantalla debe tener loading, vacío, error recuperable, paginación y confirmación de mutaciones.

**Step 5: Probar aislamiento**

Cliente A nunca ve filas, direcciones, equipos o archivos de Cliente B, incluso manipulando URLs.

**Step 6: Probar el gate**

Run: `rg -n "lib/mock/lysto-data" app lib --glob '!lib/mock/**'`

Expected: ningún import productivo.

**Step 7: Commit**

```powershell
git add app lib/queries tests
git commit -m "feat: connect customer portal to Supabase"
```

**Definition of Done:** todas las pantallas del cliente muestran exclusivamente datos reales del usuario autenticado.

---

### Task 6: Completar onboarding y operación del profesional

**Resuelve:** portal profesional simulado, documentos pendientes y APIs no persistentes.

**Files:**
- Modify: all pages under `app/(professional)/pro`
- Modify: `app/api/professional/onboarding/route.ts`
- Modify: `app/api/pro/onboarding/evaluate/route.ts`
- Modify: `app/api/professional/respond-request/route.ts`
- Modify: `app/api/pro/jobs/action/route.ts`
- Create: `lib/professional/onboarding-service.ts`
- Create: `lib/jobs/job-transition-service.ts`
- Create: `lib/queries/professional-dashboard.ts`
- Create: `tests/integration/professional-onboarding.vitest.test.ts`
- Create: `tests/integration/job-transitions.vitest.test.ts`
- Create: `tests/e2e/professional-flow.spec.ts`

**Step 1: Probar invitación y onboarding**

Token aleatorio, de un solo uso, con vencimiento. Requerir identidad, documentos, matrícula cuando corresponda, herramientas, zonas, disponibilidad y aceptaciones.

**Step 2: Persistir evaluación y aprobación**

El profesional envía a `under_review`; solo admin autorizado puede aprobar. Documentos vencidos deben suspender nuevas asignaciones.

**Step 3: Implementar transición única de trabajo**

Toda acción debe llamar un servicio que valide actor, estado actual y datos obligatorios, y escriba en una sola transacción:

- nuevo estado;
- evento de timeline;
- auditoría;
- evento outbox;
- campos técnicos asociados.

**Step 4: Conectar agenda y trabajos**

El profesional ve solamente solicitudes ofrecidas o trabajos asignados. La dirección completa aparece solo cuando la asignación y reglas operativas lo permiten.

**Step 5: Conectar cierre técnico**

Exigir equipo, diagnóstico real, trabajo, resultado, evidencia posterior y mantenimiento recomendado.

**Step 6: Verificar**

Run: `corepack pnpm vitest run tests/integration/professional-onboarding.vitest.test.ts tests/integration/job-transitions.vitest.test.ts`

Run: `corepack pnpm exec playwright test tests/e2e/professional-flow.spec.ts`

Expected: PASS.

**Step 7: Commit**

```powershell
git add app lib/professional lib/jobs lib/queries tests
git commit -m "feat: operate professional lifecycle with real data"
```

**Definition of Done:** profesional invitado puede completar onboarding y operar únicamente sus trabajos con trazabilidad completa.

---

### Task 7: Conectar panel administrativo y subpermisos

**Resuelve:** administración visual, datos simulados y operaciones que no guardan.

**Files:**
- Modify: all pages under `app/(admin)/admin`
- Modify: all routes under `app/api/admin`
- Create: `lib/admin/authorization.ts`
- Create: `lib/admin/admin-service.ts`
- Create: `lib/queries/admin-dashboard.ts`
- Create: `lib/queries/admin-operations.ts`
- Create: `tests/integration/admin-permissions.vitest.test.ts`
- Create: `tests/integration/admin-operations.vitest.test.ts`
- Create: `tests/e2e/admin-flow.spec.ts`

**Step 1: Definir subpermisos**

Usar al menos: `operations`, `finance`, `quality`, `catalog`, `owner`. Un rol admin genérico no debe dar acceso automático a todo.

**Step 2: Probar operaciones y denegaciones**

Cubrir invitación/aprobación, matching, reasignación, pricing, suspensión, calidad, lectura financiera y configuración.

**Step 3: Derivar actor en servidor**

Eliminar IDs de admin suministrados en payload. Toda acción sensible exige motivo, registra before/after y correlation ID.

**Step 4: Conectar pantallas**

Usar queries paginadas y filtros server-side. No descargar tablas completas al navegador.

**Step 5: Añadir auditoría inmutable**

La UI puede buscar y exportar; no editar ni borrar eventos.

**Step 6: Verificar**

Run: `corepack pnpm vitest run tests/integration/admin-permissions.vitest.test.ts tests/integration/admin-operations.vitest.test.ts`

Run: `corepack pnpm exec playwright test tests/e2e/admin-flow.spec.ts`

Expected: PASS.

**Step 7: Commit**

```powershell
git add app lib/admin lib/queries tests
git commit -m "feat: connect controlled admin operations"
```

**Definition of Done:** administración opera datos reales con mínimo privilegio y auditoría verificable.

---

### Task 8: Implementar carga y entrega segura de archivos privados

**Resuelve:** endpoint que devuelve `signedUrl: null`, inputs “Upload pendiente” y falta de validación real.

**Files:**
- Modify: `app/api/uploads/sign/route.ts`
- Create: `app/api/uploads/finalize/route.ts`
- Create: `app/api/uploads/read/route.ts`
- Create: `app/api/internal/uploads/cleanup/route.ts`
- Create: `lib/uploads/upload-service.ts`
- Create: `lib/uploads/file-signatures.ts`
- Create: `lib/uploads/orphan-cleanup.ts`
- Modify: `lib/uploads/validation.ts`
- Create: `tests/unit/file-signatures.vitest.test.ts`
- Create: `tests/integration/private-uploads.vitest.test.ts`
- Create: `tests/e2e/uploads.spec.ts`
- Add additive storage migration only if current policies need adjustment.

**Step 1: Probar autorización y límites**

Cubrir propietario incorrecto, profesional no asignado, MIME falso, tamaño excesivo, extensión doble, token vencido y bucket equivocado.

**Step 2: Crear reserva de upload autenticada**

El servidor deriva propietario y entidad, crea un path aleatorio, registra reserva y emite URL firmada corta para bucket privado.

**Step 3: Inspeccionar bytes al finalizar**

No confiar solo en MIME/extensión. Verificar magic bytes, tamaño real y formato permitido. Marcar archivo como disponible únicamente después de inspección.

**Step 4: Entregar archivos con autorización**

Generar URL firmada breve después de comprobar sesión y relación con solicitud/trabajo. Nunca guardar URL pública permanente.

**Step 5: Limpiar huérfanos**

Worker interno autenticado elimina reservas vencidas y objetos sin metadata confirmada. Registrar conteos, no nombres sensibles.

**Step 6: Verificar**

Run: `corepack pnpm vitest run tests/unit/file-signatures.vitest.test.ts tests/integration/private-uploads.vitest.test.ts`

Run: `corepack pnpm exec playwright test tests/e2e/uploads.spec.ts`

Expected: PASS.

**Step 7: Commit**

```powershell
git add app/api/uploads app/api/internal/uploads lib/uploads supabase tests
git commit -m "feat: secure private file workflows"
```

**Definition of Done:** fotos, videos y documentos funcionan de punta a punta sin exposición pública ni confianza en metadatos del navegador.

---

### Task 9: Completar equipos, comprobantes, reviews, garantías y calidad

**Resuelve:** comprobante estático y APIs de cierre/calidad que no persisten.

**Files:**
- Modify: `app/api/equipment/register/route.ts`
- Modify: `app/api/jobs/final-report/route.ts`
- Modify: `app/api/reviews/submit/route.ts`
- Modify: `app/api/warranty/claim/route.ts`
- Modify: `app/api/quality/open-case/route.ts`
- Modify: `app/api/maintenance/schedule/route.ts`
- Modify: `app/comprobante/[token]/page.tsx`
- Create: `lib/qr/receipt-service.ts`
- Create: `lib/quality/quality-service.ts`
- Create: `tests/integration/equipment-closeout.vitest.test.ts`
- Create: `tests/integration/public-receipt.vitest.test.ts`
- Create: `tests/integration/review-claim.vitest.test.ts`
- Create: `tests/e2e/closeout-quality.spec.ts`

**Step 1: Probar cierre atómico**

En una transacción crear informe, historial de equipo, recomendación, garantía, token de comprobante, timeline y outbox.

**Step 2: Implementar comprobante mínimo**

Token aleatorio, no enumerable, revocable y con vencimiento configurable. Responder 404 para inválido/revocado/vencido. Agregar `noindex`; ocultar dirección, teléfono, email, DNI/CUIL e información financiera interna.

**Step 3: Implementar review idempotente**

Solo el cliente del trabajo completado puede valorar una vez. Reintentos devuelven el resultado existente.

**Step 4: Implementar reclamos y garantías**

Usar snapshot de garantía del cierre, SLA, severidad, responsable y timeline. Riesgos de seguridad o cobro escalan automáticamente.

**Step 5: Verificar**

Run: `corepack pnpm vitest run tests/integration/equipment-closeout.vitest.test.ts tests/integration/public-receipt.vitest.test.ts tests/integration/review-claim.vitest.test.ts`

Expected: PASS.

**Step 6: Commit**

```powershell
git add app lib/qr lib/quality lib/equipment lib/reviews lib/warranty tests
git commit -m "feat: persist closeout and quality workflows"
```

**Definition of Done:** cierre, historial, comprobante, review y reclamo funcionan con datos reales y permisos correctos.

---

### Task 10: Implementar notificaciones confiables y auditoría operativa

**Resuelve:** respuestas que dicen “insertar notificación” sin enviarla y ausencia de worker real.

**Files:**
- Modify: `lib/notifications/events.ts`
- Modify: `lib/notifications/templates.ts`
- Create: `lib/notifications/dispatcher.ts`
- Create: `lib/notifications/providers/in-app.ts`
- Create: `lib/notifications/providers/email.ts`
- Create: `lib/audit/service.ts`
- Create: `app/api/internal/process-outbox/route.ts`
- Modify: `app/(admin)/admin/notificaciones/page.tsx`
- Modify: `app/(admin)/admin/auditoria/page.tsx`
- Create: `tests/unit/notification-templates.vitest.test.ts`
- Create: `tests/integration/outbox-dispatch.vitest.test.ts`

**Step 1: Probar templates seguros**

No incluir secretos, DNI/CUIL, tokens, datos completos de pago ni direcciones innecesarias.

**Step 2: Probar outbox**

Cubrir éxito, reintento exponencial, error permanente, evento duplicado y workers concurrentes.

**Step 3: Implementar in-app y email**

In-app es obligatorio. Email se activa solo con credenciales y dominio verificado. WhatsApp queda opcional y deshabilitado hasta aprobación de proveedor/plantillas.

**Step 4: Proteger worker**

Usar secreto rotatorio o invocación privada de Railway; claim atómico y logs sin payload personal completo.

**Step 5: Verificar**

Run: `corepack pnpm vitest run tests/unit/notification-templates.vitest.test.ts tests/integration/outbox-dispatch.vitest.test.ts`

Expected: PASS.

**Step 6: Commit**

```powershell
git add lib/notifications lib/audit app tests
git commit -m "feat: dispatch notifications and immutable audits"
```

**Definition of Done:** cada evento crítico genera auditoría y notificación trazable, reintentable e idempotente.

---

### Task 11: Eliminar vulnerabilidades y endurecer configuración web

**Resuelve:** 6 vulnerabilidades conocidas y configuración Next.js vacía.

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `next.config.ts`
- Create: `lib/security/headers.ts`
- Create: `tests/unit/security-headers.vitest.test.ts`
- Modify: `.github/workflows/ci.yml`

**Step 1: Guardar evidencia inicial**

Run: `corepack pnpm audit --prod`

Expected initially: advisories de Sharp, PostCSS y UUID.

**Step 2: Quitar SDKs de pago no utilizados**

Mientras la integración de pagos está fuera de alcance, eliminar `mercadopago` y `@mercadopago/sdk-react` si ningún módulo productivo los usa. El futuro módulo reutilizado debe reintroducir solo dependencias necesarias y auditadas.

**Step 3: Actualizar framework y herramientas**

Elegir versiones parcheadas compatibles usando changelogs oficiales vigentes al momento de ejecución. No aplicar actualización mayor sin pruebas de regresión.

**Step 4: Configurar headers**

Agregar CSP compatible con Supabase y proveedores realmente usados, HSTS solo en producción HTTPS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` y protección de framing.

**Step 5: Añadir audit al CI**

El pipeline debe fallar ante vulnerabilidades high/critical explotables o no aceptadas mediante excepción documentada con vencimiento.

**Step 6: Verificar**

Run: `corepack pnpm install --frozen-lockfile`

Run: `corepack pnpm audit --prod`

Run: `corepack pnpm lint && corepack pnpm typecheck && corepack pnpm test && corepack pnpm build`

Expected: audit sin high/critical, todos los gates PASS.

**Step 7: Commit**

```powershell
git add package.json pnpm-lock.yaml next.config.ts lib/security tests .github/workflows/ci.yml
git commit -m "chore: patch dependencies and harden web security"
```

**Definition of Done:** sin vulnerabilidades high/critical conocidas, headers verificados y excepción formal para cualquier riesgo restante.

---

### Task 12: Construir una suite E2E real, accesible y estable

**Resuelve:** 1 único archivo E2E, 3/3 ejecuciones fallidas y navegador WebKit ausente.

**Files:**
- Modify: `playwright.config.ts`
- Replace/Modify: `tests/e2e/customer-flow.spec.ts`
- Create: `tests/e2e/auth.spec.ts`
- Create: `tests/e2e/customer-request.spec.ts`
- Create: `tests/e2e/professional-flow.spec.ts`
- Create: `tests/e2e/admin-flow.spec.ts`
- Create: `tests/e2e/closeout-quality.spec.ts`
- Create: `tests/e2e/failure-recovery.spec.ts`
- Create: `tests/e2e/accessibility.spec.ts`
- Create: `tests/e2e/privacy.spec.ts`
- Create: `tests/e2e/fixtures.ts`
- Modify: `.github/workflows/ci.yml`

**Step 1: Corregir arranque reproducible**

En Playwright:

```ts
webServer: {
  command: 'corepack pnpm dev',
  url: 'http://127.0.0.1:3000',
  reuseExistingServer: !process.env.CI
}
```

Instalar Chromium y WebKit en CI con versión fijada.

**Step 2: Crear fixtures deterministas**

Base aislada con cliente A/B, profesional A/B, admin operations/finance/owner, catálogo y trabajos en estados conocidos. Nunca reutilizar producción.

**Step 3: Automatizar happy paths**

Registro/login, solicitud, asignación, aceptación, trabajo, cierre, comprobante, review y reclamo. El paso de pago usa fake provider controlado exclusivamente en entorno de prueba.

**Step 4: Automatizar fallos**

Sesión vencida, permisos cruzados, duplicados, sin profesionales, rechazo, presupuesto rechazado, segunda visita, notificación fallida, archivo inválido y token de recibo inválido.

**Step 5: Añadir accesibilidad**

Ejecutar axe o herramienta equivalente en pantallas críticas; fallar por violaciones serious/critical, campos sin label, focus trap y overflow horizontal.

**Step 6: Ejecutar matriz**

Run: `corepack pnpm exec playwright install chromium webkit`

Run: `corepack pnpm test:e2e`

Expected: todos los proyectos PASS en móvil y escritorio.

**Step 7: Commit**

```powershell
git add playwright.config.ts tests/e2e .github/workflows/ci.yml
git commit -m "test: cover critical browser workflows"
```

**Definition of Done:** suite E2E estable cubre cliente, profesional, admin, privacidad, errores, móvil y escritorio.

---

### Task 13: Añadir observabilidad, salud e incidentes

**Resuelve:** ausencia de logs estructurados, alertas, health endpoint y procedimientos de incidentes.

**Files:**
- Create: `lib/observability/logger.ts`
- Create: `lib/observability/request-context.ts`
- Create: `lib/observability/error-codes.ts`
- Create: `app/api/health/route.ts`
- Create: `app/api/internal/health/dependencies/route.ts`
- Create: `docs/operations/incident-runbook.md`
- Create: `docs/operations/alerts.md`
- Create: `tests/unit/logger-redaction.vitest.test.ts`
- Create: `tests/integration/health.vitest.test.ts`

**Step 1: Probar redacción**

El logger debe eliminar passwords, tokens, cookies, DNI/CUIL, cuerpos de archivos y datos personales innecesarios.

**Step 2: Agregar correlation ID**

Cada request, servicio, auditoría y outbox comparte un identificador. Registrar nombre de evento, entidad, duración, resultado y código de error.

**Step 3: Implementar endpoints de salud**

`/api/health` comprueba proceso sin filtrar configuración. El chequeo profundo de Supabase/Storage/outbox es privado y autenticado.

**Step 4: Definir alertas**

Alertar por errores 5xx, latencia, backlog outbox, archivos fallidos, acceso denegado anómalo, reclamos críticos y fallos de despliegue.

**Step 5: Escribir runbook**

Cubrir credencial filtrada, caída de Supabase, despliegue fallido, acceso indebido, archivos expuestos, incidente de seguridad física, reclamo y futura discrepancia de pago.

**Step 6: Verificar y commit**

Run: `corepack pnpm vitest run tests/unit/logger-redaction.vitest.test.ts tests/integration/health.vitest.test.ts`

Expected: PASS.

```powershell
git add lib/observability app/api/health app/api/internal/health docs/operations tests
git commit -m "feat: add production observability and incident controls"
```

**Definition of Done:** equipo puede detectar, investigar y responder fallos sin exponer datos sensibles.

---

### Task 14: Implementar backups, restauración y retención

**Resuelve:** backups y recuperación no probados; ausencia de política de conservación.

**Files:**
- Create: `docs/operations/backup-restore.md`
- Create: `docs/operations/privacy-retention.md`
- Create: `docs/operations/disaster-recovery-drill.md`
- Create: `scripts/verify-backup.ps1`
- Create: `scripts/verify-storage-backup.ps1`
- Create: `tests/operations/backup-manifest.test.ts`

**Step 1: Inventariar datos**

Clasificar base, Auth, objetos Storage, secretos, auditoría y configuración. Definir RPO/RTO con responsable de negocio.

**Step 2: Configurar copias separadas**

El backup de PostgreSQL no cubre Storage. Crear política separada para evidencias y documentos críticos con cifrado y acceso mínimo.

**Step 3: Definir retención y eliminación**

Plazos por solicitudes, documentos profesionales, fotos/videos, auditoría, reclamos y cuentas eliminadas. Implementar exportación y eliminación segura sujetas a obligaciones legales.

**Step 4: Realizar simulacro**

Restaurar base y Storage en entorno no productivo; verificar conteos, checksums, relaciones, RLS y URLs firmadas.

**Step 5: Guardar evidencia**

Registrar fecha, duración, responsables, fallos y acciones. No incluir datos personales o secretos en el documento.

**Step 6: Commit**

```powershell
git add docs/operations scripts tests/operations
git commit -m "docs: prove backup restore and retention controls"
```

**Definition of Done:** existe restauración ejecutada y verificada, no solo documentación teórica.

---

### Task 15: Crear staging y despliegue reproducible en Railway

**Resuelve:** ausencia de staging, configuración de hosting y validación remota.

**Files:**
- Create: `railway.toml`
- Create: `docs/deployment/railway.md`
- Create: `docs/deployment/environment-matrix.md`
- Create: `docs/release/staging-checklist.md`
- Modify: `.env.example`
- Modify: `README.md`

**Step 1: Separar ambientes**

Crear Supabase y Railway independientes para development, staging y production. Nunca compartir base, buckets, claves ni usuarios de prueba.

**Step 2: Configurar aplicación stateless**

Build con lockfile, puerto provisto por Railway, health check y worker/cron para outbox y limpieza. No usar disco persistente para uploads.

**Step 3: Aplicar migraciones a staging**

Ejecutar dry-run/diff, revisar cambios, aplicar y correr pgTAP/RLS contra staging con fixtures aislados.

**Step 4: Configurar secretos**

Cargar mediante Railway/GitHub, jamás en archivos. Mantener `PAYMENTS_PROVIDER=disabled` o equivalente en staging público hasta integrar la pasarela final.

**Step 5: Ejecutar smoke y E2E contra URL pública**

Run: `$env:NEXT_PUBLIC_APP_URL='<staging-url>'; corepack pnpm test:e2e`

Expected: PASS.

**Step 6: Probar rollback**

Revertir aplicación a release anterior sin migración destructiva. Documentar compatibilidad hacia atrás.

**Step 7: Commit**

```powershell
git add railway.toml docs/deployment docs/release .env.example README.md
git commit -m "chore: deploy verified staging environment"
```

**Definition of Done:** staging público controlado reproduce build, migraciones, workers, seguridad y E2E.

---

### Task 16: Completar páginas y aprobaciones legales/comerciales

**Resuelve:** términos, privacidad, cancelaciones, garantías y relación profesional sin validación humana.

**Files:**
- Create: `app/(public)/terminos/page.tsx`
- Create: `app/(public)/privacidad/page.tsx`
- Create: `app/(public)/cancelaciones/page.tsx`
- Create: `app/(public)/garantia/page.tsx`
- Create: `app/(public)/contacto/page.tsx`
- Create: `docs/legal/legal-approval-checklist.md`
- Create: `docs/legal/versioning-process.md`
- Modify: public navigation/footer components
- Modify: registration and professional onboarding acceptances
- Create: `tests/e2e/legal-pages.spec.ts`

**Step 1: Preparar borradores operativos**

Incluir alcance del servicio, responsabilidades, datos tratados, conservación, soporte, cancelación, devolución, garantía y contacto.

**Step 2: Obtener revisión profesional**

Abogado y contador en Argentina deben aprobar por escrito:

- relación con profesionales;
- facturación e impuestos;
- comisión y liquidación futura;
- defensa del consumidor;
- privacidad y derechos del titular;
- cancelación, devolución y garantía.

**Step 3: Versionar documentos**

Cada aceptación guarda documento, versión y fecha. Cambios materiales requieren nueva aceptación.

**Step 4: Probar visibilidad y consentimiento**

Términos accesibles sin login; checkbox no preseleccionado; enlaces visibles; rechazo impide alta.

**Step 5: Verificar y commit**

Run: `corepack pnpm exec playwright test tests/e2e/legal-pages.spec.ts`

Expected: PASS.

```powershell
git add app docs/legal tests/e2e/legal-pages.spec.ts
git commit -m "feat: publish versioned legal policies"
```

**Definition of Done:** documentación publicada, versionada y aprobada por responsables legales/contables identificados.

---

### Task 17: Ejecutar la puerta final de release sin pagos

**Resuelve:** falta de una decisión objetiva y verificable de preparación.

**Files:**
- Modify: `lib/release/release-gates.ts`
- Modify: `tests/domain/release-gates.test.ts`
- Create: `docs/release/non-payment-completion-checklist.md`
- Modify: `tests/qa/manual-release-checklist.md`
- Modify: `checks/IMPLEMENTATION_STATUS.md`
- Modify: `checks/HONEST_SYSTEM_STATUS.md`

**Step 1: Separar gates**

Crear dos decisiones:

- `nonPaymentReady`: todos los puntos de este plan.
- `commercialLaunchReady`: `nonPaymentReady` más proveedor de pagos real validado.

El sistema nunca debe mostrar `commercialLaunchReady=true` con proveedor fake/disabled.

**Step 2: Ejecutar gate automático completo**

Run:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm test:e2e
corepack pnpm audit --prod
```

Expected: todos PASS y audit sin high/critical.

**Step 3: Ejecutar gate Supabase**

Run:

```powershell
corepack pnpm supabase db reset
corepack pnpm supabase test db
corepack pnpm supabase db lint --schema public --schema private
```

Expected: migraciones, seed, RLS, Storage y eventos PASS.

**Step 4: Completar revisión manual**

Probar Safari iOS, Chrome Android y escritorio; red lenta; límites de archivo; permisos cruzados; recuperación; comprobante; auditoría; emails; backup/restore y rollback.

**Step 5: Actualizar estado honestamente**

Cada capacidad debe marcarse como:

- local verificada;
- staging verificada;
- producción verificada;
- diferida: pagos.

**Step 6: Commit**

```powershell
git add lib/release tests docs/release checks
git commit -m "docs: certify non-payment production readiness"
```

**Definition of Done:** `nonPaymentReady=true`, `commercialLaunchReady=false` hasta integrar la pasarela reutilizada y ejecutar sus gates específicos.

---

## Hitos y porcentaje esperado

| Hito | Tareas | Preparación estimada |
|---|---|---:|
| Base publicable y segura | 1–3 | 40% |
| Recorrido real del cliente | 4–5 | 55% |
| Operación profesional y admin | 6–7 | 70% |
| Archivos, cierre y notificaciones | 8–10 | 80% |
| Seguridad y QA integral | 11–12 | 90% |
| Operación, recuperación y staging | 13–15 | 97% de lo no relacionado con pagos |
| Legal y gate final | 16–17 | 100% de lo no relacionado con pagos |

Los porcentajes no habilitan saltos. Cada hito requiere todos sus tests y criterios de aceptación verdes antes de comenzar el siguiente.

## Gate posterior para el módulo de pagos reutilizado

Cuando se incorpore el código del otro proyecto, crear un plan separado que verifique al menos:

- compatibilidad con el modelo `PaymentProvider` de Lysto;
- secretos y OAuth;
- firma de webhooks;
- idempotencia;
- split y saldos;
- reembolsos y disputas;
- conciliación;
- sandbox E2E;
- aprobación contable/legal;
- observabilidad y runbook.

Solo después de ese plan podrá evaluarse `commercialLaunchReady=true`.
