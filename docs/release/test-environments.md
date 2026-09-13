# Entornos y cuentas de pruebas

## Destinos autorizados del harness

El runner sólo admite `lysto_production_check` en API 56321/DB 56322 o `lysto_integration_ci` en API 54321/DB 54322. Los hosts deben ser localhost/127.0.0.1. El proyecto original `lysto` (55321/55322) no está permitido. No se admite un proyecto remoto cambiando sólo una variable.

Cada proyecto vive fuera del checkout persistente con `DISPOSABLE.json`: projectId, databasePort, apiPort y production=false. El runner compara ese marcador con supabase/config.toml y exige LYSTO_TEST_ENVIRONMENT=disposable y MERCADOPAGO_MODE=test. La identidad explícita no sustituye la comparación de URL/puertos.

Para el proyecto local ya creado:

```powershell
corepack pnpm test:integration -- --local-workdir E:/Proyectos/GitHub/Lysto-production-db-check
```

El argumento explícito permite leer las claves locales mediante `supabase status` en memoria. No imprime claves, carga .env.local ni usa enlaces remotos. Sin ese argumento se requieren LYSTO_TEST_IDENTITY_FILE, LYSTO_TEST_PROJECT_ID, LYSTO_TEST_ENVIRONMENT, LYSTO_TEST_DATABASE_URL, LYSTO_TEST_SUPABASE_URL, LYSTO_TEST_ANON_KEY, LYSTO_TEST_SERVICE_ROLE_KEY y MERCADOPAGO_MODE=test. El runner falla si falta cualquiera de las comprobaciones necesarias.

Se puede agregar un filtro de nombre de archivo después de los argumentos; no se admiten opciones de Vitest que alteren la seguridad del runner. Una ejecución sin tests o con casos skipped/todo/fallidos no acredita integración. Las ocho pruebas PostgreSQL de marketplace se ejecutan aquí y se excluyen de la suite unitaria, evitando contarlas dos veces.

## Identidades reales y limpieza

`createFixtureAccounts` crea dos clientes, profesionales aprobado/suspendido y administradores operations/finance/quality/owner. Cada corrida usa UUIDs y correos únicos del dominio reservado lysto.test. Auth crea las identidades y emite las sesiones mediante signInWithPassword; los roles provienen de app_metadata y perfiles almacenados. Las comprobaciones RLS usan clientes autenticados con sus JWT individuales. El servicio administrativo sólo crea/elimina fixtures; no acredita permisos de usuario.

El helper limita sus solicitudes HTTP al origen de Supabase descartable y rechaza redirecciones. No contacta Mercado Pago. Las pruebas de pagos usan su proveedor simulado y PostgreSQL real. La limpieza cierra las sesiones y elimina únicamente los usuarios que creó esa corrida. Los escenarios futuros con registros adicionales deben retirar sus propias dependencias antes de invocar la limpieza común, sin limpiar tablas completas ni datos ajenos.

La promesa de creación expone `cleanup()` antes de resolver, para no depender de un setup colgado en `afterAll`. Setup vence en 150 segundos; Auth limita también la lectura del cuerpo y PostgreSQL tiene plazos de consulta/bloqueo. Cleanup cancela setup, cierra la conexión y continúa con todos los UUID aunque alguno falle. Los UUID se registran antes de solicitar el alta. Un alta con respuesta incierta conserva `cleanup_failed` y sus IDs en `output/integration/fixtures-<runId>.json`; requiere reconciliar exclusivamente esos IDs y nunca se declara limpia por una respuesta perdida.

## Correo y navegador

El proyecto local dispone de Mailpit en 56324, con puertos SMTP/POP propios y sin SMTP externo. Las altas del fixture usan email_confirm para evitar correos; las pruebas de entrega, recuperación y tokens de T07 deben utilizar este buzón. No se confunde la configuración del buzón con una prueba de entrega.

Playwright usa LYSTO_E2E_BASE_URL, por defecto http://127.0.0.1:3100, para navegador y servidor. No reutiliza servidores existentes. LYSTO_E2E_PRODUCTION=1 compila y arranca producción en .next-e2e; la variable de build separa los artefactos de desarrollo. Hay proyectos Chromium móvil/escritorio y WebKit móvil; CI debe instalar ambos motores y exigir su ejecución (T33/T34). Un listado de tests no acredita que hayan pasado.

Antes de compilar o iniciar Next, los servidores de Playwright y de integración exigen las mismas variables LYSTO_TEST_* y el marcador descartable. Reemplazan las credenciales de Supabase por las locales y eliminan las de Mercado Pago. Rechazan archivos `.env`, `.env.local` y sus variantes de desarrollo/test/producción en el checkout de prueba, porque Next podría cargarlos y reintroducir servicios remotos. `.env.example` se puede conservar. Las pruebas de esta barrera se ejecutan con `pnpm test:tooling`.

Referencias verificadas: [crear usuarios Auth](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [sesiones por contraseña](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), [configuración local](https://supabase.com/docs/guides/local-development/cli/config).
