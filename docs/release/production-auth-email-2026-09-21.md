# Correo de autenticación de producción — 2026-09-21

## Alcance

Configuración y verificación del correo transaccional usado por Supabase Auth en el proyecto de producción `dqonlqcurvjnjgsczevu`. Esta evidencia no contiene claves, tokens ni contraseñas.

## Configuración aplicada

- Proveedor SMTP: Resend.
- Dominio remitente: `auth.lystohogar.com`.
- Remitente de Auth: `Lysto <no-reply@auth.lystohogar.com>`.
- Host SMTP: `smtp.resend.com`, puerto `465`, usuario `resend`.
- Clave de envío exclusiva creada para Supabase Auth y almacenada cifrada por Supabase.
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
- Resend conserva evidencia previa de entrega exitosa a `lystoservicios@gmail.com` desde la misma cuenta.
- Las URLs públicas `/login`, `/registro`, `/recuperar`, `/terminos` y `/privacidad` responden `200` en `https://lystohogar.com`.
- Google permanece deshabilitado y no se ofrece en la interfaz pública hasta contar con credenciales OAuth propias.

## Bloqueo restante para abrir el registro

El correo de autenticación está operativo, pero el alta pública continúa cerrada por diseño. `private.account_registration_policy` permanece deshabilitada porque no existen versiones aprobadas de términos y privacidad. Las páginas actuales se identifican como borradores pendientes de aprobación.

Para abrir el registro se necesita una decisión humana de D08 que identifique al prestador y responsable de datos, apruebe el texto y deje constancia de versión, fecha efectiva y aprobador. Recién entonces deben calcularse los hashes de los documentos publicados, insertar las versiones aprobadas y habilitar la política. No se debe reemplazar esa aprobación con datos inventados ni con documentos de prueba.
