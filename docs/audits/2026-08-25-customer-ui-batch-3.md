# Auditoría UI Cliente — Tanda 3

**Fecha:** 2026-08-25

**Alcance:** CUS-05, CUS-06 y CUS-07

**Estado:** checkpoint listo para revisión

## Rutas implementadas

| ID | Ruta | Resultado |
|---|---|---|
| CUS-05 | `/app/trabajos` | Tabs controladas para activos, por confirmar y finalizados; conteos, tarjetas y estado vacío por filtro. |
| CUS-06 | `/app/trabajos/[id]` | Resolución real del parámetro, not-found, resumen, tracker de ocho etapas, parte actual, comparación técnica, profesional, ETA, tracking y chat visual. |
| CUS-07 | `/app/trabajos/[id]/review` | Resolución real del parámetro, elegibilidad, ratings accesibles, resolución, intención de recompra, comentario y envío condicionado a persistencia. |

Las tres rutas permanecen dentro del área de contenido de `AppShell`. No agregan navegación global ni recuperan el menú horizontal eliminado.

## Decisiones de producto

- El listado organiza trabajos por la decisión que necesita el cliente, no como tabla administrativa.
- El detalle usa un “parte de seguimiento”: estado, responsable y próximo paso se leen juntos.
- Las ocho etapas son: servicio confirmado, profesional asignado, en camino, llegada, diagnóstico, presupuesto, trabajo y cierre.
- La orientación inicial y el diagnóstico profesional se muestran con fuente y momento diferenciados.
- Un cambio de presupuesto muestra importe anterior, nuevo, diferencia y motivo.
- Aprobar o rechazar queda deshabilitado si no existen callbacks de servidor.
- Tracking y chat declaran que no hay mapa ni canal conectados; no inventan coordenadas o mensajes.
- El formulario de review puede completarse localmente, pero no enviarse sin persistencia.
- Un trabajo ya calificado no expone un segundo formulario.

## Accesibilidad

- Tabs con `tablist`, `tab`, `tabpanel`, selección y navegación con flechas/Home/End.
- Tracker como lista ordenada con `aria-current="step"`.
- Ratings como `radiogroup`/`radio`, selección visible y navegación con flechas/Home/End.
- Preguntas binarias agrupadas semánticamente.
- Estados pending bloquean doble activación mediante estado y referencia sincrónica.
- Loading, empty, error y not-found tienen mensajes y próximos pasos seguros.
- Botones no conectados permanecen deshabilitados con explicación visible.

## Verificación visual

Se probaron las tres rutas en 320, 375, 768, 1024 y 1440 px: 15 combinaciones. En todas, `body.clientWidth` y `body.scrollWidth` coinciden después de corregir los mínimos de las columnas y el grupo de estrellas.

También se verificó en navegador real:

- cambio de pestañas y conteos;
- detalle activo y detalle pendiente de aprobación;
- ocho etapas y contenido actual;
- aprobación deshabilitada;
- chat y mapa declarados como no conectados;
- review completa manteniendo envío deshabilitado;
- sidebar como única navegación de rutas;
- ruta desconocida con estado específico.

La consola de la aplicación no mostró errores de React. El entorno de desarrollo sí solicita un `favicon.ico` inexistente y emite la advertencia conocida de Next.js sobre `scroll-behavior`; ambos quedan fuera del alcance funcional de esta tanda.

## Datos y límites

- Las vistas consumen `customerDemoFixtures`, identificadas explícitamente como demostración.
- Ninguna ruta importa `@/lib/mock/lysto-data`.
- No se mutan trabajos ni reviews localmente como fuente de verdad.
- No se crean pagos, comprobantes, ubicaciones, mensajes, casos de calidad ni estados operativos.
- Los movimientos de pago permanecen vacíos.

## Pendiente de integración

1. Consulta autenticada de trabajos del cliente y capacidades por estado.
2. Eventos persistidos del tracker y ETA informada por backend.
3. Canal real de chat y proveedor de ubicación, con privacidad definida.
4. Acción idempotente para aprobar o rechazar cambios de presupuesto.
5. Persistencia idempotente de una única review por trabajo.
6. Apertura de calidad sólo después de una review confirmada por servidor.
