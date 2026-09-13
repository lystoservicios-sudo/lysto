# Mapa de propiedad y custodia

Estado: roles definidos; nombres, suplentes y custodios efectivos pendientes. Completar fuera de secretos antes del piloto.

| Dominio | Alcance | Titular requerido | Suplente requerido | Acceso mínimo / evidencia |
| --- | --- | --- | --- | --- |
| Código y releases | repositorio, CI, manifest, revisión y rollback | Responsable técnico: pendiente | Revisor técnico: pendiente | cuenta personal, MFA, reglas de rama y run protegido |
| Base y datos | Supabase, migraciones, RLS, backups, restore y retención | DBA/técnica: pendiente | Continuidad: pendiente | roles separados, log de acceso y restore medido |
| Infraestructura | hosting, DNS, variables, scheduler, colas y alertas | Infraestructura: pendiente | Guardia técnica: pendiente | entorno protegido, inventario y prueba de alertas |
| Pagos | Mercado Pago, conciliación, devoluciones y liquidación | Finanzas/titular comercial: pendiente | Conciliador: pendiente | cuenta nominada, MFA, doble control y acta diaria |
| Soporte y operación | turnos, SLA, asignación, calidad, incidentes y profesionales | Operaciones: pendiente | Suplente de turno: pendiente | permisos por módulo, capacitación y entrega de turno |
| Privacidad y legal | políticas, solicitudes de datos, contratos y conservación | Privacidad/legal: pendiente | Dirección: pendiente | registro de solicitudes, versiones y aprobaciones |

## Límites de responsabilidad

El titular aprueba cambios y revisa evidencia; el suplente debe poder ejecutar el runbook sin depender del desarrollador original. Ninguna persona usa cuentas compartidas ni acumula por defecto código, producción, finanzas y aprobación comercial. Las acciones sensibles quedan en auditoría.

## Acceso de emergencia

El acceso de emergencia se custodia fuera del repositorio en el gestor aprobado. Requiere incidente, identidad personal con MFA, autorización de dos responsables cuando sea posible, duración limitada y registro de comandos/acciones. Al cerrar el incidente se revoca la elevación, se rotan credenciales expuestas, se concilian cambios y se realiza revisión posterior. Este mapa guarda custodios y referencias, nunca secretos, códigos de recuperación o claves privadas.

## Alta, cambio y baja

Toda alta define motivo, alcance, vencimiento y aprobador. Un cambio de rol reevalúa permisos. Una baja revoca sesiones, tokens, accesos al proveedor, hosting, DB y alertas; luego otro responsable verifica la revocación. La revisión mensual compara personas vigentes contra cada sistema.
