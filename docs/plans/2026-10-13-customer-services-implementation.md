# Customer Services Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar Servicios y el detalle adaptativo aprobado dentro del área cliente, conservando datos reales y contratos del negocio.

**Architecture:** Proyección de lectura propia y paginada, con solicitud como identidad del servicio y presupuestos pre-job independientes. Componentes de presentación cliente aislados de `JobQuotePanel` profesional/admin; reutilizar las acciones seguras de presupuesto, pago, reprogramación, alcance, adicionales e informe. Extender el shell cliente con registro temporal de flujos enfocados.

**Tech Stack:** Next.js 15, React 19, TypeScript, CSS Modules, Lucide, Supabase cliente de sesión/RLS existente, Vitest y Testing Library.

---

## Condiciones de ejecución

- Continuar en el checkout actual porque depende de los cambios de Inicio aún no commiteados. Se creó la rama local `codex/customer-services`; no copiar ni descartar cambios previos, no hacer commits ni despliegues.
- Sin navegador: la instrucción explícita del usuario limita la validación a pruebas automáticas. QA visual queda bloqueada y documentada.
- Trabajos independientes pueden repartirse por archivos disjuntos; no editar simultáneamente archivos compartidos. Revisar especificación y luego calidad antes de entregar.

## Task 1: Proyección paginada de servicios

**Files:** Crear `features/customer/services-view-model.ts`, `lib/customer/services-model.ts`, `tests/unit/customer-services-model.vitest.test.ts`, `tests/unit/customer-services-loader.vitest.test.ts`.

1. Escribir y ejecutar pruebas rojas para deduplicación solicitud/trabajo/presupuesto, quote sustituido/vencido, cancelación, informe pendiente, visita sin pago y ausencia de equipo/fecha.
2. Definir `CustomerServiceSummary`: identidad estable, ids de request/job/quote, título/equipo/domicilio, estado/fase, visita confirmada, importe, acción contextual, fecha real y prioridad.
3. Consultar solicitudes por cliente y cursor con orden `created_at DESC,id DESC`; relacionar jobs por IDs de esa página, no por una página independiente de jobs. Enriquecer referencias propias y checkout canónico. No leer ni exponer datos internos.
4. Paginar presupuestos sin `request_id`, excluyendo `superseded`, con cursor independiente. Usar utilidades existentes de cursor; ligarlo a cliente, fuente y filtro.
5. Aplicar el filtro en servidor antes de devolver los resultados visibles. Si hace falta escanear páginas de solicitudes para resolver estados derivados, acotar el trabajo por llamada y devolver un cursor de continuación. Un lote vacío con continuación no debe declararse historial vacío.
6. Mantener `listCustomerJobsLive`, `listCustomerRequestsLive` y Home sin cambios de contrato.
7. Verificar con `node node_modules/vitest/vitest.mjs run tests/unit/customer-services-model.vitest.test.ts tests/unit/customer-services-loader.vitest.test.ts`; comprobar salida 0 después de observar rojo.

## Task 2: Lista y entrada de presupuesto

**Files:** Crear `components/customer/customer-services.tsx`, `components/customer/customer-services.module.css`, `components/customer/customer-quote-detail.tsx`, `app/api/customer/services/route.ts`, `app/(customer)/app/trabajos/loading.tsx`, `app/(customer)/app/trabajos/error.tsx`; modificar páginas de trabajos/presupuestos; pruebas `tests/unit/customer-services.vitest.test.tsx`, `tests/unit/customer-quote-detail.vitest.test.tsx` y límites de páginas existentes.

1. Pruebas rojas para filtros, todos los avisos pendientes, filas compactas, carga de anteriores sin duplicados, vacío real/resultado parcial y destinos válidos.
2. Mostrar título Servicios, filtros accesibles, acción contextual azul, En curso, Finalizados y cancelados cuando corresponda. Mantener todas las decisiones pendientes y controles de paginación independientes.
3. API GET privada rol cliente reutiliza el loader y valida filtro/cursors. Cambiar filtro reinicia cursores y consulta el conjunto correcto; ignorar respuestas antiguas tras cambio de filtro.
4. Presupuesto pre-job abre `/app/presupuestos?presupuesto=<uuid>`. Validar id; el detalle muestra la maqueta y abre una vista enfocada con `QuoteBreakdown`, vigencia y botón `Aceptar y solicitar profesional`.
5. Aceptar envía exclusivamente `{quoteId,expectedVersion}` al endpoint existente. En fallo ambiguo consultar nuevamente quote antes de reintentar. Si se aceptó, navegar a solicitud real sin cobrar ni inventar job. Presupuesto sustituido/vencido/revisión no permite aceptar.
6. Pruebas verdes del comportamiento, no solo existencia de mocks. Conservar la página de presupuestos guardados cuando no se solicita un presupuesto individual.

## Task 3: Detalle cliente y flujos reales

**Files:** Crear `components/customer/customer-service-detail.tsx`, `components/customer/customer-service-detail.module.css`, pruebas `tests/unit/customer-service-detail.vitest.test.tsx`; modificar `components/pricing/job-quote-panel.tsx` y solo la proyección cliente de `app/api/pricing/job/route.ts` si necesita metadatos reales. Extensión autorizada: props opcionales de presentación en `components/payments/payment-panel.tsx` para lectura sin cobro en estados terminales y coordinación de operación pendiente, con defaults que conservan el resto de consumidores.

