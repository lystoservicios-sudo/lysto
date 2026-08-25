# Auditoría UI Cliente — Tanda 6

**Fecha:** 2026-08-25

**Alcance:** CUS-12 y puntos financieros de CUS-02, CUS-04, CUS-06 y CUS-11

**Estado:** verificación final superada

## Ruta implementada

| ID | Ruta | Resultado |
|---|---|---|
| CUS-12 | `/app/pagos` | Centro de protección con explicación, integración pendiente, historial vacío, proceso y ayuda. |

La ruta permanece dentro del contenido de `AppShell`. No se modificaron el sidebar, la barra superior ni la configuración de navegación.

## Decisiones de producto

- La pantalla explica el circuito futuro antes de mostrar movimientos.
- El historial financiero permanece vacío porque no existen registros confirmados para la vista Cliente.
- No se muestra filtro de fecha mientras la lista esté vacía; un control inactivo no aporta una tarea real.
- `PaymentDeferredPanel` conserva el presupuesto del wizard y ahora soporta contextos tipados.
- `PaymentDeferredAction` centraliza pagar, reintentar, reservar diferencia, consultar movimientos, comprobante y devolución.
- Trabajos separa la decisión sobre un presupuesto de la futura reserva del importe.
- Garantías muestra la futura devolución sin ejecutar ni confirmar una operación.
- `PaymentMovementCard` queda preparado para datos reales, pero no se alimenta con fixtures productivos.

## Honestidad funcional

- No se crean preferencias, IDs, webhooks, cobros, aprobaciones, devoluciones ni comprobantes.
- No se llama a Mercado Pago, Supabase, `fetch` ni APIs desde los componentes presentacionales.
- Todos los botones financieros permanecen deshabilitados.
- El wizard sigue detenido en pago y no genera matching o trabajo.
- Los movimientos del fixture Cliente continúan como arreglo vacío.
- No se expone un número completo de tarjeta ni una referencia sensible.

## Accesibilidad y responsive

- El proceso usa una lista ordenada con cuatro etapas textuales.
- Los estados no dependen del color.
- Los controles financieros usan `disabled` nativo y explicación visible.
- Loading incluye estado accesible; error usa alerta y reintento.
- La ayuda real navega al centro de ayuda; el chat continúa deshabilitado.
- El layout es mobile-first y usa grillas sólo desde tablet/desktop.

## Componentes reutilizados

- `PageScaffold`, `PaymentDeferredPanel`, `InfoNotice`, `EmptyState`, `LoadingSkeleton`, `ErrorState`, `SupportBanner` y `ChatSupportBanner`.

## Componentes creados o extendidos

- `CustomerPaymentsCenter`.
- `PaymentTrustHero`.
- `PaymentProcessStrip`.
- `PaymentMovementCard`.
- `PaymentDeferredAction` dentro del módulo central de pago diferido.

## Inventario de integración

El contrato detallado de rutas, datos y capacidades futuras está en `docs/integrations/mercadopago-ui-touchpoints.md`.

## Verificación final

- 14/14 rutas Cliente presentes.
- 124/124 pruebas de dominio y 140/140 pruebas Vitest correctas.
- Build de producción correcto con 77 rutas generadas.
- Sin desborde horizontal entre 320 y 1440 px en `/app/pagos`.
- Revisión independiente sin hallazgos críticos ni importantes.

## Pendientes funcionales

1. API autenticada para crear preferencias y consultar estados/capacidades.
2. Confirmación servidor/webhook idempotente.
3. Checkout sandbox con retorno, expiración y recuperación de errores.
4. Comprobantes seguros vinculados al cliente autenticado.
5. Flujo de devolución con elegibilidad y auditoría.
6. Paginación y filtro de fecha cuando existan movimientos reales.
