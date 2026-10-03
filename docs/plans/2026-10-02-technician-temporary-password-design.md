# Alta de técnicos con contraseña provisoria

Diseño aprobado el 2 de octubre de 2026. “Operador” fue un nombre coloquial: el usuario objetivo es el técnico que realiza servicios a domicilio y debe tener el rol existente `professional`.

## Objetivo

Al invitar un técnico desde administración, crear su acceso con una contraseña provisoria numérica de siete dígitos y enviarla al correo invitado junto con el enlace al login del equipo. Al ingresar, el técnico debe continuar el onboarding profesional existente y poder retomarlo después de cerrar sesión. El cambio de contraseña queda disponible únicamente tras completar el onboarding.

## Enfoques considerados

1. **Cuenta profesional precreada con contraseña provisoria (elegido):** permite usar el flujo de login normal que pidió el usuario; el rol queda fijado por `app_metadata` confiable.
2. **Link de acceso sin contraseña:** evitaría enviar una contraseña por correo, pero no cumple el requisito expreso de autenticarse con la clave temporal.
3. **Mantener el formulario de contraseña del link de invitación:** aprovecha el flujo actual, pero contradice la experiencia solicitada y vuelve a pedirle al técnico que invente una contraseña durante el alta.

## Diseño

- La pantalla existente de invitación de profesionales sigue siendo el punto administrativo y conserva nombre, apellido, email y especialidad; no se crea un rol administrativo nuevo.
- El servidor genera la clave con una fuente criptográfica segura y crea y confirma la identidad Supabase Auth con `app_role=professional` y la fuente de invitación. El correo lleva el link del login con el token único de invitación como destino `next`, más el email y la clave provisoria. Tras autenticar, el login consume ese token para enlazar la identidad al expediente técnico existente antes de consultar el contexto de sesión. Nunca confía en metadatos editables por el usuario para asignar rol.
- El email se intenta enviar de forma síncrona mediante un transporte especializado que no sella ni guarda su contenido en el snapshot durable del outbox. Incluye email, clave provisoria y el link único de login. El secreto no se agrega al outbox, auditoría, respuesta administrativa ni logs. Se devuelve “enviada” solo con aceptación de Resend; los fallos se muestran claramente y permiten regenerar la clave/invitación invalidando la anterior.
- Tras aceptar la invitación, el login identifica la cuenta como `professional` y la conduce al onboarding técnico existente. Se conserva su guardado por pasos en Supabase, así que cerrar sesión y volver a entrar con la clave deja al técnico en su expediente y paso pendiente. No se crea un segundo onboarding paralelo.
- Mientras la solicitud esté incompleta o en revisión de alta, se bloquea el cambio de contraseña. Al alcanzar el estado final definido por el onboarding, el usuario podrá cambiarla desde el área autenticada normal. Las reglas de revisión/activación profesional existentes no se debilitan.
- El alta incompleta seguirá siendo un expediente técnico (`professional_profiles`/`professional_invitations`); contraseña, email y rol no se manejan en el cliente. RLS, las RPC privadas y las credenciales de service role mantienen su frontera actual.

## Manejo de errores y seguridad

- Rechazo o timeout del proveedor no se reporta como enviado; se preserva un estado recuperable sin exponer la clave.
- Reintentar una invitación regenera una clave nueva e invalida la anterior; no se vuelve a revelar ni recuperar una clave previa.
- Emails existentes, identidades preexistentes, duplicados y carreras se resuelven sin reasignar una identidad a una invitación diferente.
- Se conserva rate limiting del login, el control de origen de mutaciones, expiración/revocación de invitaciones, validación de correo y auditoría administrativa.
- La clave de siete dígitos tiene poca entropía: se limita su uso al onboarding pendiente, se exige rate limit estricto y se permite reemplazarla tras el onboarding. No se usa para habilitar privilegios distintos del rol profesional.

## Verificación

Verificar con pruebas dirigidas la creación de Auth y vínculo de invitación, el enlace al login y rol professional, la aceptación/fallo/reintento de correo sin retención del secreto, la reanudación del expediente por paso, la prohibición de cambiar contraseña durante el alta y su disponibilidad tras completarla. Ejecutar revisión de migración/RLS y los comandos de verificación del proyecto.
