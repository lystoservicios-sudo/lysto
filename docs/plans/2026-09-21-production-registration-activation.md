# Production Customer Registration Activation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Habilitar y verificar el registro de clientes por correo en la aplicación y el proyecto Supabase de producción.

**Architecture:** Publicar textos legales versionados desde componentes del sitio, registrar sus hashes en las tablas privadas existentes y habilitar la política en una transacción. Mantener el rol de cliente asignado desde `app_metadata`, la aceptación inmutable, el acceso del personal separado y Google deshabilitado.

**Tech Stack:** Next.js 15, React 19, TypeScript, Vitest, Supabase Auth/Postgres, Resend, Vercel.

---

### Task 1: Publicar las versiones de cuenta

**Files:**
- Modify: `tests/policy-pages.vitest.test.tsx`
- Create: `lib/legal/customer-account-policies.ts`
- Modify: `components/public/policy-page.tsx`
- Modify: `app/(public)/terminos/page.tsx`
- Modify: `app/(public)/privacidad/page.tsx`

1. Cambiar la prueba para exigir versión `2026-09-21`, fecha de vigencia, canal de contacto y ausencia del aviso de borrador.
2. Ejecutar `corepack pnpm exec vitest run tests/policy-pages.vitest.test.tsx` y confirmar que falle por el comportamiento anterior.
3. Crear el contenido canónico compartido y renderizarlo en las páginas.
4. Ejecutar la prueba nuevamente y confirmar que pase.

### Task 2: Registrar y habilitar la política

**Files:**
- Create: `supabase/migrations/<generated>_activate_customer_email_registration.sql`

1. Crear la migración con `corepack pnpm exec supabase migration new activate_customer_email_registration`.
2. Calcular SHA-256 sobre el contenido canónico exacto de términos y privacidad.
3. Insertar ambas versiones y habilitar `private.account_registration_policy` dentro de una transacción idempotente.
4. Aplicar el SQL al proyecto Supabase real desde su editor autenticado.
5. Consultar la política resultante y confirmar que `private.get_registration_policy()` devuelve ambas versiones y `test_only=false`.

### Task 3: Verificar y desplegar

**Files:**
- Modify: `docs/release/production-auth-email-2026-09-21.md`

1. Ejecutar lint, tipos, pruebas unitarias y build.
2. Confirmar que el diff sólo contiene la activación prevista y guardar la evidencia.
3. Commit y push directo a `main`, según la instrucción vigente del proyecto.
4. Esperar el despliegue READY de producción.
5. Abrir `/registro`, crear una cuenta descartable por correo, confirmar el email e iniciar sesión.
6. Confirmar que la cuenta obtiene rol `customer` y que no existe ninguna entrada pública para técnico/operador.

