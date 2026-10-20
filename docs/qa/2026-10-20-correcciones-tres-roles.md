# Correcciones y nueva prueba con tres roles

Fecha: 20 de octubre de 2026. Sitio: `https://lystohogar.com`.

## Cambios

1. **Presupuestos:** los snapshots aceptados sin alcance, exclusiones u otras listas opcionales se pueden leer sin romper la pantalla. Se indica expresamente cuando el alcance o las exclusiones no fueron registrados. Se conservan los importes y condiciones persistidos; no se recalcula ni reescribe ningún presupuesto.
2. **Pagos y comprobantes:** el error original del servidor era `42501`, falta de lectura de `service_requests` para el rol de pagos. Esos permisos cambiaron durante esta intervención por una acción ajena a este hotfix. Se verificaron los permisos efectivos de las columnas usadas por el listado, detalle y contador. Al integrar la nueva versión publicada se conservó su migración `20261020164828_customer_payment_summary_read_grants.sql`; no se agregaron permisos adicionales.
3. **Notificaciones:** el serializador devolvía `null` en `providerAccepted` para los pendientes, incompatible con el booleano exigido por la aplicación. Ahora devuelve `false`. También se corrigió el contador de pendientes, que excluía las filas sin lease; la pantalla pasó de 0 a 25 eventos en cola.
4. **Servicios y Más:** Servicios admite tanto el alcance ausente como la dirección guardada en formato `{label: string}` de presupuestos existentes, sin declarar toda esa fuente indisponible. El aviso parcial de Más desapareció al recuperarse la lectura de pagos. Se mantiene el tratamiento de errores reales.

## Evidencia automatizada y base de datos

- Cuatro regresiones nuevas fallaron antes del arreglo y pasaron después.
- Se verificaron presupuestos guardados, desglose, lectura y pantalla de servicios, pagos del cliente y operaciones de notificación. La pasada integrada incluye también las regresiones del retorno de pagos y middleware.
- `tsc --noEmit` y ESLint de archivos modificados: aprobados.
- `scripts/qa/notification-delivery-boolean.sql`: fallo previo reproducido y resultado posterior correcto para pendiente, aceptado y suprimido, sin insertar ni enviar eventos.
- `scripts/qa/customer-payment-read-permissions.sql`: aprobado contra el rol real de ejecución, sin impersonarlo ni cambiar permisos.
- Migraciones `20261020170504` y `20261020171451`: ejecutadas en `dqonlqcurvjnjgsczevu` y registradas como aplicadas.
- Se conservan `search_path` vacío, autorización administrativa y privilegios existentes de las funciones.
- Advisors después de las migraciones: 71 advertencias y ningún hallazgo de nivel error. Las advertencias de seguridad/rendimiento más amplias no se modificaron como parte de este arreglo.

## Publicación y prueba final

Rama `codex/qa-four-production-errors`. Los cambios comenzaron sobre el commit publicado `5d94a2599f3a78355c01e33cf626aa45cf46e546` y luego se integraron sobre `c15f95b40be34e79628c1389a1285c02a4f670f9` al detectarse una publicación simultánea. Se preservó la corrección nueva del retorno de pagos. Los cambios funcionales de este trabajo están en `70bee55` y `f240bf5`.

Pendiente de completar al terminar la publicación: compilación, versión asignada al dominio y recorridos posteriores con administrador, cliente y técnico.

## Alcance

Las comprobaciones usan los registros existentes. No se ejecutaron pagos, devoluciones, reenvíos de notificaciones, nuevas solicitudes ni cambios de estado de trabajos. El logout se verifica con cliente para preservar las sesiones de técnico y administrador que requieren segundo factor.

Las evidencias del navegador y las sesiones cifradas se guardan fuera del repositorio. Las sesiones siguen sujetas a expiración y revocación normales.
