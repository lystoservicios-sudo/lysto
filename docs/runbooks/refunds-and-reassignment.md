# Reintegros, cancelaciones y sustitución

1. Operaciones abre el caso desde **Admin > Pagos split**, documentando trabajo, versión y motivo.
2. Finanzas consulta el checkout en Mercado Pago. Si el enlace puede cobrar, usa **Cerrar enlace para cancelación**. La aplicación busca pagos primero, vence la preferencia y vuelve a consultarla antes de guardar evidencia.
3. Si hubo cobro, finanzas solicita el monto aprobado. No repetir con otra clave: el worker reusa la clave guardada y consulta al proveedor después de resultados inciertos.
4. El caso sólo puede pasar a `ready` cuando todos los enlaces están cerrados y todo pago observado está completamente reintegrado. Adjuntar un resumen de conciliación concreto.
5. Operaciones resuelve. En cancelación libera la capacidad y conserva el historial. En sustitución crea otro trabajo enlazado, que vuelve a la cola de asignación.

Si aparece `review`, `charged_back`, un pago tardío, dos pagos o un timeout, detener nuevos cobros y mantener el caso abierto. Conciliar por el identificador canónico del pago. Nunca editar estados o beneficiarios con SQL ni marcar un reintegro por una captura de pantalla.

El worker se habilita con `REFUND_WORKER_ENABLED=true` y un secreto independiente de 32 a 128 caracteres. Ejecutar lotes de hasta cinco. Ante una caída, los leases vencen y el siguiente lote retoma la misma operación idempotente.
