# Customer Home Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar `/app` como un Inicio contextual y compacto, alimentado exclusivamente por datos autorizados del cliente.

**Architecture:** Un cargador de servidor consulta fuentes independientes y las normaliza. Un selector puro prioriza y deduplica widgets; componentes específicos renderizan actividad, accesos estables e invitaciones postergables sin introducir un motor genérico.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase, Tailwind CSS, Vitest y Testing Library.

---

### Task 1: Selector contextual

**Files:**
- Create: `features/customer/home-view-model.ts`
- Create: `tests/unit/customer-home-view-model.vitest.test.ts`

1. Escribir pruebas fallidas para los doce escenarios del brief, incluida prioridad, deduplicación y errores parciales.
2. Ejecutar `pnpm vitest run tests/unit/customer-home-view-model.vitest.test.ts` y confirmar el fallo por módulo ausente.
3. Implementar los tipos y el selector mínimo.
4. Repetir la prueba hasta obtener verde.

### Task 2: Cargador autorizado

**Files:**
- Create: `lib/customer/home-model.ts`
- Modify: `app/(customer)/app/page.tsx`
- Test: `tests/unit/customer-home-data.vitest.test.ts`

1. Escribir pruebas de normalización y aislamiento de fuentes.
2. Ejecutarlas y confirmar el fallo esperado.
3. Implementar consultas acotadas, `Promise.allSettled`, validación de visitas y proyecciones públicas de soporte.
4. Conectar el selector desde `/app`.

### Task 3: Interfaz de Inicio

**Files:**
- Create: `components/customer/customer-home.tsx`
- Create: `components/customer/home-setup-invite.tsx`
- Modify: `components/customer/customer-dashboard.tsx`
- Modify: `tests/unit/customer-dashboard.vitest.test.tsx`

1. Reemplazar las expectativas del dashboard anterior por expectativas fallidas de la nueva pantalla.
2. Implementar la composición compacta, enlaces reales, jerarquía semántica y controles táctiles.
3. Implementar la postergación local por siete días y por perfil.
4. Ejecutar pruebas de componente y accesibilidad básica.

### Task 4: Carga y error

**Files:**
- Create: `app/(customer)/app/loading.tsx`
- Create: `app/(customer)/app/error.tsx`
- Test: `tests/unit/customer-page-boundaries.vitest.test.ts`

1. Agregar expectativas para los límites de `/app`.
2. Implementar skeleton discreto y recuperación de error.
3. Ejecutar la prueba enfocada.

### Task 5: Verificación final

1. Ejecutar las pruebas nuevas y las pruebas cliente afectadas.
2. Ejecutar `pnpm typecheck`.
3. Ejecutar `pnpm lint`.
4. Ejecutar `pnpm build`.
5. Revisar el diff y contrastarlo con cada requisito del brief antes de informar el resultado.
