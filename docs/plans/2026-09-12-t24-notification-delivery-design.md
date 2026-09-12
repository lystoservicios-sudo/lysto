# T24 — Entrega de notificaciones

Continuación de la hoja de ruta aprobada, después de T14. Implementación pendiente.

## Base existente

La migración `202608190007_outbox_and_idempotency.sql` ya tiene outbox privada, deduplicación por canal/destinatario/clave, claim con `SKIP LOCKED`, tokens de lease, ACK, FAIL y dead-letter. Sólo service-role puede consumirla. T08/T11 generan alertas de suspensión, invitaciones, postulaciones y decisiones. El endpoint genérico emit permanece cerrado; no se habilitará que un cliente elija mensajes o destinatarios arbitrarios.

La configuración de servidor existente prevé Resend (`NOTIFICATIONS_EMAIL_ENABLED`, `RESEND_API_KEY`). El panel de notificaciones es demostrativo. No hay dispatcher duradero ni recepción externa aprobada.

## Decisiones de implementación

1. Reutilizar claim/ack/fail y añadir evidencia de entrega con snapshot inmutable del destinatario y contenido antes del primer intento. Reintentar el mismo evento con la misma clave y contenido; un ACK viejo no puede cerrar el lease de otro worker.
2. In-app: insertar una notificación identificada por el evento y confirmar su procesamiento dentro de una transacción. Email: adapter HTTP de Resend con clave por evento, timeout acotado y errores sanitizados. Los tests nunca heredan credenciales reales; recepción local en Mailpit y pruebas del contrato del proveedor.
3. Resend conserva sus claves de idempotencia durante 24 horas. Una respuesta incierta fuera de esa ventana requiere revisión; no reenviar automáticamente como si la deduplicación fuera ilimitada. No prometer exactly-once externo.
4. Revalidar destinatario, cuenta y acceso al recurso antes de entregar. En invitaciones comprobar estado actual, vigencia y token contra el hash; cancelar/consumir una invitación impide un nuevo envío. Documentar la carrera inevitable si la cancelación ocurre después de que el proveedor ya aceptó el mensaje.
5. Endpoint interno POST con secreto específico, comparación segura, cuerpo limitado, lote pequeño y duración máxima. Esperar la ejecución del lote antes de responder. Preparar operación por scheduler duradero; la configuración efectiva del hosting, DNS y recepción del proveedor se acredita en T36/D06.
6. Plantillas con URLs del origen configurado y rutas permitidas. Ninguna dirección de destino, URL externa, HTML o texto libre elegido por el cliente. Contenido mínimo y sin documentos, tokens en logs ni datos privados innecesarios. Plantillas versionadas; no cambiar el contenido de un intento ya sellado.
7. Conectar eventos a transacciones actuales y dejar extensiones explícitas para las tareas de agenda, pagos, cierre y reclamos. No duplicar productores existentes T08/T11. WhatsApp seguirá como tarea manual auditada y no se marcará enviado por generar un enlace o plantilla.
8. Panel conectado para operaciones/owner: backlog, leases, fallos y dead-letter, paginación y reintento con motivo/versiones. Nunca mostrar payload privado o tokens. Diferenciar mensaje aceptado por proveedor de entrega al buzón.

## Aceptación

Pruebas de dos workers, fallo antes de envío, crash tras aceptación del proveedor antes del ACK, lease recuperado, intentos agotados, snapshot estable, destinatario revocado, invitación cancelada, rechazo de emisión arbitraria y entrega in-app/email al destinatario local. Mantener pendientes explícitos para DNS/SPF/DKIM/DMARC, remitente, scheduler y recepción real del proveedor.

## Fuentes comprobadas

- [Resend: claves de idempotencia](https://resend.com/docs/dashboard/emails/idempotency-keys): soporte en envío de emails, ventana de 24 horas y rechazo de contenido distinto para la misma clave.
- [Resend: enviar email](https://resend.com/docs/api-reference/emails/send-email): contrato HTTP y respuesta con ID del proveedor.
- [Mailpit: API](https://mailpit.axllent.org/docs/api-v1/) y [envío HTTP](https://mailpit.axllent.org/docs/usage/sending-messages/): recepción local a través de `/api/v1/send`.
