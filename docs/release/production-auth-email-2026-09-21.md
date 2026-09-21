# Correo de autenticación de producción — 2026-09-21

## Alcance

Configuración y verificación del correo transaccional usado por Supabase Auth en el proyecto de producción `dqonlqcurvjnjgsczevu`. Esta evidencia no contiene claves, tokens ni contraseñas.

## Configuración aplicada

- Proveedor SMTP: Resend.
- Dominio remitente: `auth.lystohogar.com`.
- Remitente de Auth: `Lysto <no-reply@auth.lystohogar.com>`.
- Host SMTP: `smtp.resend.com`, puerto `465`, usuario `resend`.
- Clave de envío exclusiva, limitada al dominio `auth.lystohogar.com`, creada para Supabase Auth y almacenada cifrada por Supabase.
- Dominio marcado `Verified` por Resend.
- DNS publicado y resuelto públicamente:
  - DKIM en `resend._domainkey.auth.lystohogar.com`.
  - Return-Path mediante `rsend.auth.lystohogar.com`.
  - Envío mediante `send.auth.lystohogar.com`.
  - DMARC inicial en `_dmarc.auth.lystohogar.com` con política de observación (`p=none`).

## Plantillas

Se cargaron en Supabase las versiones versionadas en el repositorio:

- `supabase/templates/confirmation.html` para confirmación de alta.
- `supabase/templates/recovery.html` para recuperación de contraseña.

Ambas usan `TokenHash` y una pantalla propia de Lysto. La vista previa del correo no consume el token; la confirmación o el cambio de contraseña ocurre dentro de la aplicación.

## Verificación

- Supabase confirmó la persistencia del SMTP después de recargar el panel.
- El endpoint real de recuperación de Supabase respondió `200`.
- Resend registró el mensaje generado por Supabase desde `no-reply@auth.lystohogar.com`.
- La credencial final se probó antes de retirar las anteriores; las claves expuestas durante la configuración fueron revocadas y no permanecen activas.
- La prueba final utilizó la plantilla en español y el asunto `Recuperá el acceso a Lysto`.
- Resend conserva evidencia previa de entrega exitosa a `lystoservicios@gmail.com` desde la misma cuenta.
- Las URLs públicas `/login`, `/registro`, `/recuperar`, `/terminos` y `/privacidad` responden `200` en `https://lystohogar.com`.
- Google permanece deshabilitado y no se ofrece en la interfaz pública hasta contar con credenciales OAuth propias.

## Registro de clientes activado

El titular del proyecto aprobó expresamente la apertura del registro de clientes y la publicación de los documentos vigentes. La migración `20260921043555_activate_customer_email_registration.sql` quedó aplicada en el proyecto real y `private.get_registration_policy()` devuelve una política de producción, no de prueba:

- versión de términos: `2026-09-21`;
- versión de privacidad: `2026-09-21`;
- términos: `https://lystohogar.com/terminos`;
- privacidad: `https://lystohogar.com/privacidad`;
- hash de términos: `96f54f1c8f4e8d5d1a97cc3da7cc4824b8ed2502cbd76031811b210fd0047e2f`;
- hash de privacidad: `356f64084c777590003daaeaa688374e365c89d47e93909c8e7d4ff9035d7819`.

## Verificación del alta y acceso reales

- `https://lystohogar.com/registro` publica el formulario de alta y muestra las dos versiones legales vigentes.
- Se creó una cuenta descartable mediante el endpoint real de Supabase Auth; el alta fue aceptada sin sesión previa.
- Antes de la confirmación, el inicio de sesión fue rechazado con `email_not_confirmed`, como corresponde.
- El reenvío de confirmación fue aceptado y Auth Logs registró `/signup` y `/resend` como completados.
- La cuenta se confirmó administrativamente solo para cerrar la comprobación sin acceder a un buzón personal.
- Después de la confirmación, el inicio de sesión por correo y contraseña creó una sesión válida.
- La identidad recibió exclusivamente `app_role=customer`; `bootstrap_customer_account` devolvió `ready` y `get_session_context` devolvió `customer`.
- Google continúa deshabilitado y no se ofrece en la interfaz pública.
- Técnicos, administradores y demás personal permanecen fuera de este registro y conservan sus flujos separados.

## Publicación y controles

- Cambios de activación: `fe0f2b0`.
- Ajuste de las pruebas de base de datos al estado activo: `9868b1b`.
- Verificación local: lint, tipos, 174 pruebas de dominio, 644 pruebas unitarias y compilación de producción, todo aprobado.
- GitHub Actions `#46`, ejecución `35562266777`, intento 3: Quality gates (Ubuntu), Domain tests (Windows) y `Publish main to lystohogar.com`, aprobados.
- Publicación de Vercel completada directamente con la sesión vinculada; deployment `dpl_EuoEiMdiUES3PzdevrnJKHqMzjp5`, estado `READY`, alias `https://lystohogar.com`.
- El secreto `VERCEL_TOKEN` quedó configurado cifrado en GitHub Actions mediante un token sin vencimiento y limitado al proyecto de producción de Lysto.
- El nombre interno histórico del proyecto en Vercel es `lysto-demo`, pero ese proyecto contiene la aplicación productiva y tiene asociados `lystohogar.com` y `www.lystohogar.com`.
- La publicación automática desde `main` quedó verificada de extremo a extremo: el trabajo de Vercel finalizó correctamente en 2 min 39 s.
