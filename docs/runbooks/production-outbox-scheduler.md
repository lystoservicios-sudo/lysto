# Scheduler de avisos internos de producción

La migración `20261025235512_launch_notification_scheduler.sql` instala `pg_cron` y la extensión síncrona `http` en el esquema restringido `private_outbox_http`; crea el job `lysto-production-outbox-v1` **desactivado**. Aplicarla no envía notificaciones, no provisiona secretos y no habilita el worker. No requiere cambiar el plan de Vercel.

La función privada `private.invoke_production_outbox_worker()` hace un POST únicamente a `https://lystohogar.com/api/internal/outbox`, con `{"batchSize":5,"inAppOnly":true}`, un timeout total de 55 segundos y uno de conexión de diez segundos. Usa el secreto exclusivo de producción llamado `lysto_production_outbox_worker_secret` en Vault, que debe coincidir con `OUTBOX_WORKER_SECRET` del despliegue. La función no acepta URL, headers, canal ni tamaño de lote como argumentos. El comando guardado en `cron.job` sólo contiene el nombre de la función. Devuelve únicamente el estado HTTP 200; los demás estados y errores de transporte generan errores controlados, sin devolver ni registrar headers o cuerpos de respuesta.

Se descartó `pg_net` tras una prueba con rollback en el proyecto: sus tablas y esquema son de `supabase_admin`, PUBLIC conserva lectura/uso y el rol `postgres` del proyecto no puede revocar esos grants. Usar esa cola habría dejado la credencial descifrada legible por roles de aplicación. La alternativa síncrona no guarda solicitudes en tablas y bloquea el acceso a la extensión mediante un esquema propiedad de `postgres`, sin USAGE para la aplicación. Los timeouts se configuran mediante la API oficial `http_set_curlopt` y se reinician al terminar o fallar; el proyecto no permite el SET directo de esos parámetros.

El modo `inAppOnly` debe estar publicado antes de activar el job. Permite conservar la configuración existente de correo para invitaciones síncronas sin habilitar emails desde este scheduler. Los eventos de email permanecen en cola y no consumen intentos. La entrega de email requiere su propia validación de remitente y una prueba autorizada.

## Preparación y activación controlada

1. Verificar el proyecto `dqonlqcurvjnjgsczevu`, el dominio, el despliegue exacto y que la ruta publicada acepta y respeta `inAppOnly`. La prueba debe verificar que el proveedor de email no se llama en ese modo.
2. Revisar la cola por canal, tipo y antigüedad sin extraer destinatarios ni payloads. Algunos eventos simples internos conservan validez aunque sean antiguos; no existe una supresión general por edad. No borrar ni reescribir la cola para ocultar el backlog.
3. Aplicar exclusivamente la migración revisada. Si hay drift de migraciones, reconciliar la historia con evidencia; no ejecutar un push general para forzarlo.
4. Provisionar el secreto por un transporte controlado y almacenarlo en Vault y Vercel sin imprimirlo, pasarlo como argumento de proceso ni guardarlo en archivos rastreados. No reutilizar ni rotar `CRON_SECRET`: este job usa la credencial de POST.
5. Habilitar `OUTBOX_WORKER_ENABLED` en el despliegue publicado. Revisar primero un lote acotado autorizado mediante el mismo modo interno.
6. Comprobar que el job sigue inactivo y que los roles de aplicación no pueden ejecutar la función ni leer headers. Activar explícitamente el job usando su ID verificado:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'lysto-production-outbox-v1';

-- Sólo después de validar el ID, la configuración y la primera ejecución:
-- select cron.alter_job(<jobid_verificado>, active := true);
```

7. Verificar cinco ejecuciones consecutivas y el descenso real de la cola. La función síncrona sólo termina correctamente después de recibir HTTP 200; no convierte una respuesta HTTP de error en éxito de Cron. Revisar además los contadores de entrega, cero nuevos dead letters y leases vencidos. HTTP 200 por sí mismo no demuestra que todos los eventos hayan sido aceptados: el worker también informa supresiones y fallos. Con lotes de cinco y frecuencia por minuto, 55 eventos requieren al menos once ejecuciones. Cada ejecución puede mantener una conexión de base ocupada hasta 55 segundos; no aumentar frecuencia o concurrencia sin medir esa capacidad.
8. Registrar la activación, el despliegue y la evidencia sanitizada en el informe de apertura. Ejecutar los advisors de seguridad/rendimiento después del cambio.

Verificación de permisos, sin valores secretos:

```sql
select r.rolname,
  has_function_privilege(r.oid, 'private.invoke_production_outbox_worker()', 'execute') as can_invoke,
  has_schema_privilege(r.oid, 'private_outbox_http', 'usage') as can_use_http,
  has_schema_privilege(r.oid, 'vault', 'usage') as can_use_vault,
  has_table_privilege(r.oid, 'vault.decrypted_secrets', 'select') as can_read_secrets
from pg_roles r
where r.rolname in ('anon', 'authenticated', 'service_role')
   or r.rolname like 'lysto\_%' escape '\';
```

La ejecución del wrapper y el uso del esquema HTTP deben ser `false` en cada fila. Para `anon`, `authenticated` y `lysto_marketplace`, también deben ser `false` el uso de Vault y la lectura de secretos. `service_role` conserva su acceso administrado preexistente a Vault: es una credencial privilegiada exclusivamente de servidor, que ya puede acceder a la base y a los secretos de la aplicación. Esta migración no amplía ni intenta revocar ese acceso de plataforma. El permiso de esquema Vault por sí solo no permite leer sus secretos; comprobar ambos valores.

Los objetos de la extensión HTTP conservan EXECUTE PUBLIC otorgado por `supabase_admin`; la barrera efectiva es la ausencia de USAGE sobre el esquema privado, además del EXECUTE revocado en el wrapper. No había objetos en ese esquema antes de instalarlo, de modo que no existen planes preparados anteriores que eludan la resolución inicial del nombre. Comprobar también que una ejecución sin credencial, con credencial inválida o con worker desactivado recibe 403.

## Pausa y recuperación

Desactivar el job por su ID verificado y, si hay un incidente del worker, deshabilitar `OUTBOX_WORKER_ENABLED`. Conservar eventos, snapshots y leases. No eliminar extensiones: deshabilitar `pg_cron` elimina todos sus jobs, incluidos otros entornos o funciones operativas. Reaplicar esta migración vuelve a dejar el job pausado; exige una nueva activación operativa.

## Referencias

- [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart).
- [Supabase: extensión HTTP](https://supabase.com/docs/guides/database/extensions/http), [API del proveedor para timeouts](https://github.com/pramsey/pgsql-http).
- [Supabase: scheduler, pg_net y Vault](https://supabase.com/docs/guides/functions/schedule-functions), incluida la advertencia sobre secretos temporales por la que se descartó esa cola.
- [Vercel: límites de cron por plan](https://vercel.com/docs/cron-jobs/usage-and-pricing).
