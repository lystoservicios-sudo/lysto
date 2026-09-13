# T18: excepciones financieras y sustitución

## Decisiones de diseño

- Un reintegro se solicita primero en `private.payment_refund_requests`. La suma solicitada, en proceso o exitosa reserva saldo bajo el bloqueo de la fila del pago.
- El worker usa el UUID estable de la solicitud como `X-Idempotency-Key`. Mercado Pago documenta ese encabezado como obligatorio para `POST /v1/payments/{id}/refunds` y permite omitir `amount` en un reintegro total. Verificación realizada el 12-09-2026 contra la [referencia oficial](https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-api-payments/create-refund/post).
- Una respuesta al `POST` no alcanza. El worker consulta el reintegro, consulta el pago canónico, aplica esa observación al ledger y recién entonces finaliza la solicitud local.
- Timeout, respuesta ambigua, diferencia de identidad o imposibilidad de aplicar el dato canónico conservan la operación en reintento con la misma clave. Un rechazo definitivo del proveedor termina en `failed`.
- Cancelar o sustituir con un checkout existente abre `financial_exception_cases` y pone el checkout en revisión. Finanzas debe demostrar que la preferencia dejó de aceptar pagos y que cualquier cobro quedó totalmente reintegrado.
- Una sustitución crea una solicitud y un trabajo nuevos enlazados. El checkout, vendedor, importes y observaciones del trabajo original permanecen inmutables.
- D06 sigue pendiente. Hasta que producto, operaciones y finanzas aprueben penalidades y plazos, el software no calcula retenciones ni completa casos por silencio.

## Límites de autoridad

`operations` abre y resuelve casos operativos. `finance` solicita reintegros, cierra preferencias con evidencia canónica y autoriza la conciliación. Ambos requieren AAL2. El worker interno usa una credencial distinta y sólo recibe el profesional, checkout y monto del reclamo que mantiene un lease vigente.
