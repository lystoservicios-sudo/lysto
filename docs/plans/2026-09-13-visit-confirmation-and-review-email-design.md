# Diseño — confirmación de visita y solicitud de calificación por correo

**Estado:** aprobado por producto el 13/09/2026.

## Objetivo

Agregar dos comunicaciones transaccionales sobre la infraestructura de notificaciones existente:

1. Una confirmación de visita útil y visual cuando el trabajo tenga profesional y reserva horaria confirmados.
2. Una solicitud opcional de calificación dos horas después de que el cliente confirme la finalización.

La experiencia debe acercarse a los ejemplos de reservas enviados por producto, sin exponer teléfonos personales, tokens públicos ni datos operativos internos.

## Decisiones aprobadas

- Reutilizar `private.outbox_events`, el worker durable y el adaptador Resend existentes.
- Enviar la solicitud de calificación dos horas después de la conformidad explícita del cliente.
- El correo nunca completa el trabajo ni crea una reseña. La reseña sigue siendo opcional, autenticada y única por trabajo.
- No mostrar el teléfono personal del profesional. El CTA de contacto abre el canal autenticado de Lysto.
- Los enlaces de correo apuntan únicamente al origen HTTPS configurado de Lysto. La dirección no se incorpora a una URL externa dentro del mensaje.
- Una reprogramación confirmada emite una confirmación nueva para la versión vigente. Una actualización repetida de la misma versión no duplica el correo.
- Si el trabajo deja de ser elegible o la reseña ya existe, el worker suprime el recordatorio antes de contactar al proveedor.

## Arquitectura

La base de datos seguirá siendo la autoridad del momento y del destinatario. Un helper privado en PostgreSQL comprobará que el trabajo esté confirmado y tenga una única reserva `confirmed`; sólo entonces encolará `visit.confirmed`, usando trabajo y versión de agenda como identidad de deduplicación. El helper se invocará desde los dos lados de la condición: confirmación del trabajo y confirmación/reprogramación de la reserva.

La conformidad del cliente encolará `review.requested` con `available_at = clock_timestamp() + interval '2 hours'`. Al reclamarlo, `private.outbox_recipient` volverá a comprobar propiedad, cuenta, estado `completed`, decisión `confirmed` y ausencia de reseña. La carrera con una reseña presentada durante el envío queda acotada por la segunda validación del worker inmediatamente antes de Resend.

`lib/notifications/delivery-template.ts` usará contextos discriminados. Los dos eventos nuevos recibirán sólo campos derivados por la base: versión de agenda, horario, zona, servicio, nombre público del profesional y dirección formateada para la confirmación; el recordatorio de reseña sólo necesita el trabajo. El render produce HTML con estilos inline y texto plano equivalente. Todos los CTA se construyen a partir de `NEXT_PUBLIC_APP_URL` y rutas internas conocidas.

## Experiencia

### Confirmación

Asunto: **Tu visita con Lysto está confirmada**.

El cuerpo muestra servicio, fecha local, franja, dirección resumida y nombre del profesional. Incluye CTA principal **Ver servicio** y accesos secundarios **Cómo llegar**, **Solicitar reprogramación** y **Contactar desde Lysto**. Las pantallas de destino exigen sesión y propiedad del trabajo.

### Calificación

Asunto: **¿Cómo salió tu servicio?**.

El cuerpo explica que la reseña es opcional y no modifica cierre ni pago. El CTA **Calificar servicio** abre `/app/trabajos/<id>/review`. Si la sesión venció, el login debe conservar un retorno interno seguro o el usuario puede volver al trabajo desde su panel.

## Fallos y operación

La cola conserva snapshot, lease, fencing, reintentos, ventana idempotente de 23 horas y dead letter existentes. Los mensajes demorados no se reclaman antes de `available_at`. Eventos inelegibles se marcan `suppressed`; fallos temporales se reintentan; respuestas inciertas se revisan según el runbook. La consola administrativa no mostrará destinatario, dirección ni contenido privado.

Resend Free admite 3.000 correos mensuales y 100 diarios. Se alertará al alcanzar 70 diarios o 2.400 mensuales. Un servicio normal agrega como máximo una confirmación por versión de agenda y un recordatorio de reseña; las reprogramaciones son el único motivo normal para otra confirmación.

## Verificación

- Pruebas de dominio y plantilla para fechas `America/Argentina/Buenos_Aires`, HTML seguro y texto plano.
- pgTAP para condiciones de encolado, deduplicación, reprogramación, demora y permisos.
- Integración con Auth/PostgreSQL reales para envío, supresión y carreras.
- E2E autenticado para los destinos de cada CTA.
- Render visual móvil y escritorio en Gmail/Apple Mail/Outlook o equivalentes de prueba, incluida apariencia en modo oscuro.
- Recepción real en staging con dominio SPF, DKIM y DMARC aprobados antes de activar producción.

## Fuera de alcance

- Teléfono personal en correos.
- Calificación pública sin sesión o mediante estrellas embebidas que muten por GET.
- Campañas de marketing, NPS general, recordatorios repetidos o seguimiento comercial.
- Confirmación automática por silencio del cliente.
- Cambio del proveedor Resend o creación de un segundo sistema de colas.
