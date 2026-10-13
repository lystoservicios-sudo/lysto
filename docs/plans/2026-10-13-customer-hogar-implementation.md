# Customer Hogar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrar el Hogar 3D aprobado como funcionalidad autenticada, persistente y completa, y publicar el resultado verificado en main.

**Architecture:** Contratos y transformaciones puras compartidos; API privada con RPC de propietario y control de versión; hogar estable y ubicación separada del inventario histórico. Cliente mobile-first reutiliza el App Shell y carga Three.js solo en Hogar; únicamente se construye la planta/ambiente visible. Listas y formularios siguen disponibles sin WebGL.

**Tech Stack:** Next 15, React 19, TypeScript, Zod, Three.js, Supabase/Postgres, Vitest, Testing Library.

---

## Coordinación

Continuar la rama de trabajo existente que contiene Inicio/Servicios aprobados sin limpiar ni copiar cambios ajenos. Archivos exclusivos por responsable: datos/contratos/API/SQL; escena; interfaz/ruta. Los cambios compartidos (dependencias y tipos de base) se coordinan desde el agente principal. @test-driven-development y @requesting-code-review son obligatorios. El usuario ya pidió ejecución en esta sesión y publicación final; no necesita elegir una nueva sesión.

### Task 1: Contratos, catálogo y modelo de hogar

**Files:** Create `lib/customer-homes/contracts.ts`, `lib/customer-homes/model.ts`, `lib/customer-homes/presets.ts`; Test `tests/unit/customer-homes-model.vitest.test.ts`.

1. Escribir pruebas RED para IDs de planta/ambiente coherentes, variantes por tipo, posiciones acotadas, ambientes sin solapamiento y remoción que conserva inventario.
2. Ejecutar `pnpm exec vitest run tests/unit/customer-homes-model.vitest.test.ts`; debe fallar por comportamiento inexistente.
3. Implementar contratos estrictos, tipos compartidos, catálogo traducido y funciones puras. Ejemplo: `expect(removeRoom(home, roomId).placements).not.toContainEqual(expect.objectContaining({roomId}))` sin mutar `equipment`.
4. Repetir pruebas hasta PASS; revisar especificación y calidad antes de integración.

### Task 2: Persistencia y API

**Files:** Create migration via `supabase migration new customer_hogar`; `lib/customer-homes/service.ts`, `app/api/customer/homes/route.ts`, pruebas de rutas y SQL/integración.

1. Pruebas RED: cliente B no lee/escribe A, rechaza dirección/equipo ajeno, conflicto de versión, reintento no duplica, cambio de dirección conserva hogar, quitar habitación conserva equipo.
2. Tablas/RPC con RLS y propietario validado; no modificar el inventario histórico. Crear/ubicar equipo en transacción. RPC privado definer con `search_path=''`, wrapper público invoker.
3. GET privado devuelve `{ homes, addresses, equipment }`; POST/PUT/DELETE validan cuerpo con Zod y versión. No devolver información técnica interna.
4. Probar migración, verificar contra proyecto vinculado `dqonlqcurvjnjgsczevu`, ejecutar advisors y pruebas transaccionales con rollback.

### Task 3: Escena de producción

**Files:** Create `components/customer/hogar/home-scene.tsx`, `scene-builders.ts`; Test `tests/unit/customer-hogar-scene.vitest.test.ts`.

1. RED: solo planta activa; foco solo ambiente elegido; muebles distintos entre variantes; superficies de pared explícitas; clamps sin zona muerta; recursos descartados.
2. Adaptar geometría aprobada sin presets/equipos ficticios. Zoom/rotar/restablecer y controles de colocación accesibles; DPR acotado, render bajo demanda, resize y reduced motion.
3. Ejecutar pruebas focused hasta PASS y revisar fidelidad de composición.

### Task 4: Pantalla y subflujos

**Files:** Create `components/customer/hogar/customer-hogar.tsx`, `customer-hogar.module.css`, formularios; Modify `app/(customer)/app/hogar/page.tsx`; Create `loading.tsx`, `error.tsx`; Test `tests/unit/customer-hogar.vitest.test.tsx`.

1. RED: vacío enseña a crear, configurar dirección/tipo/features, añadir/editar/quitar plantas y ambientes, variantes compatibles, navegar hogares, registrar/ubicar/desubicar, cancelar no guarda, conflicto ofrece recarga, foco oculta nav.
2. Implementar formularios reales con labels, validación, estados ocupados/errores/confirmación; `next/dynamic` dentro de cliente. Datos persistentes solo vía API privada.
3. Probar teclado/Escape/foco, fallback WebGL, largos nombres, 320/390/768/1280, contrastes y movimiento reducido.

### Task 5: Verificación, revisión y publicación

**Files:** Update límites existentes en `tests/unit/customer-page-boundaries.vitest.test.ts`; Create `docs/plans/2026-10-13-customer-hogar-qa.md`.

1. Ejecutar pruebas focused, suite unitaria/dominio, lint, typecheck y build. Corregir causas, no silenciar pruebas.
2. Revisión independiente de especificación; luego calidad/seguridad. Reparar y repetir revisiones.
3. Navegador integrado solamente si está disponible y autorizado; no afirmar capturas/gestos verificados sin evidencia. Registrar limitaciones reales.
4. Inspeccionar diff y secretos; commits selectivos del trabajo relevante. Fetch y comprobar divergencia de `origin/main`; integración no destructiva, push sin force. Verificar SHA remoto antes de informar publicación.
