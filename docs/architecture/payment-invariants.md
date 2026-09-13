# Invariantes de pagos marketplace

## Identidad congelada

Cada checkout referencia un trabajo, cliente, profesional, cuenta receptora, ambiente, moneda, total, comisión y neto inmutables. El navegador sólo envía el trabajo o adicional; la base deriva el resto del presupuesto aceptado, el profesional confirmado y la cuenta vinculada. Un cambio de cualquiera de esas identidades exige revisión y nunca crea otro cobro por fallback.

## Creación y reintentos

La intención, el payload y la clave de idempotencia se persisten antes de llamar a Mercado Pago. Un lease acotado serializa creaciones. Ante timeout, el mismo checkout y la misma clave se consultan o reintentan; un resultado incierto no autoriza una segunda intención cobrable.

Renovar un enlace sólo modifica la preferencia existente. La conciliación y el claim ocurren antes de la red; la llamada al proveedor ocurre sin una transacción abierta; el resultado y su evento se confirman juntos. Si el resultado remoto es incierto, el checkout queda en `review`.

## Webhook y ledger

La firma habilita la consulta canónica al proveedor, pero no aprueba dinero por sí sola. Se validan referencia, cuenta receptora, ARS, ambiente, importe y comisión contra el snapshot. Cada evento aplicado y todos sus efectos se confirman en una sola transacción. Duplicados son idempotentes, actualizaciones antiguas no retroceden estado y pagos múltiples o regresiones pasan a revisión.

Las observaciones canónicas son la autoridad. `payments` es una proyección operativa. `review`, `charged_back`, `refunded` y `partially_refunded` bloquean cualquier acción que presuponga un pago aprobado.

## OAuth y secretos

El estado OAuth está ligado a usuario, profesional y sesión; se consume una vez. Token test y live nunca se mezclan. Credenciales cifradas y leases se acceden sólo con la conexión privada del servidor, con pool y tiempos máximos acotados.

## Recuperación

Se pueden deshabilitar nuevos checkouts conservando webhook y conciliación. Nunca se revierten tablas ni eventos financieros para recuperar servicio. Los casos inciertos quedan en revisión hasta consultar la fuente canónica.
