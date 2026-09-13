# Acceso, registro y perfil de Lysto

La web pública usa `/login` y `/registro`. El acceso de personal existente sigue disponible en `/equipo/login`, sin enlaces en el sitio comercial. Las pantallas no muestran tipos de usuario.

## Configuración del entorno

- Configurar `NEXT_PUBLIC_APP_URL` con el origen real del sitio, `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (o la clave anon existente).
- Aplicar `20260913191315_customer_signup_provisioning.sql` al entorno que se vaya a usar. Esta migración asigna el rol de cliente desde un trigger privado, crea `profiles` y `customer_profiles`, y completa únicamente las claims ausentes de cuentas que ya tienen un perfil de cliente. No cambia roles de personal ni amplía permisos de escritura.
- Aplicar también `20260913193949_customer_request_readiness.sql`: impide crear servicios desde una llamada directa a `submit_service_quote` si faltan datos de perfil/dirección o el email no está confirmado. Las API de presupuesto y solicitud aplican la misma verificación antes de operar; las consultas de solo lectura siguen disponibles.
- En Supabase Auth, habilitar registro por email y confirmar emails; configurar un proveedor SMTP para entrega real.
- Configurar Site URL al mismo origen que `NEXT_PUBLIC_APP_URL`. Añadir a Redirect URLs el origen real con `/auth/callback**` y `/auth/confirm**`. Los patrones de localhost ya están en `supabase/config.toml`.
- Para Google, habilitar el proveedor en Supabase y cargar el Client ID/Client Secret correspondientes. En Google Cloud, registrar el callback de Supabase (`https://<proyecto>.supabase.co/auth/v1/callback`) como URI autorizada. La web consulta la disponibilidad del proveedor antes de iniciar el flujo; si no está habilitado ofrece continuar con email.

Los enlaces de email predeterminados de Supabase funcionan con `/auth/callback` y PKCE en el navegador que inició el proceso. También se incluye `/auth/confirm?token_hash=...&type=email` para plantillas con TokenHash (permite abrir desde otro navegador). Una plantilla de confirmación puede usar `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`; una de recuperación usa `type=recovery`. Esta variante vuelve a `/app` por defecto. El callback estándar conserva el servicio solicitado mediante `next`.

## Comportamiento

La identidad se valida con `getUser` en el servidor. El rol debe coincidir entre `app_metadata.app_role` y la base de datos; nunca se toma de `user_metadata`. Login y callbacks pasan por la misma validación de cuenta, confirmación de email y perfil. `/app` también hace esa verificación, por lo que no se puede omitir el perfil entrando directamente.

Se solicitan únicamente campos faltantes o inválidos: nombre, apellido, teléfono, calle, altura, localidad, provincia y tipo de propiedad. Se guardan en las tablas existentes con su RLS y permisos por columna. El servidor vuelve a leer la información guardada antes de permitir continuar. Si ya existe una dirección válida, se utiliza. No se piden nuevamente datos completos.

El formulario de solicitud se inicia con esa dirección guardada, incluidos piso/departamento, referencias, código postal, tipo de propiedad y condiciones de acceso. Admite casa, departamento, local y oficina. Si se usa sin una dirección inicial, sus campos quedan vacíos; no inventa un domicilio de ejemplo.

Solo se aceptan destinos locales dentro de `/app`; URLs externas, rutas de personal, parámetros encadenados y segmentos codificados se descartan. La sesión se refresca mediante middleware y las respuestas de autenticación se marcan como privadas, sin caché.

## Verificación

Pruebas unitarias: `pnpm exec vitest run customer-auth customer-profile-save login-form login-flow login-server-action-contract`.

Prueba de base de datos: `supabase/tests/database/customer_signup.test.sql` comprueba alta del perfil, aislamiento de personal, rechazo de elevación por metadata y ausencia de permisos para invocar funciones privilegiadas o modificar roles. Ejecutar contra Supabase local con `pnpm exec supabase test db` después de aplicar la migración al entorno local; no requiere modificar una base remota.

Para aceptación real: crear cuenta por email, confirmar, completar únicamente lo pendiente, comprobar datos persistidos después de cerrar sesión, probar Google con un proyecto habilitado, recuperar contraseña y verificar que entrar directamente a `/app` redirige al paso pendiente. Ninguna prueba local con proveedor simulado sustituye la verificación de entrega de email o de las credenciales de Google del entorno final.
