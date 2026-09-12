# T09 — Permisos administrativos y auditoría

Implementación verificada localmente. La habilitación de producción continúa sujeta al resto del plan y a T36.

## Matriz efectiva

| Cuenta / permiso | Cambiar permisos | Auditoría visible |
| --- | --- | --- |
| Owner con sesión vigente y MFA | Sí, con versión y motivo | Todos los ámbitos |
| Operaciones con MFA | No | Profesionales, trabajos, solicitudes y precios |
| Finanzas con MFA | No | Pagos y devoluciones |
| Calidad con MFA | No | Calidad y garantías |
| Administrador sin permisos, cliente, profesional o anónimo | No | Ninguna |

Owner hereda los ámbitos operativos. Las consultas paginadas vuelven a verificar la identidad y los permisos; el cursor se vincula a cuenta, conjunto de permisos y recurso. Las acciones desconocidas quedan reservadas a owner.

## Operación

- `/admin/configuracion` muestra las cuentas persistidas. Un owner selecciona la cuenta, sus permisos y un motivo de 10–1000 caracteres. El servidor deriva el actor de la sesión; no acepta un actor enviado por el navegador.
- La RPC serializa cambios, bloquea sesión, usuario, factor y permiso owner vigente, y comprueba nuevamente la autorización después de esperar. La versión rechaza una edición obsoleta. La versión es opaca: puede aumentar más de una unidad al modificar varios permisos.
- Retirar owner exige otro owner con identidad administrativa confiable, correo confirmado, cuenta no suspendida/eliminada y autenticador verificado. La recuperación y sus custodios siguen el procedimiento T08; contar un grant aislado no acredita que la otra cuenta pueda acceder.
- Cambios, incremento de versión y evento con actor, entidad, motivo y antes/después comparten transacción. Si falla el registro, se revierte todo. Un cambio sin diferencias no crea un evento ficticio.
- La interfaz conserva el borrador ante errores y conflictos; **Recargar datos** descarta esa edición y obtiene el estado actual. Guardar usa la respuesta canónica de la operación.
- `/admin/auditoria` consulta acciones reales, con páginas sucesivas, recarga y detalle. El horario se identifica como Argentina. No permite editar ni borrar registros.

## Integridad y privacidad

Los roles de aplicación no insertan, actualizan ni borran directamente auditoría. La selección directa por PostgREST sólo admite columnas de identificación bajo RLS; `metadata` está revocada incluso para owner. La RPC de lectura proyecta una lista explícita de campos y descarta documentos, tokens y campos arbitrarios. El motivo debe describir la decisión sin incluir credenciales ni documentos personales.

La antigua RPC de dos argumentos queda reservada a infraestructura confiable con `service_role`, con un evento específico `admin.permissions.provisioned` y actor de sistema. No es un endpoint de recuperación de cuenta ni está disponible al navegador. Los permisos de actualizar y borrar auditoría también se retiran al service role. El operador de PostgreSQL conserva la autoridad de mantenimiento; esta protección no pretende impedir cambios por el propietario de la base.

Los helpers de auditoría en TypeScript existentes son constructores de dominio, no una autorización para insertar eventos en producción. Las mutaciones reales se registran desde sus procedimientos de base. Cada tarea funcional posterior debe preservar ese contrato atómico.

## Migraciones y recuperación

Migraciones nuevas `20260912015711_admin_permission_and_audit_workflows.sql` y `20260912020601_serialize_owner_authority.sql`. La segunda añade el bloqueo del grant vigente; no modifica el archivo previamente aplicado. Restaurar una UI anterior no debe restaurar el acceso de aplicación a la RPC de provisión ni ampliar lectura de metadata. Los eventos escritos se conservan.

La evidencia consolidada está en `admin-permissions-verification.json`, con pruebas, protocolo de actualización y build aislado completados. No se utilizaron cuentas reales ni se enviaron notificaciones externas.
