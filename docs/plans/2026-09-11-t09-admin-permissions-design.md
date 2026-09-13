# T09 — Permisos y auditoría administrativa

Continuación del plan de 40 tareas autorizado. Reutiliza los permisos `operations`, `finance`, `quality`, `owner`, la identidad por sesión de T06 y MFA/revocación de T08.

## Implementación prevista

1. API y RPC de cambio de permisos con actor derivado de sesión, motivo obligatorio y versión del conjunto de permisos para detectar ediciones concurrentes. Sólo un owner vigente con MFA puede mutar.
2. Serializar las modificaciones y volver a verificar autoridad después del bloqueo. No permitir retirar el último owner recuperable: correo confirmado, identidad administrativa vigente, cuenta no suspendida/eliminada y factor MFA verificado.
3. Guardar antes/después, actor, entidad y motivo en la misma transacción. Un fallo de auditoría debe revertir el cambio. Las escrituras de aplicación no pueden atribuir eventos a otro actor ni editar/borrar el historial.
4. Consultas paginadas y filtradas por permiso; DTO de auditoría con metadata permitida explícitamente. Sin documentos, tokens ni datos arbitrarios del proveedor en vistas generales. Comprobar también el acceso directo por PostgREST.
5. Conectar configuración y auditoría a datos persistentes con mensajes de carga/error/conflicto. Mantener las decisiones comerciales y credenciales externas fuera de estos formularios.
6. Pruebas reales de matriz de permisos, token previo a revocación, bloqueo concurrente, último owner y rollback ante fallo de auditoría. Ejecutar protocolo de migración T03 y build aislado.

## Revisión inicial

Existe `private.set_admin_permissions` con bloqueo asesor y protección del último grant owner. La autorización ocurre antes del bloqueo y el conteo no comprueba que el otro owner pueda acceder. La auditoría actual guarda sólo el nuevo conjunto y el motivo no es obligatorio. Las páginas administrativas siguen usando componentes de demostración. Estas son las carencias a corregir; no se introduce un rol paralelo.

El procedimiento de recuperación del proveedor y la designación de custodios siguen siendo aceptación externa de T08. Este bloque conserva controles estrictos y no agrega una ruta pública de recuperación.
