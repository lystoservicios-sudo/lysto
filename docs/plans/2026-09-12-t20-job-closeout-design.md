# T20 — Cierre técnico atómico

El profesional cierra únicamente un trabajo propio en `in_progress`, después de un diagnóstico presencial aceptado. El comando deriva la identidad de la sesión y valida que el equipo pertenece a la solicitud, que no quedan adicionales propuestos o aceptados sin pago y que entre una y cinco fotos posteriores pertenecen al trabajo, al profesional y al pipeline verificado.

Una transacción crea el informe final inmutable, el registro histórico del equipo, el comprobante y el cambio a `completed_pending_customer_confirmation`. Una falla en cualquier validación o escritura revierte todo. El cliente conserva una acción separada para expresar conformidad.

Cada envío lleva UUID de idempotencia y una huella del contenido normalizado. Repetir la misma clave devuelve el resultado confirmado. Repetir el mismo contenido con otra clave recupera el informe existente. Cambiar contenido después del cierre devuelve conflicto y no sobrescribe el informe.

Los estados `pending_part`, `requires_second_visit` y `not_resolved` crean seguimiento persistente con vencimiento. El informe conserva el resultado real y no declara resuelto el trabajo. Una enmienda futura deberá ser una operación auditada separada.

La interfaz conserva borrador y comando pendiente en la sesión del navegador. Después de un timeout recarga el estado canónico; si el servidor confirmó, muestra el informe, y si no, reusa la misma clave al reintentar.
