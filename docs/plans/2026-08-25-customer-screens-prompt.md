# Customer Screens Batch Prompt Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Crear un prompt maestro que implemente las 14 pantallas Cliente de Lysto por tandas verificables dentro del área de contenido de `AppShell`, manteniendo Mercado Pago diferido.

**Architecture:** El prompt reutiliza el catálogo CMP, congela `AppSidebar` y `AppTopbar`, y divide las rutas en siete tandas secuenciales. Cada tanda tiene alcance, componentes, estados, pruebas, verificación responsive y un checkpoint obligatorio.

**Tech Stack:** Markdown, React 19, Next.js 15 App Router, TypeScript, Tailwind CSS, Lucide React, Vitest, Testing Library y Playwright.

---

### Task 1: Crear el contrato general del prompt

**Files:**
- Create: `prompts/04-customer-screens-by-batches.md`
- Reference: `prompts/03-ui-component-generator.md`
- Reference: `components/layout/page-shell.tsx`
- Reference: `docs/plans/2026-08-25-customer-screens-batches-design.md`

**Step 1:** Verificar que el archivo no exista con `Test-Path prompts/04-customer-screens-by-batches.md`.

**Step 2:** Crear instrucciones de contexto, layout congelado, catálogo CMP, calidad, datos y formato de checkpoint.

**Step 3:** Enumerar exactamente las 14 rutas Cliente.

**Step 4:** Verificar el conteo con una expresión regular sobre filas `CUS-01` a `CUS-14`.

### Task 2: Definir las siete tandas

**Files:**
- Modify: `prompts/04-customer-screens-by-batches.md`

**Step 1:** Agregar Tanda 0 para auditoría, primitives, view models y estados comunes.

**Step 2:** Agregar Tandas 1–5 para panel/perfil/direcciones, solicitudes, trabajos, equipos/mantenimiento y garantías.

**Step 3:** Agregar Tanda 6 para pagos diferidos.

**Step 4:** Especificar rutas, CMP, comportamiento, pruebas y criterio de salida para cada tanda.

**Step 5:** Exigir un checkpoint y aprobación antes de continuar.

### Task 3: Definir la política de pago diferido

**Files:**
- Modify: `prompts/04-customer-screens-by-batches.md`

**Step 1:** Exigir un componente central `PaymentDeferredPanel` o reutilización equivalente.

**Step 2:** Prohibir cobros, preferencias, IDs, webhooks, pagos aprobados y movimientos falsos.

**Step 3:** Mantener visibles `/app/pagos`, el paso de pago y CTAs financieros deshabilitados.

**Step 4:** Exigir un inventario de puntos de integración para la futura pasarela.

### Task 4: Validar y guardar

**Files:**
- Modify: `prompts/04-customer-screens-by-batches.md`

**Step 1:** Confirmar 14 rutas y siete tandas.

**Step 2:** Confirmar referencias a CMP, `AppShell`, `AppSidebar`, `AppTopbar`, estados y Mercado Pago diferido.

**Step 3:** Ejecutar `git diff --check` sobre el entregable.

**Step 4:** Commit exacto:

```powershell
git add prompts/04-customer-screens-by-batches.md docs/plans/2026-08-25-customer-screens-prompt.md
git commit -m "docs: add customer screen batch prompt"
```

