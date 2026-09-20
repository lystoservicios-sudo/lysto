# Mercado Pago Checkout Pro vía Orders — diseño

## Objetivo

Crear los cobros nuevos de Lysto con Checkout Pro vía Orders API y Split 1:1, sin cambiar los cobros históricos basados en Preferences ni habilitar pagos reales antes de la aceptación con credenciales de prueba.

## Alcance y decisión

La migración se limita al módulo Mercado Pago. Se conserva OAuth de los profesionales y el ledger local. Se añade una ruta de proveedor para Orders y se mantienen las rutas de lectura y conciliación de Preferences para registros previos. No se modifica el resto de la aplicación ni se alteran importes aceptados.

Para Orders, el servidor usa el access token OAuth del profesional y envía el importe y `marketplace_fee` calculados exclusivamente desde el checkout persistido. La respuesta se valida antes de guardar `order_id` y `checkout_url`. El identificador de orden se almacena separadamente del `preference_id`; el tipo de checkout persistido determina qué API usar en cada operación posterior.

## Flujo de cobro

1. La misma autorización actual comprueba cliente, trabajo, técnico, monto, comisión y ambiente.
2. Una clave de idempotencia estable protege la creación de la order. Ante resultado de red incierto, el checkout queda en revisión: nunca se emite a ciegas una segunda order pagable.
3. La URL de checkout se entrega al cliente sólo después de validar que la order corresponde al vendedor, importe, referencia y ambiente previstos. El navegador nunca confirma el pago por sí solo.
4. Las notificaciones Orders se validan criptográficamente y se consulta la order canónica. El ledger aplica los mismos controles de identidad, importe, comisión, monotonicidad e idempotencia antes de cambiar el estado.
5. La conciliación manual consulta Orders para cobros nuevos y Payments/Preferences para cobros históricos.
6. La cancelación y los reembolsos usan el endpoint que corresponde al tipo de checkout. Una order pendiente o resultado ambiguo impide renovar el enlace automáticamente; se exige conciliación o revisión. No se crean cobros duplicados.

## Compatibilidad y datos

La migración de esquema es aditiva: nuevos campos para `order_id` y URL de Orders y un discriminante del flujo. No se eliminan `preference_id`, URLs existentes ni pagos históricos. La transición se realiza sobre cobros nuevos; un cobro ya creado no cambia de tipo. Los tipos generados y consultas administrativas se actualizan para mostrar ambos flujos.

## Pruebas y activación

Primero se agregan pruebas fallidas para payload, validación de respuesta, idempotencia, eventos, reconciliación, cancelación, reembolso y coexistencia con Preferences. Luego se implementa el cambio mínimo por etapas. Se ejecutan pruebas de unidad, integración con base local, lint, typecheck y build. La aceptación contra Mercado Pago usa sólo credenciales de prueba y cuenta de vendedor/comprador de prueba; comprueba split, webhooks, estados y reembolsos. `PAYMENTS_PROVIDER` permanece desactivado para producción hasta completar esa aceptación. Los secretos se cargan en el gestor de secretos, nunca en el repositorio ni en el chat.

## Fuentes

- [Checkout Pro vía Orders](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-orders/create-order)
- [Notificaciones Orders](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-orders/notifications)
- [Cancelación de Orders](https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-pro/cancel-order/post)
- [Reembolsos de Orders](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-orders/refunds-cancellations)
