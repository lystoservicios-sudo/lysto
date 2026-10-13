# Inicio cliente: maqueta aprobada y carrusel

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar en `/app` la maqueta aprobada con accesos deslizables a los siete problemas/servicios reales y movimiento accesible.

**Architecture:** Reutilizar el App Shell y el selector operativo existentes, sin modificar el ciclo de contratación ni crear una app separada. Extender únicamente la proyección de lectura de Inicio para mostrar un equipo/cuidado y el último trabajo completado cuando existan. Los accesos llevan a las rutas existentes; el único cambio en Pedir es recibir una selección inicial validada y editable.

**Tech Stack:** Next.js 15, React 19, TypeScript, CSS Modules, iconos Lucide existentes, Vitest/Testing Library.

---

## Referencia y límites

- Referencia aprobada: `C:/Users/quime/.codex/generated_images/01a113b5-c26c-7343-bd9a-4e894c9a32af/exec-cc001338-d7a4-4b04-be3c-d13ead375687.png`.
- Orden: título Inicio, acción contextual, carrusel, orientación, Tu hogar, Último servicio y ayuda. Sin saludo por nombre ni datos de ejemplo en producción.
- Conservar todas las decisiones importantes: primera como acción destacada y las restantes como filas compactas. No esconder pagos, confirmaciones o soporte pendiente por motivos visuales.
- Conservar navegación `Inicio · Servicios · Pedir · Hogar · Más` y sus reglas de ocultación. Hogar y Más siguen con el contenido que ya tienen.
- No desplegar, hacer commits, cambiar esquema, políticas, pagos ni datos de producción. Preservar cambios previos del repositorio.

## Task 1: Carrusel y apertura de Pedir

**Files:** `components/customer/home-issue-carousel.tsx`, `components/customer/customer-home.module.css`, `features/service-request/air-conditioning-wizard.tsx`, `app/(customer)/app/solicitar/aire-acondicionado/page.tsx`, pruebas de carrusel y solicitud.

1. Agregar pruebas que fallen para los siete enlaces `?problema=<slug>`, teclado y selección inicial editable; entrada inválida no selecciona un problema.
2. Ejecutar Vitest y confirmar fallas de comportamiento faltante.
3. Renderizar los siete valores de `AIR_CONDITIONING_ISSUES`, con iconos de 24 px en superficies de 48–56 px, etiquetas legibles y áreas táctiles mayores de 44 px. Scroll horizontal nativo, ajuste al soltar, sin avance automático. Teclado con flechas/Home/End y navegación normal con Tab.
4. Validar `problema` en el servidor y pasar `initialIssue` al wizard. Empezar en su paso habitual, con opción marcada que el usuario pueda cambiar.
5. Ejecutar nuevamente las pruebas del carrusel y del wizard.

## Task 2: Resúmenes con datos reales

**Files:** `features/customer/home-view-model.ts`, `lib/customer/home-model.ts`, pruebas del selector y de la carga.

1. Agregar pruebas fallidas para equipo real, recomendación vigente, último trabajo completado, ausencia de datos y degradación parcial.
2. Usar servicios existentes con sesión cliente, sin nuevas tablas ni permisos. Proyectar identificador/nombre del equipo y recomendación; no inferir vencimientos, garantías ni disponibilidad de informe.
3. Mostrar el último servicio solo para trabajos realmente completados; usar su fecha real y el enlace de detalle existente. No confundir cancelación con finalización ni conformidad pendiente con servicio completado.
4. Ejecutar pruebas de selector/carga y conservar deduplicación, prioridades operativas y preferencias de invitaciones.

## Task 3: Pantalla y movimiento

**Files:** `components/customer/customer-home.tsx`, `components/customer/customer-home.module.css`, `app/(customer)/app/loading.tsx`, pruebas de Home.

1. Agregar/actualizar pruebas de la jerarquía, destinos y estados sin actividad/error antes de implementar.
2. Recrear la maqueta con título visible, tarjeta azul compacta, filas simples y miniatura fotográfica del equipo; preservar el logo real existente, evitando cambios globales ajenos a Inicio.
3. Añadir presión leve al tocar y entrada discreta de 180–220 ms. Sin pulsación continua del botón Pedir. Respetar `prefers-reduced-motion`, foco y contraste.
4. Asegurar que el contenido final sea alcanzable por encima de la navegación fija, sin desbordamiento horizontal del documento.

## Task 4: Verificación y entrega

1. Ejecutar pruebas focalizadas y luego la suite unitaria, TypeScript, ESLint de los archivos tocados y `git diff --check`.
2. Verificar con navegador: anchos 360/390/430 y escritorio; carrusel, teclado, acceso preseleccionado, estados nuevo/decisión/visita/error y movimiento reducido. No usar información personal real para capturas.
3. Comparar captura y referencia en una misma imagen normalizada; corregir diferencias importantes y registrar `design-qa.md`.
4. Retirar cualquier ruta temporal de captura y entregar captura real de la implementación junto con el resultado de las verificaciones. No declarar publicación en producción.

### Resultado de esta ejecución

Implementados Tasks 1–3 y verificaciones automáticas focalizadas de Task 4. El navegador integrado falló; el usuario rechazó expresamente usar Chrome y limitó la verificación a pruebas automáticas. No se creó una ruta de captura ni una app separada. La comparación gráfica y pruebas táctiles quedan pendientes en `design-qa.md`; no se reemplazan por una maqueta presentada como captura. No hubo cambios de datos/esquema, commits ni despliegue.
