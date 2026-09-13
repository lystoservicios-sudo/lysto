# Recuperación de acceso administrativo

Estado: procedimiento preparado; falta el acta de custodia y un ensayo con los dos responsables designados para el entorno real. Este documento no acredita acceso a producción ni custodia de códigos.

## Acceso normal

La administración requiere una sesión de Auth vigente y un autenticador TOTP verificado. `/seguridad` permite configurar o verificar el factor propio; abrir la página no inscribe factores. Los permisos provienen de la base y se vuelven a consultar en cada operación. Una sesión con contraseña solamente puede acceder a la configuración de su propio MFA, pero no a datos administrativos.

El factor adicional también se exige en los endpoints de cuenta de cobros del profesional. El cliente puede pagar con su sesión normal. El alta de un factor y la verificación pertenecen a Supabase Auth; la aplicación no implementa un verificador TOTP propio.

## Preparación del titular

1. Designar dos personas distintas con acceso individual y MFA a la infraestructura de identidad, base, hosting y registro de incidentes. Registrar titulares y suplencias en D04/D09.
2. Probar ambos accesos y confirmar que inscripción/verificación TOTP estén habilitadas en Auth del entorno real. `supabase/config.toml` configura la instancia local; no cambia por sí solo los ajustes de un proyecto gestionado. Conservar los códigos de recuperación que ofrezca cada proveedor de infraestructura en el gestor de secretos del titular, con acceso limitado y una copia de emergencia custodiada. No guardarlos en Git, tickets, este documento ni conversaciones.
3. Cuando corresponda, registrar un segundo autenticador propio desde una sesión con MFA. Supabase TOTP no proporciona códigos de recuperación de aplicación en este flujo; no confundirlos con los códigos del proveedor de infraestructura.
4. Dejar constancia de dónde se custodia el material, quién puede recuperarlo y cómo se registra su uso, sin incluir el material secreto.

## Pérdida de un autenticador

1. Abrir un incidente con identificador, cuenta afectada, solicitante, verificador, motivo y hora. Verificar identidad mediante un canal previamente registrado y un segundo responsable; un correo recién enviado o una sesión con contraseña no bastan para retirar MFA.
2. El responsable de infraestructura comprueba la cuenta y sus permisos actuales. Si existe sospecha de compromiso, bloquear temporalmente la cuenta, revocar sus sesiones y retirar permisos afectados mediante el procedimiento de emergencia. Preservar los registros del incidente.
3. Con acceso administrativo al proveedor de identidad, revocar todas las sesiones de esa cuenta y retirar únicamente el factor perdido, usando los controles del proveedor o su Admin API. No desactivar MFA global, no conceder permisos nuevos y no crear una ruta pública de recuperación privilegiada.
4. La persona recuperada inicia sesión nuevamente y registra/verifica su nuevo autenticador en `/seguridad`. Hasta completar MFA, la administración seguirá bloqueada. Retirar un factor invalida su autoridad adicional incluso para tokens previos que todavía anuncien `aal2`.
5. Probar con la persona recuperada que el nuevo acceso tiene los permisos originales y que el token/sesión anterior no autoriza lecturas ni comandos. Registrar resultado y responsables, sin tokens, OTP, QR ni secretos.
6. Cerrar el incidente y reponer material de emergencia utilizado. Si ambos responsables pierden acceso a la infraestructura, seguir la recuperación de titularidad del proveedor; no existe un bypass público en Lysto.

## Suspensión de un profesional

Un operador con permiso `operations` u `owner` y MFA llama a `POST /api/admin/professionals/suspend` con `professionalId` y un motivo de 10 a 1000 caracteres. La operación usa `suspend_professional`, bloquea el perfil durante la transición, registra actor y motivo y conserva una lista de trabajos no terminados en auditoría y outbox. Repetirla sobre un perfil suspendido no duplica eventos. Los cambios directos de estado también registran la transición; una suspensión desde sesión de aplicación exige un motivo.

Los comandos y las nuevas asignaciones rechazan al profesional suspendido. Operaciones debe revisar cada trabajo activo y resolverlo según las reglas aprobadas en D06/D07; la suspensión no cancela automáticamente trabajos ni cobra o devuelve dinero. Mantiene cuentas OAuth, pagos e historial para que finanzas pueda conciliar. Las alertas quedan durables en `private.outbox_events`; su entrega y gestión operacional completa pertenecen a T24/T29.

## Evidencia de recuperación pendiente

| Campo | Evidencia requerida |
| --- | --- |
| Entorno | Proyecto y dominio verificados, sin credenciales |
| Dos responsables | Identidad y función de cada responsable y suplente |
| Custodia | Referencia al almacén privado y prueba de recuperación |
| Ensayo | Incidente sintético, inicio y fin, resultados y responsables |
| Revocación | Token previo rechazado en API y SQL, sesión nueva con MFA aceptada |
| Revisión | Fecha y conformidad del titular |

Las pruebas automatizadas locales de T08 cubren MFA real, retirada de permisos/rol, cierre de sesión, bloqueo y eliminación del factor. No sustituyen esta acta ni la prueba de recuperación de infraestructura.
