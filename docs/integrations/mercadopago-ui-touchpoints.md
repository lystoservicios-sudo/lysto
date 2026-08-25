# Puntos de integración UI — Mercado Pago diferido

**Fecha:** 2026-08-25

**Estado:** inventario de interfaz; integración diferida a la etapa final

La interfaz Cliente no crea preferencias, IDs de proveedor, cobros, devoluciones, comprobantes ni estados aprobados. Todos los puntos financieros deben compartir un único `PaymentDeferredPanel` —o una composición equivalente centralizada— con el texto: “La integración de Mercado Pago se incorporará en la etapa final”.

| Ruta | Componente UI | Acción futura | Datos requeridos | Contrato esperado |
|---|---|---|---|---|
| `/app/solicitar/aire-acondicionado` | Paso `payment` de `AirConditioningWizard` + `PaymentDeferredPanel` | Crear preferencia e iniciar checkout | `requestId`, opción elegida, importe, moneda, identidad del cliente, URL de retorno | El servidor entrega un identificador/URL de checkout; la UI nunca marca el pago como aprobado por respuesta local. |
| `/app/solicitudes/[id]` | `CustomerRequestDetail` + `PaymentDeferredPanel` | Pagar o reintentar una solicitud pendiente | `requestId`, estado de solicitud, importe preliminar vigente, estado de pago | La disponibilidad surge del estado persistido; la aprobación llega por confirmación del backend/webhook. |
| `/app/trabajos/[id]` | Acciones del trabajo + `PaymentDeferredPanel` | Aprobar un importe adicional y consultar comprobante | `jobId`, `paymentId`, concepto, importe, estado, referencia de comprobante autorizada | Las acciones financieras quedan deshabilitadas hasta recibir capacidades explícitas del backend. |
| `/app/pagos` | Hero, ayuda, estado vacío/diferido + `PaymentDeferredPanel` | Listar movimientos, abrir comprobante y solicitar devolución | movimientos paginados del cliente, importes, fechas, estados, referencias seguras y capacidades | La lista consume registros reales del usuario; sin fixtures aprobados ni movimientos inventados. |
| `/app/garantias` | Detalle futuro de reclamo + `PaymentDeferredPanel` cuando corresponda | Mostrar el estado de una devolución vinculada a calidad/garantía | `claimId`, `paymentId`, importe elegible, estado y motivo | El reclamo no ejecuta la devolución desde la vista; solo presenta acciones habilitadas por el backend. |

## Estado de esta tanda

- Los fixtures Cliente mantienen `integrationState: 'deferred'` y `movements: []`.
- `PaymentDeferredPanel` quedó implementado como superficie central en Tanda 2 y debe reutilizarse en Tanda 6.
- El wizard se detiene en pago: no expone matching, profesional confirmado ni trabajo creado sin una confirmación persistida.
- Los CTAs existentes no se conectan a `alert()`, respuestas falsas ni transiciones locales de pago.
- Los contratos actuales bajo `lib/payments`, `lib/use-cases`, `lib/data-access` y `lib/config` se conservaron sin cambios. Su existencia no implica que la UI Cliente esté integrada.

## Condiciones para habilitar la etapa final

1. Definir una API de servidor autenticada para preferencias, estado y capacidades por pago.
2. Confirmar idempotencia y firma de webhooks antes de reflejar estados aprobados.
3. Resolver URLs de retorno, errores recuperables y expiración de preferencias.
4. Verificar que comprobantes y devoluciones pertenezcan al cliente autenticado.
5. Reemplazar el panel diferido únicamente después de pruebas sandbox y de accesibilidad del checkout.