1. Pruebas rojas de visita pagada, `confirmed` impago, informe pendiente, terminado, cancelado/disputado, retorno de pago y acciones de diagnóstico/adicionales.
2. Branch de presentación exclusiva `data.role === 'customer'`. No sustituir la UI profesional/admin. Pasar datos reales de problema, equipo, domicilio y contratos existentes.
3. Detalle ordinario con una acción principal según etapa y filas separadas. Flujos enfocados para presupuesto aceptado, pagos (`PaymentPanel` existente), reprogramación, diagnóstico/adicionales y revisión del informe.
4. Reprogramación envía payload estricto sin `idempotencyKey`: `{action:'request',jobId,...RescheduleRequest}`. Resolver error antes de limpiar formulario; respetar versión y motivo. Conservar fecha original hasta aceptación.
5. Conformidad usa `/api/jobs/confirm`, `recoverCommand` y `acknowledgeCommand`: `{jobId,decision:'confirmed'|'disputed',reason?,idempotencyKey}`. Solo cuando hay informe y estado pendiente. Recargar estado canónico después de éxito/fallo ambiguo; no mantener una UI de aceptación cuando el servidor ya completó/disputó.
6. Fotos solo con `/api/uploads/read` y UUID de adjunto. Manejar caducidad/fallo y volver a abrir; no usar URLs públicas permanentes. Resultado real admite `requires_second_visit`, no el enum viejo.
7. No mostrar calificación hasta completed; vínculo a review existente y garantía/continuidad sin coberturas ficticias. No mostrar chat/GPS/ETA inventado.
8. Ejecutar pruebas verdes más regresiones de `customer-job-visit-card`, `customer-closeout`, `marketplace-return`, `onsite-retry` y pricing API.
9. Cubrir recarga canónica diferida, cambio de identidad durante carga y preparación de pago: no reactivar decisiones viejas ni permitir salir con una redirección pendiente. «Garantías y reclamos» conduce al destino general existente, solo en estados aplicables; la ayuda contextual no está integrada y no se anuncia como disponible.

## Task 4: Navegación temporalmente enfocada

**Files:** Crear `components/app-shell/client-flow-context.tsx`, pruebas `tests/unit/client-focused-flow.vitest.test.tsx`; modificar `components/app-shell/client-app-shell.tsx`.

1. Probar rojo: navegación visible normal, oculta durante flujo, restaurada al cerrar/desmontar; múltiples registros no se liberan prematuramente.
2. Contexto con registro y limpieza por efecto; restauración segura. Integrar con selector de rutas existente, sin tocar sidebar legacy.
3. Dar foco al título del flujo al abrir y volver al disparador al cerrar. Escape/vuelta preservan intentos ambiguos y no interrumpen operaciones pendientes. Movimiento reducido y foco visible.
4. Ejecutar `client-focused-flow`, `client-app-shell` y `app-shell-integration`.

## Task 5: Revisión y entrega

1. Revisión independiente de cumplimiento; corregir desvíos. Luego revisión de calidad/seguridad y pruebas; corregir fallas importantes.
2. Ejecutar nuevamente todas las pruebas agregadas y regresiones focalizadas de Home, límites de página, shell y workflows; ejecutar `node node_modules/typescript/bin/tsc --noEmit`, lint de archivos tocados y `git diff --check`.
3. Actualizar `design-qa.md` conservando historial de Home y agregando fuentes de Servicios. Marcar `final result: blocked` por ausencia de captura/comparación gráfica autorizada, no por suponer defectos visuales.
4. Entregar estado exacto de implementación y verificación; no afirmar build, E2E, fidelidad gráfica o publicación si no se verificaron. No abrir Chrome ni publicar.

## Evidencia de implementación

- Tasks 1–4 implementadas; revisión independiente de cumplimiento: PASS, después de corregir cuatro bordes de recuperación, cambio de identidad, operación de pago y destino de garantías.
- Ejecución conjunta final: 26 archivos / 245 pruebas pasan, salida 0. Incluye modelo/loader/lista/quote/detalle/rutas/foco nuevos y regresiones de Home, Shell, páginas, pagos, pricing, retorno, visita, reintentos y cierre.
- TypeScript global, lint de todos los TS/TSX de esta etapa y `git diff --check`: salida 0.
- Un test anterior de la página de pagos no incluía `session.client` en su fixture. Se actualizó solamente ese mock para representar el contrato existente; no se cambió la página de pagos ni su comportamiento.
- No se ejecutaron suite unitaria completa, E2E, build de producción ni consultas productivas. La comparación gráfica continúa bloqueada por el límite explícito de usar solo pruebas automáticas.
- Revisión independiente de calidad: PASS, sin hallazgos Critical/Important. El revisor ejecutó 118 pruebas en 8 archivos, todas verdes. P3 no bloqueante y preexistente: `PaymentPanel` puede mostrar brevemente un botón de pago antes de terminar su consulta; el endpoint canónico reconoce pagos aprobados y no crea otro cobro. Deshabilitar durante esa carga es una mejora posterior, no una alteración del circuito financiero en esta etapa.
