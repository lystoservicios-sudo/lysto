# Puntos de integración UI — Mercado Pago diferido

**Fecha:** 2026-08-25

**Estado:** inventario de interfaz; integración diferida a la etapa final

La interfaz Cliente no crea preferencias, IDs de proveedor, cobros, devoluciones, comprobantes ni estados aprobados. Todos los puntos financieros deben compartir un único `PaymentDeferredPanel` —o una composición equivalente centralizada— con el texto: “La integración de Mercado Pago se incorporará en la etapa final”.

| Ruta | Componente UI | Acción futura | Datos requeridos | Contrato esperado |
|---|---|---|---|---|
| `/app/solicitar/aire-acondicionado` | Paso `payment` de `AirConditioningWizard` + `PaymentDeferredPanel` | Crear preferencia e iniciar checkout | `requestId`, opción elegida, importe, moneda, identidad del cliente, URL de retorno | El servidor entrega un identificador/URL de checkout; la UI nunca marca el pago como aprobado por respuesta local. |
| `/app/solicitudes/[id]` | `CustomerRequestDetail` + `PaymentDeferredPanel` | Pagar o reintentar una solicitud pendiente | `requestId`, estado de solicitud, importe preliminar vigente, estado de pago | La disponibilidad surge del estado persistido; la aprobación llega por confirmación del backend/webhook. |
| `/app/trabajos/[id]` | `CustomerJobDetail` + `PaymentDeferredAction` | Reservar una diferencia aprobada o abrir un comprobante | `jobId`, `paymentId`, concepto, importe, estado, capacidades y referencia segura | La aprobación y el pago son operaciones separadas; ninguna cambia el estado localmente ni se habilita sin contrato servidor. |
| `/app/equipos/[id]` | `ServiceHistoryList` | Abrir el comprobante de un servicio histórico | `equipmentId`, `jobId`, pertenencia del cliente y referencia segura del comprobante | La acción aparece sólo si el backend confirma disponibilidad y autorización. |
| `/app/pagos` | `CustomerPaymentsCenter`, `PaymentDeferredPanel` y `PaymentMovementCard` | Listar movimientos, abrir comprobante y solicitar devolución | movimientos paginados del cliente, importes, fechas, estados, referencias seguras y capacidades | La lista consume registros reales del usuario; el estado vacío no usa fixtures ni movimientos inventados. |
| `/app/garantias` | `WarrantyCaseCard` + `PaymentDeferredAction` | Mostrar o solicitar una devolución vinculada a calidad/garantía | `claimId`, `paymentId`, importe elegible, estado, motivo y capacidad | El reclamo no ejecuta la devolución desde la vista; la acción permanece inactiva hasta una confirmación del backend. |

## Estado al cerrar la Tanda 6

- Los fixtures Cliente mantienen `integrationState: 'deferred'` y `movements: []`.
- `PaymentDeferredPanel` y `PaymentDeferredAction` centralizan la política, el texto y las acciones inactivas para pagar, reintentar, reservar, consultar movimientos, ver comprobante y solicitar devolución.
- El wizard se detiene en pago: no expone matching, profesional confirmado ni trabajo creado sin una confirmación persistida.
- El detalle de trabajo muestra cambios de presupuesto, reserva adicional y comprobante como acciones separadas y deshabilitadas.
- Garantías muestra la futura devolución como acción deshabilitada; no cambia el reclamo ni crea un movimiento.
- `/app/pagos` usa el estado financiero vacío del fixture Cliente; no importa el conjunto global ni fabrica movimientos para completar la vista.
- La review de Tanda 3 no dispara pagos, devoluciones ni casos de calidad desde el estado local.
- Los CTAs existentes no se conectan a `alert()`, respuestas falsas ni transiciones locales de pago.
- Los contratos actuales bajo `lib/payments`, `lib/use-cases`, `lib/data-access` y `lib/config` se conservaron sin cambios. Su existencia no implica que la UI Cliente esté integrada.

## Condiciones para habilitar la etapa final

1. Definir una API de servidor autenticada para preferencias, estado y capacidades por pago.
2. Confirmar idempotencia y firma de webhooks antes de reflejar estados aprobados.
3. Resolver URLs de retorno, errores recuperables y expiración de preferencias.
4. Verificar que comprobantes y devoluciones pertenezcan al cliente autenticado.
5. Reemplazar el panel diferido únicamente después de pruebas sandbox y de accesibilidad del checkout.

## Contrato mínimo de capacidades

La futura API debe responder por cada operación qué capacidades están disponibles (`canPay`, `canRetry`, `canViewReceipt`, `canRequestRefund`, `canReserveAdjustment`) junto con el estado persistido y referencias seguras. La UI no debe derivar una aprobación desde el click, una URL de retorno ni un importe visible.
