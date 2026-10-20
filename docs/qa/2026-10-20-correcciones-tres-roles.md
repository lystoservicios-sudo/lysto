# Correcciones y nueva prueba con tres roles

Fecha: 20 de octubre de 2026. Sitio: `https://lystohogar.com`.

## Cambios

1. **Presupuestos:** los snapshots aceptados sin alcance, exclusiones u otras listas opcionales se pueden leer sin romper la pantalla. Se indica expresamente cuando el alcance o las exclusiones no fueron registrados. Se conservan los importes y condiciones persistidos; no se recalcula ni reescribe ningún presupuesto.
2. **Pagos y comprobantes:** el error original del servidor era `42501`, falta de lectura de `service_requests` para el rol de pagos. Esos permisos cambiaron durante esta intervención por una acción ajena a este hotfix. Se verificaron los permisos efectivos de las columnas usadas por el listado, detalle y contador. Al integrar la nueva versión publicada se conservó su migración `20261020164828_customer_payment_summary_read_grants.sql`; no se agregaron permisos adicionales.
3. **Notificaciones:** el serializador devolvía `null` en `providerAccepted` para los pendientes, incompatible con el booleano exigido por la aplicación. Ahora devuelve `false`. También se corrigió el contador de pendientes, que excluía las filas sin lease; la pantalla pasó de 0 a 25 eventos en cola.
4. **Servicios y Más:** Servicios admite tanto el alcance ausente como la dirección guardada en formato `{label: string}` de presupuestos existentes, sin declarar toda esa fuente indisponible. El aviso parcial de Más desapareció al recuperarse la lectura de pagos. Se mantiene el tratamiento de errores reales.

## Evidencia automatizada y base de datos

- Cuatro regresiones nuevas fallaron antes del arreglo y pasaron después.
- **162 pruebas aprobadas en 16 archivos** sobre la versión integrada: presupuestos guardados, desglose, lectura y pantalla de servicios, pagos del cliente, operaciones de notificación, retorno de pagos y middleware.
- `tsc --noEmit` y ESLint de archivos modificados: aprobados.
- `scripts/qa/notification-delivery-boolean.sql`: fallo previo reproducido y resultado posterior correcto para pendiente, aceptado y suprimido, sin insertar ni enviar eventos.
- `scripts/qa/customer-payment-read-permissions.sql`: aprobado contra el rol real de ejecución, sin impersonarlo ni cambiar permisos.
- Migraciones `20261020170504` y `20261020171451`: ejecutadas en `dqonlqcurvjnjgsczevu` y registradas como aplicadas.
- Se conservan `search_path` vacío, autorización administrativa y privilegios existentes de las funciones.
- Advisors después de las migraciones: 71 advertencias y ningún hallazgo de nivel error. Las advertencias de seguridad/rendimiento más amplias no se modificaron como parte de este arreglo.

## Publicación y prueba final

Rama `codex/qa-four-production-errors`. Los cambios comenzaron sobre el commit publicado `5d94a2599f3a78355c01e33cf626aa45cf46e546` y luego se integraron sobre `c15f95b40be34e79628c1389a1285c02a4f670f9` al detectarse una publicación simultánea. Se preservó la corrección nueva del retorno de pagos. Los cambios funcionales de este trabajo están en `70bee55` y `f240bf5`.

**Publicación final:** commit `f7590f0c1a5e8a0477214c85213a7bd7c9ceacb0`, deployment `dpl_GRqo4y3vS5pC5bxHigZmfVKqSGCU`. Vercel terminó en `READY` y `inspect lystohogar.com` confirmó esta versión después de las pruebas. La compilación de producción de la versión integrada pasó lint, TypeScript y generación de páginas.

| Cuenta | Recorrido posterior a la publicación | Resultado |
| --- | --- | --- |
| Administrador | Solicitud `44b2e1cf-b0c8-456e-bba7-0d6f93cd9a14` y trabajo `7cc28175-00a1-4ba9-ae4f-c87ccc6ef2b5` | Presupuesto aceptado visible, importe original $100, parte profesional $82 y comisión $18. Sin caída de pantalla. |
| Administrador | Notificaciones y dashboard | 27 eventos, 25 pendientes y 2 procesados. La paginación también se verificó después de aplicar la migración. |
| Cliente | Servicios | Sin aviso de presupuestos incompletos. El formato de dirección guardado como etiqueta se lee correctamente. |
| Cliente | Trabajo `f0b06c9d-5ec2-48e3-ab15-77edb4552f0c` → Ver presupuesto aceptado | Abre el presupuesto de $1.000 sin excepción ni cambios de importe. |
| Cliente | Pagos, detalle y registro de pago | Lista de tres movimientos, pago inicial confirmado de $100 y su registro consultables. |
| Cliente | Más | Sin aviso de información parcial. |
| Técnico | Dashboard, detalle, diagnóstico y cobros del servicio | Cargan con la sesión MFA conservada; se muestran los importes y estados existentes. |
| Separación de roles | Técnico → admin; cliente → admin y pro | 404 sin contenido de las áreas ajenas. |
| Cliente | Cerrar sesión e ingresar nuevamente | Redirige a `/login?logout=success`; `/app` vuelve a exigir login. El ingreso posterior funciona y se guarda la nueva sesión cifrada. |

La consulta de logs de nivel error del deployment final, durante los diez minutos de esta comprobación, no devolvió entradas.

## Alcance

Las comprobaciones usan los registros existentes. No se ejecutaron pagos, devoluciones, reenvíos de notificaciones, nuevas solicitudes ni cambios de estado de trabajos. El logout se verifica con cliente para preservar las sesiones de técnico y administrador que requieren segundo factor.

Las evidencias del navegador están en `C:\Users\quime\.codex\private\lysto-sessions\qa-fixes-2026-10-20`. Las tres sesiones se guardaron cifradas fuera del repositorio; siguen sujetas a expiración y revocación normales. Quedó abierto el dashboard del administrador. No se cerraron las sesiones del administrador y del técnico, para conservar la verificación MFA solicitada.

Se resolvieron los cuatro grupos de fallos de la auditoría. Las observaciones previas sobre textos provisionales del menú y el alcance de Reportes no formaron parte de las cuatro correcciones solicitadas.
