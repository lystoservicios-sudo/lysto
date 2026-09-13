# Entrega de notificaciones

## Alcance y garantías

El dispatcher consume `private.outbox_events` por lotes de hasta cinco. Cada claim tiene lease y token de fencing. Antes de enviar guarda un snapshot inmutable del destinatario, versión de plantilla y contenido. Los reintentos reutilizan ese snapshot y la clave `lysto-outbox-<uuid>`.

Una notificación interna y su ACK se confirman en la misma transacción. En email, `provider_accepted` significa que Resend aceptó la solicitud; no prueba entrega al buzón. La clave de idempotencia externa dura 24 horas y Lysto usa un límite de 23. Después de ese límite el evento requiere intervención y no se reenvía automáticamente.

El worker vuelve a validar cuenta, permiso, propiedad y estado del recurso antes de cada intento. Una invitación cancelada, vencida o consumida se suprime. Existe una carrera inevitable si se cancela después de que el proveedor ya aceptó el correo.

## Configuración

Variables exclusivas del servidor:

- `NOTIFICATIONS_EMAIL_ENABLED=true`
- `RESEND_API_KEY`
- `NOTIFICATIONS_EMAIL_FROM`, remitente verificado como `Lysto <avisos@dominio>`
- `OUTBOX_WORKER_ENABLED=true`
- `OUTBOX_WORKER_SECRET`, 32 a 128 caracteres base64url aleatorios
- `NEXT_PUBLIC_APP_URL`, origen HTTPS sin path, credenciales, query ni fragmento

No habilitar email hasta acreditar remitente, recepción sandbox, SPF, DKIM y DMARC. Los tests fuerzan email y worker a `false` y eliminan credenciales heredadas. WhatsApp permanece manual; crear un texto o enlace no equivale a enviarlo.

## Scheduler

El scheduler debe ejecutar el worker cada minuto. La configuración adoptada para el plan actual usa Supabase Cron con `pg_cron` y `pg_net`: hace `GET /api/internal/outbox`, envía `Authorization: Bearer <CRON_SECRET>` y la ruta procesa un lote de cinco. La URL y los secretos viven en Supabase Vault; nunca se escriben en la migración ni en `cron.job.command`. El Preview protegido agrega el header `x-vercel-protection-bypass` desde un secreto separado de Vault. La alternativa operativa es `POST /api/internal/outbox` con `Authorization: Bearer <OUTBOX_WORKER_SECRET>`, `Content-Type: application/json` y `{"batchSize":5}`. Cada request tiene un máximo de 60 segundos. T36 debe aportar ejecuciones consecutivas, respuesta HTTP y alertas del scheduler.

Vercel Hobby sólo permite cron diarios y rechaza una expresión por minuto durante el despliegue. Por eso el repositorio no declara `crons` en `vercel.json`. Si la cuenta pasa a Pro, el scheduler puede migrarse a Vercel con la misma ruta y `CRON_SECRET`; no deben quedar los dos schedulers activos a la vez.

Nunca ejecutar dos schedulers con secretos distintos contra entornos mezclados. Los workers concurrentes son válidos porque PostgreSQL usa `SKIP LOCKED`; cada instancia debe tener un identificador distinto.

## Operación

La consola `/admin/notificaciones` requiere operaciones u owner con MFA. Muestra conteos, canal, estado, intentos, código de error sanitizado y versión. No expone destinatarios, payloads, tokens ni identificadores del proveedor.

Estados atendibles:

- `queued`: esperando fecha o worker.
- `leased`: un worker tiene el claim vigente.
- `dead_letter`: agotó intentos o requiere revisión. Corregir la causa antes de reintentar y registrar motivo.
- `manual`: WhatsApp requiere gestión humana auditada; no usar el dispatcher automático.
- `suppressed`: destinatario o recurso dejó de ser válido.
- `processed`: persistida internamente o aceptada por el proveedor.

Alertar si hay un dead-letter nuevo, si el evento más antiguo en cola supera cinco minutos, si un lease supera su vencimiento o si no hay una ejecución exitosa del scheduler durante cinco minutos. T30 conecta estas señales a observabilidad.

## Capacidad de email y prioridad

La consola y `/api/health/ready` cuentan solamente emails con `provider_accepted`, usando día y mes UTC. No cuentan mensajes internos, eventos suprimidos, intentos fallidos ni filas en cola. Los conteos no incluyen destinatario, asunto, contenido, domicilio ni identificador del proveedor.

Mientras Lysto use Resend Free, los límites operativos son 100 emails por día y 3.000 por mes. Se reserva margen antes del límite:

- Normal: menos de 70 diarios y menos de 2.400 mensuales.
- Advertencia: desde 70 diarios o 2.400 mensuales.
- Crítico: desde 90 diarios o 2.800 mensuales.

Una advertencia de capacidad no declara caída de la base ni cambia el estado general de readiness. Operaciones debe revisar la tendencia y el backlog. Si se acerca al límite, pausar primero los recordatorios opcionales `review.requested`; conservar `visit.confirmed` y los correos de acceso y recuperación. Si el consumo normal supera repetidamente los umbrales, actualizar el plan de Resend antes de ampliar volumen de clientes.

No eliminar eventos ni snapshots para recuperar cupo. Las confirmaciones antiguas y las reseñas ya realizadas se suprimen automáticamente cuando el worker revalida el estado actual. Ante presión sostenida, actualizar el plan de Resend; apagar todo el worker también detendría confirmaciones prioritarias y sólo corresponde durante un incidente del transporte.

## Incidentes y recuperación

1. Pausar `OUTBOX_WORKER_ENABLED` manteniendo la tabla intacta.
2. Determinar si falló la base, la configuración, el proveedor o el scheduler usando códigos sanitizados y métricas; no copiar payloads a tickets.
3. Si hubo respuesta incierta, conservar snapshot y clave. Reintentar sólo dentro de 23 horas.
4. Si el proveedor pudo aceptar el correo fuera de esa ventana, revisar manualmente; no resetear el timestamp ni generar otra clave para ocultar la incertidumbre.
5. Corregida la causa, reintentar desde la consola con motivo. Un conflicto de versión exige recargar.
6. Reactivar el worker y verificar descenso de backlog, ausencia de nuevos dead-letters y una notificación de prueba autorizada.

Rollback: deshabilitar worker y scheduler. No borrar la outbox, snapshots ni notificaciones. La reanudación recupera leases vencidos sin reenviar toda la tabla.

## Evidencia de salida

T24 exige migraciones fresh y upgrade, pgTAP, integración con dos workers, crash antes del ACK, lease recuperado, dead-letter, invitación cancelada, recepción local y prueba del contrato Resend sin credenciales reales. T36 completa scheduler, DNS, remitente y recepción externa.
