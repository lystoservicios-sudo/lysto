# T08 — Aseguramiento y revocación de sesiones

Implementación local en curso. Sin habilitación de producción.

## Límites de autoridad

- Cada operación comprueba usuario Auth y contexto actual de base. La identidad exige sesión persistida, no vencida, correo confirmado, usuario no eliminado/bloqueado y coincidencia entre rol confiable actual y rol firmado.
- Las políticas administrativas usan el mismo control y exigen `aal2`, sesión `aal2` y el factor verificado que pertenece a esa sesión/usuario. No confían únicamente en el `aal` del JWT.
- El contexto de seguridad propio está disponible con `aal1` para completar MFA. `requireSecuritySession` sólo debe utilizarse en esa pantalla, nunca en comandos de negocio. `requireAdminPermission` vuelve a exigir MFA aunque reciba un contexto ya resuelto.
- Logout elimina la sesión del proveedor. Su JWT capturado deja de autorizar SQL y API sin esperar a que venza. Los cambios de permisos, rol y estado se consultan en cada nueva operación. Una operación ya autorizada y en ejecución antes de la revocación puede terminar; no se promete cancelar transacciones arbitrarias iniciadas previamente.
- La finalización de un archivo se vincula a la sesión exacta del actor. Su transacción bloquea sesión y usuario, además de los controles de propiedad e inspección existentes. El RPC antiguo sin sesión perdió permiso de ejecución, incluso para `service_role`.
- Los tokens de escritura de Storage ya emitidos pueden durar hasta dos horas. Sólo escriben cuarentena: después de revocar la sesión no pueden finalizar ni convertirse en evidencia visible. Las URLs de lectura ya emitidas conservan su ventana fija máxima de 60 segundos; revocar una sesión no permite retirar un archivo ya descargado.

## Migraciones

1. `20260912000828_session_assurance_and_revocation.sql`: identidad y MFA actuales, contexto propio de seguridad, guardas de registro/upload y finalizador ligado a sesión.
2. `20260912002838_professional_suspension_alerts.sql`: suspensión con motivo y auditoría, alertas durables y bloqueo de perfil compartido por suspensión/asignación.
3. `20260912003701_profile_session_revocation.sql`: lectura del perfil propio sujeta al mismo control de sesión/MFA, cerrando la política anterior basada sólo en `auth.uid()`.

La migración no confirma correos antiguos, no crea sesiones ni factores para usuarios existentes y no inventa permisos. Las sesiones históricas sin `session_id` deberán iniciar sesión nuevamente. Las cuentas administrativas con contraseña solamente deben verificar su autenticador.

`supabase/config.toml` habilita TOTP local. La activación y el ensayo en Auth del entorno gestionado real quedan dentro de D04/T36 y el acta de recuperación; no se aplicaron cambios a un proyecto remoto.

## Pruebas y límites

Los fixtures SQL crean sesiones/factores sintéticos dentro de una transacción que siempre se revierte; sirven para comprobar RLS, permisos y contratos. La suite HTTP separada obtiene sesiones con contraseña y verifica TOTP contra Auth real en la instancia descartable. Los secretos sólo viven en memoria de esa prueba y no se incluyen en reportes.

La recuperación de cuentas está descrita en [el runbook](../runbooks/account-recovery.md). Sigue pendiente el acta de dos responsables y custodia real. El envío de alertas, la pantalla operacional y el onboarding profesional completo siguen en T24, T29 y T11. Ninguna prueba local constituye un ensayo de recuperación de producción.
