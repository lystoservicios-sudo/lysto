# Activación de correos automáticos — 25/10/2026

## Resultado

El titular pidió continuar con los pendientes y priorizó explícitamente los correos automáticos. Se activó el procesamiento del servicio sin cambiar claves, remitentes, preferencias ni el correo de acceso de Supabase.

De los diez emails pendientes: **seis vigentes se enviaron una sola vez y los seis figuran Delivered en Resend; cuatro obsoletos se suprimieron**. La cola de email y la interna quedaron en **cero**, sin dead letters ni leases vencidos. El scheduler completó cinco ejecuciones consecutivas correctas después de habilitar email (25/10, 22:17–22:21 Argentina); las dos primeras procesaron los nueve eventos restantes tras la primera entrega controlada.

Delivered acredita aceptación por el servidor del destinatario, no lectura ni ubicación en la bandeja principal. No se confunde con provider_accepted de la aplicación. [Definición del proveedor](https://resend.com/features/forge).

## Dominio y transporte

- El usuario inició sesión en el panel autenticado de Resend; la cuenta corresponde a Lysto.
- `auth.lystohogar.com` figura **Verified**. Se comprobaron sus registros públicos DKIM, SPF/Return-Path y DMARC; el DMARC actual está en observación p=none.
- El remitente real fue `Lysto <no-reply@auth.lystohogar.com>`, confirmado en el snapshot del primer envío y el panel del proveedor.
- Las invitaciones y los correos de acceso ya tenían entregas recientes. No fue necesario leer ni reemplazar RESEND_API_KEY, cambiar NOTIFICATIONS_EMAIL_ENABLED o tocar el SMTP de Supabase.
- El primer lote manual, limitado a un evento request.created, devolvió HTTP 200/accepted=1/failed=0. Su identificador se correlacionó con el registro Delivered antes de activar el scheduler.

## Corrección de vigencia

La cola contenía dos mensajes adicionales que el resolver aceptaba aunque ya no correspondían: asignación de un job completed y solicitud de conformidad de ese mismo job ya cerrado. El presupuesto ya aceptado y la visita pasada eran rechazados por reglas existentes.

La migración `20261026005743_outbox_email_current_state.sql` conserva la definición real vigente de private.outbox_recipient y agrega dos controles exclusivamente para email:

1. Los seis eventos simples job.* deben coincidir con el estado actual correspondiente del trabajo.
2. visit.confirmed requiere además una reserva confirmada de la misma versión y una fecha futura.

Los avisos internos conservan su historial. Los acuses de solicitudes, recibos de pagos aprobados, invitaciones y pedido de reseña vigente conservan sus reglas. Las validaciones de cuenta, propiedad, permisos, preferencia, snapshot inmutable y token de fencing permanecen activas antes de cada intento; el worker vuelve a resolver inmediatamente antes del proveedor.

La reproducción de producción fue **sólo lectura**, sin claims. La matriz aislada de PostgreSQL 17 ejecutó **26 controles**: rojo en la versión anterior, verde con la migración y rojo nuevamente tras rollback; función y triggers recuperaron su hash/estado original y el servidor local quedó detenido. Pasaron además **57 pruebas unitarias** de worker, proveedor, plantillas e invitaciones. La reparación de email sólo modificó SQL. Después, junto con el ajuste de diagnóstico de base de ruteo, se aprobó nuevamente la suite completa: 2.304/2.304 pruebas en 256 archivos, tipos y lint correctos. La integración de publicaciones concurrentes se verifica por separado.

## Scheduler

La migración `20261026010300_enable_transactional_email_scheduler.sql` cambia el cuerpo fijo del POST a `{batchSize:5,inAppOnly:false}`. Exige la migración anterior, identifica el job por nombre/propietario/comando y lo deja pausado dentro de la misma transacción. El dry-run con rollback verificó modo, pausa y permisos sin efectuar HTTP.

Después de la primera entrega confirmada se aplicó, verificó y reactivó únicamente el job id 1, `lysto-production-outbox-v1`. Mantiene destino fijo, Vault, HTTPS verificado, timeout de 55 segundos y conexión de diez. Sigue bloqueado el uso del esquema HTTP y la ejecución del wrapper para los cuatro roles de aplicación. No se usa una cola HTTP que pueda exponer headers.

No se reiniciaron snapshots, intentos, claves idempotentes ni fechas para recuperar la cola. Los seis eventos nuevos tienen un único intento. Resend conserva las claves de deduplicación 24 horas y la aplicación mantiene su límite conservador de 23 para reintentar una entrega incierta. [Documentación oficial](https://resend.com/docs/dashboard/emails/idempotency-keys).

Los umbrales configurados en Lysto siguen siendo 100 diarios/3.000 mensuales. Operaciones también debe observar el uso global del proveedor, porque los correos SMTP de Auth y otras claves no están incluidos en el contador de outbox.

## Historial e integridad

### Integración de la publicación administrativa concurrente

Durante el cierre se publicó el runtime `6e82a69` con asignación administrativa directa y revisión de documentos. Se integró su rama completa, conservando ese recorrido y sus cambios; no se volvió a exigir aceptación del técnico. La integración aprobó **2.357/2.357 pruebas en 265 archivos**, **174 controles de dominio**, **165 de herramientas**, tipos y lint. El primer candidato c7b27cb quedó sin promover. Se ajustó después la calculadora para que un traslado todavía no verificable mantenga el presupuesto en revisión, sin exigir una base general de Lysto. La compilación final ad231c2 quedó READY y se promovió tras verificar la suite completa y sus respuestas live/ready.

La revisión cruzada detectó que la reserva administrativa quedaba confirmed antes del consentimiento/pago y podía generar el email «Tu visita con Lysto está confirmada». La prueba local reprodujo tanto la aceptación prematura como la pérdida de la confirmación posterior por deduplicación si el primer aviso se suprimía. Se pausó el job exacto antes de corregirlo. Una consulta sólo lectura acreditó **cero solicitudes administrativas y cero avisos de visita administrativos**: no hubo datos reales que reescribir ni correos que compensar. El aviso genérico job.confirmed, «Profesional confirmado», se conserva para que el cliente entre a revisar y pagar.

Se aplicó la migración 104, `20261026020758_admin_visit_email_after_payment.sql`: encolado y resolución sólo admiten la confirmación administrativa después del consentimiento del cliente y un checkout inicial aprobado, con cliente/profesional coincidentes y reserva futura confirmada. El namespace `visit-confirmed-paid:<job>:<versión>` evita colisiones con un aviso prematuro previamente suprimido. Los hooks cubren consentimiento→pago y pago→consentimiento; la visita no requiere aceptación del técnico.

La misma matriz local falló antes y pasó después: bloqueo prematuro, conservación del aviso suprimido, una confirmación con dos encolados, ausencia de reenvío tras provider_accepted, orden inverso y preservación del flujo no administrativo. Los OID originales y los cuerpos delegados se comprobaron, además del rollback completo y PostgreSQL local detenido. El dry-run de producción se revirtió sin HTTP ni fixtures; después se aplicó y registró con hashes y estado del job como precondiciones. Verificación posterior: 104 migraciones, fuente exacta, dos triggers, cero permisos EXECUTE de aplicación y cero tablas públicas sin RLS. Cron se reactivó el 26/10 a las 02:21:52 UTC (25/10, 23:21 Argentina). Las últimas ocho ejecuciones observadas, 23:24–23:31 Argentina, terminaron correctamente; ambas colas seguían en cero, sin dead letters ni leases vencidos. Advisors: los mismos 71 WARN y cero ERROR.

La regresión durable, sólo local y con rollback, está en `scripts/qa/admin-visit-email-after-payment-local-matrix.sql`. La revisión independiente no dejó hallazgos bloqueantes.

Al preparar el ensayo se detectó un error del generador operativo de SQL: una sustitución de texto había alterado exclusivamente el contenido registrado en statements de las migraciones propias 100 y 101. El DDL ejecutado y los archivos fuente no estaban afectados. Se guardó el valor anterior, se comprobó que ésa era la única diferencia y se corrigieron esos dos registros en una transacción con verificación previa de hash. No se modificaron eventos ni datos de negocio para esta reparación.

Las fuentes de 100/101/102 se comprobaron por SHA-256 contra sus archivos; la verificación dentro del nuevo archivo PostgreSQL confirmó la misma coincidencia.

Advisors posteriores: **33 WARN de seguridad y 38 de rendimiento, cero ERROR**, sin nuevos hallazgos respecto del inventario anterior. La primera activación mantuvo el runtime `84749ada84856a1ff18cecc2503f8ffe5473c36b` y no necesitó desplegar código web. El cierre posterior integró las publicaciones concurrentes y publicó `ad231c2bf17b3528dc4582fdc757d2f623a6e908` en `dpl_Fhmdge6SozEjBijBvPaSByU2Zwbv`, con live/ready públicos 200 y cero entradas en la consulta puntual de errores. La suite final volvió a aprobar 2.357/2.357 pruebas, sin omisiones.

## Respaldo actualizado

Se creó un snapshot nativo nuevo con **102 migraciones**, cifrado y verificado, sin sobrescribir el respaldo 99 ni su ensayo de restauración:

- Principal: `C:/Users/quime/.codex/private/lysto-backups/20261026T012818Z-snapshot102-9edef3/backup-manifest.json`.
- Espejo en el otro disco: `E:/Backups/Lysto/20261026T012818Z-snapshot102-9edef3/backup-manifest.json`.
- Dump PostgreSQL: 2.136.345 bytes, 3.045 entradas TOC; metadatos y fuentes verificados dentro del archivo.
- Dentro del snapshot: ocho provider_accepted históricos (dos anteriores y seis de esta reparación), cuatro suppressed y cero pendientes/dead de email.
- Metadatos Storage idénticos a los 41 objetos cifrados previamente verificados.

El conjunto incluye un TOC alternativo para omitir datos de Cron y exige restaurar con workers apagados. **No se ensayó la restauración del snapshot 102**; la prueba previa fue parcial sobre el 99 y el guard se validó por separado. Persisten los límites de servicios Auth/Storage, Vault y recuperación independiente del equipo/DPAPI descritos en el informe de lanzamiento.

### Snapshot 104 después de la corrección administrativa

Se creó un archivo independiente, sin sobrescribir 99/102, en `C:/Users/quime/.codex/private/lysto-backups/20261026T022149Z-snapshot104-3f1821/backup-manifest.json` y su espejo `E:/Backups/Lysto/20261026T022149Z-snapshot104-3f1821/backup-manifest.json`. Dump nativo completo: 2.151.530 bytes, 3.055 entradas TOC; 104 migraciones y fuentes 100–104 verificadas exactamente desde el archivo. Los 16 archivos son idénticos en ambos discos y las 44 rutas revisadas mantienen ACL privada. Storage conserva 41 objetos/25.710.314 bytes coincidentes con los objetos cifrados originales.

El snapshot contiene ocho provider_accepted históricos, cuatro suppressed y cero pendientes/dead. El TOC de recuperación omite datos de Cron para restaurar con workers apagados. No se restauró el archivo 104 completo; la prueba funcional con rollback es evidencia separada y persisten los límites de recuperación descritos arriba.

Después de publicar ad231c2, se comprobaron otras ocho ejecuciones correctas (23:41–23:48 Argentina), con ambos canales en cero y sin dead letters ni leases vencidos. Durante el cierre entró una solicitud nueva: su acuse automático fue aceptado por el proveedor en un intento y la siguiente ejecución vació la cola; esa aceptación adicional no se suma a las seis entregas Delivered verificadas individualmente. La salida está en `output/mail-release-final-scheduler-observation.json`.

## Evidencia privada y operación

La salida ignorada conserva `output/mail-domain-dns.json`, `mail-first-production-batch.json`, `mail-provider-deliveries.json`, `mail-active-observation.json`, `mail-notification-regressions.log` y `mail-post-change-advisors.json`. Los identificadores de proveedor y destinatarios no se publican en este documento. La evidencia local de 26 controles está fuera del repositorio bajo `C:/Users/quime/.codex/private/lysto-email-validation/2026-10-25-005711/`.

Para un incidente, pausar el job exacto y conservar la cola. No borrar mensajes ni reiniciar su antigüedad. La desactivación global de email también afecta invitaciones síncronas y no debe usarse de forma indiscriminada. [Procedimiento](../runbooks/production-outbox-scheduler.md).
