# Respuesta a incidentes

Estado: procedimiento preparado. Antes del piloto, dirección debe asignar titular y suplente de tecnología, operaciones, finanzas y privacidad en `docs/architecture/ownership-map.md`, probar el canal de guardia y aprobar la comunicación a clientes. Este documento no sustituye esas decisiones.

## Activación y severidad

El primer operador que detecta un incidente abre un registro con hora, entorno, release, síntoma, alcance conocido, responsable y próximo control. No copiar contraseñas, tokens, datos de tarjeta ni documentos personales al registro.

| Nivel | Ejemplos | Primera decisión |
| --- | --- | --- |
| S0 — crítico | acceso entre clientes, exposición de datos, cobro o devolución duplicados, dinero al destinatario equivocado, pérdida de evidencia, imposibilidad de conocer el estado monetario | Detener entradas nuevas de inmediato, avisar a titulares de tecnología, operaciones y finanzas; preservar webhooks y servicios en curso. |
| S1 — alto | indisponibilidad de `ready`, cola o conciliación detenida, pago incierto sin resolución, devolución vencida, riesgo físico en una visita | Limitar la función afectada, asignar responsable y escalar según el riesgo; detener la visita ante riesgo físico. |
| S2 — moderado | degradación dentro de un recorrido no crítico o retraso recuperable con estado y responsable conocidos | Registrar, mitigar, vigilar y programar corrección verificada. |

Una alerta de `docs/runbooks/alerts.md`, un reclamo de cliente, una anomalía del ledger o una señal del proveedor puede abrir el incidente. Si la severidad es incierta, tratarla inicialmente como la más alta plausible hasta comprobar el alcance.

## Contención

1. Identificar entorno y deployment exactos. Confirmar `/api/health/live`, `/api/health/ready`, alertas, outbox, eventos de webhook y pagos en revisión sin ejecutar comandos de escritura exploratorios.
2. Si nuevas solicitudes pueden empeorar el incidente, fijar `LYSTO_ACCEPT_NEW_REQUESTS=false` y desplegar el cambio controlado. Si pueden empeorarlo nuevos cobros, fijar `LYSTO_ALLOW_NEW_CHECKOUTS=false`. Registrar quién lo autorizó, hora y deployment. Comprobar el valor efectivo después del despliegue.
3. Mantener recepción de webhooks, conciliación, devoluciones, reclamos y atención de servicios existentes. No apagar esos procesos por detener el checkout. No reintentar un pago de estado incierto ni emitir una devolución duplicada.
4. Preservar logs con ID de correlación, release, IDs internos y referencias del proveedor parcialmente redactadas. Congelar la evidencia pertinente y limitar el acceso; no borrar ni alterar historial para «limpiar» el incidente.
5. Asignar un líder técnico y un coordinador operativo; finanzas toma la conciliación si hay dinero afectado. Escalar a privacidad/asesoría legal si hay datos expuestos y a seguridad física si hay personas en riesgo. Si no hay titular o suplente disponible, mantener entradas nuevas cerradas.

## Diagnóstico y recuperación

- Comparar el primer fallo con el último release, migraciones, variables, scheduler y cambios del proveedor. Registrar hipótesis y evidencia antes de modificar el sistema.
- Para un defecto de aplicación, preferir rollback a un artefacto compatible o un forward fix probado, siguiendo `docs/release/production-runbook.md`. Un rollback de código no revierte automáticamente el esquema ni elimina eventos.
- Para pagos, conciliar el ledger interno con Mercado Pago y registrar cada discrepancia y su dueño. Un callback del navegador no acredita un pago; no resolver incertidumbre con un nuevo cobro.
- Para notificaciones, conservar el outbox y los IDs de envío; revisar reintentos y supresiones antes de reactivar el worker.
- Una restauración de datos sólo procede ante corrupción o pérdida confirmada, con autorización, punto recuperable, destino y conciliación definidos en `docs/runbooks/disaster-recovery.md`. Nunca usarla como rollback rutinario.

## Comunicación y cierre

El coordinador registra actualizaciones con hora, alcance confirmado, impacto para clientes/operadores, mitigación vigente y siguiente actualización. Operaciones atiende los casos abiertos; finanzas informa sobre dinero afectado. No afirmar que un cobro fue devuelto, un mensaje fue entregado o datos fueron recuperados sin evidencia del proveedor o del restore. Las comunicaciones externas y eventuales obligaciones de notificación requieren aprobación de los responsables designados.

Antes de reabrir entradas, verificar salud, RLS y roles afectados, colas, webhooks, conciliación monetaria, Storage y recorrido crítico en el entorno correspondiente. Reabrir solicitudes y checkouts por separado, con cupo limitado y monitoreo; el líder técnico y los titulares de operaciones/finanzas registran la decisión. Si queda una diferencia monetaria inexplicada o un S0/S1 abierto, mantener cerrado el ingreso nuevo.

El cierre conserva línea de tiempo, causa raíz o incertidumbre residual, entidades afectadas, evidencia saneada, acciones, aprobaciones, tiempo de detección/recuperación y tareas preventivas con dueño y fecha. Revisar el incidente en el siguiente turno y en el calendario de mantenimiento.
