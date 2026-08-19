# Diseño de la demo Lysto en Vercel y Supabase

**Fecha:** 2026-08-19

**Estado:** aprobado

**Entorno:** demostración/preproducción, no producción

## Objetivo

Publicar una demo navegable de Lysto en Vercel que se acerque a la experiencia final: login real, sesión persistente, redirección y aislamiento por rol, esquema Supabase remoto reproducible y tres cuentas de prueba. La demo permitirá revisar pantallas y recorridos mientras las integraciones comerciales continúan en desarrollo.

## Alcance aprobado

- Usar el proyecto Supabase `dqonlqcurvjnjgsczevu` exclusivamente como entorno de demostración.
- Aplicar las migraciones 001–007 y el seed piloto únicamente después de inspeccionar el proyecto remoto y ejecutar un dry-run.
- Conectar el login existente mediante Supabase Auth y sesiones SSR en cookies.
- Proteger las áreas `/app`, `/pro` y `/admin` con rol confiable.
- Crear cuentas confirmadas de cliente, técnico/profesional y administrador.
- Publicar un preview de Vercel separado, con pagos e integraciones externas en modo simulado.
- Entregar la URL y las tres credenciales al finalizar.

## Fuera de alcance

- Producción, dominio definitivo y SLA productivo.
- Mercado Pago real, split, OAuth, webhook y reembolso contra proveedor.
- Email, WhatsApp e IA reales.
- Conectar todas las pantallas a persistencia. Algunas conservarán datos de demostración mientras avanzan las tareas posteriores.
- Declarar completos staging, backups, observabilidad, E2E integral o revisión legal.

## Arquitectura

### Vercel

Se creará un proyecto preview `lysto-demo` desde la rama `feat/mvp-implementation`. El build usará Node 22 y pnpm 9.15.0. Las variables públicas incluirán la URL y publishable key de Supabase; pagos, email, WhatsApp e IA permanecerán desactivados o simulados.

La `service_role` no se expondrá al navegador ni se agregará a variables `NEXT_PUBLIC_*`. Tampoco se necesita en Vercel para el login normal. Si el aprovisionamiento administrativo requiere esa clave, se usará una sola vez desde un proceso local seguro y no quedará guardada en el repositorio.

### Supabase

El proyecto remoto será tratado como preproducción descartable, pero nunca se reseteará por suposición. Antes de modificarlo se comprobarán identidad, estado, historial y tablas existentes. El orden seguro será:

1. autenticar la cuenta propietaria;
2. enlazar explícitamente el project ref;
3. inspeccionar migraciones remotas;
4. ejecutar `db push --dry-run`;
5. aplicar migraciones y seed sólo si el resultado coincide con el entorno autorizado;
6. ejecutar smoke tests de esquema, RLS y Auth.

La sesión Supabase disponible al aprobar este diseño no enumera `dqonlqcurvjnjgsczevu`. La implementación debe pausar antes de cualquier cambio remoto hasta autenticar la cuenta que tenga acceso real.

### Auth y sesiones

El proyecto ya contiene clientes `@supabase/ssr`. Se completará el flujo mínimo:

- formulario de login con email y contraseña;
- acción de servidor con `signInWithPassword`;
- cookies de sesión y refresh seguro;
- lectura de usuario verificada en servidor;
- logout;
- redirección por rol;
- middleware sin confianza en parámetros del navegador.

El rol confiable será `app_metadata.app_role` y debe coincidir con `public.profiles.role`. Nunca se usará `user_metadata` para autorización.

## Cuentas de demostración

Se crearán, de forma idempotente y con email confirmado:

| Cuenta | Email | Destino |
|---|---|---|
| Cliente | `cliente.demo@lysto.test` | `/app` |
| Técnico | `tecnico.demo@lysto.test` | `/pro/dashboard` |
| Administrador | `admin.demo@lysto.test` | `/admin/dashboard` |

Cada usuario tendrá:

- contraseña fuerte y distinta, generada durante el aprovisionamiento;
- `app_metadata.app_role` correcto;
- fila vinculada en `public.profiles`;
- fila de subtipo en `customer_profiles`, `professional_profiles` o `admin_profiles`;
- técnico con estado `approved` y perfil suficiente para entrar al panel;
- administrador con permisos owner para recorrer toda la demo.

Las contraseñas no se escribirán en migraciones, seeds, documentación, logs ni commits. Se entregarán al propietario al terminar.

## Flujo de usuario

1. El visitante abre la URL de Vercel.
2. En `/login` ingresa una de las cuentas de prueba.
3. El servidor valida las credenciales con Supabase.
4. Se verifica que JWT y perfil persistido coincidan.
5. El usuario es redirigido a su área.
6. Si intenta abrir otra área, vuelve a su panel o recibe acceso denegado.
7. Al cerrar sesión se eliminan las cookies y vuelve al login.

## Manejo de errores

- Credenciales inválidas: mensaje genérico sin revelar si el email existe.
- Perfil faltante o rol inconsistente: cerrar sesión, registrar el problema sin datos sensibles y bloquear acceso.
- Supabase inaccesible: mostrar error recuperable y conservar la interfaz pública.
- Migraciones remotas inesperadas: detener el despliegue de base y no ejecutar reset.
- Variables faltantes en Vercel: fallar el build o el arranque con mensaje redactado.

## Seguridad

- No versionar secretos ni contraseñas demo.
- Mantener autorización real en servidor y RLS, no sólo ocultamiento visual.
- No usar service role en componentes cliente.
- Mantener pagos en `mock` y proveedores opcionales deshabilitados.
- Separar explícitamente demo de producción mediante nombre, variables y documentación.
- Rotar o eliminar las cuentas si la URL deja de usarse públicamente.

## Verificación

- Tests unitarios de resultado de login y redirección por rol.
- Tests de middleware: anónimo, cliente, técnico y admin.
- Typecheck, lint, suite completa y build.
- Dry-run antes de migrar Supabase remoto.
- Verificación de perfiles y permisos después del aprovisionamiento.
- Login real con las tres cuentas contra Supabase antes de publicar las credenciales.
- Preview de Vercel construido correctamente; la URL se entrega para validación manual del producto.

## Criterios de aceptación

- Existe una URL preview accesible.
- Las tres cuentas pueden iniciar y cerrar sesión.
- Cada cuenta llega a su panel y no entra en paneles ajenos.
- La base remota contiene el esquema esperado y datos piloto sin secretos.
- Ninguna clave privilegiada aparece en el cliente o Git.
- La interfaz conserva todas las rutas actuales y el build sigue verde.
- La documentación identifica claramente el entorno como demo/preproducción.
