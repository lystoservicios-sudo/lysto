# Lysto — MVP en desarrollo

Lysto es una base de desarrollo para un marketplace gestionado de servicios técnicos para hogares. El alcance inicial se concentra en aire acondicionado en Buenos Aires, Argentina.

La rama `feat/mvp-implementation` reúne pantallas, dominio, contratos de API, configuración y automatizaciones de calidad. No representa todavía un sistema conectado y operativo de punta a punta: varias pantallas y APIs conservan datos simulados, y las integraciones externas siguen pendientes.

## Stack

- Next.js App Router y TypeScript.
- Tailwind CSS.
- Supabase Auth/Postgres/Storage como infraestructura prevista.
- Mercado Pago preparado para una integración futura.
- Tests de dominio y unitarios con Vitest.
- Playwright configurado, pero todavía sin una ejecución E2E registrada.
- GitHub Actions para los gates de calidad.

## Configuración local

Se requieren Node.js 22 y Corepack. Corepack lee `packageManager` y ejecuta pnpm 9.15.0 sin instalar shims globales:

```bash
node --version
corepack pnpm --version
corepack pnpm install --frozen-lockfile
```

`corepack enable` es opcional. Si falla por permisos, no hace falta usar una terminal de administrador: continuá anteponiendo `corepack` a los comandos de pnpm.

Copiá `.env.example` a `.env.local` y usá únicamente valores de desarrollo. Nunca commitees credenciales.

La guía completa está en [`docs/development/local-setup.md`](docs/development/local-setup.md).

Para iniciar la aplicación:

```bash
corepack pnpm dev
```

## Gates de calidad

Antes de entregar cambios se ejecutan, en este orden:

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

El script `scripts/bootstrap-local.sh` prepara pnpm, instala desde el lockfile y ejecuta los mismos gates.

## Evidencia actual

Evidencia local registrada el 2026-08-19:

- lint sin errores;
- typecheck sin errores;
- 124/124 tests de dominio aprobados;
- 41/41 tests unitarios aprobados;
- build de producción aprobado con 77 rutas;
- tests E2E de Playwright no ejecutados.

Ver el detalle en [`checks/TEST_RESULTS.md`](checks/TEST_RESULTS.md).

## Estado y próximo hito

- La UI cubre las superficies públicas, de cliente, profesional y administración, pero todavía incluye mocks.
- Las rutas API y la lógica de dominio tienen contratos y tests, pero no todas las operaciones están conectadas a persistencia e integraciones reales.
- Las migraciones, seeds y políticas Supabase heredadas son material de trabajo; no están aprobadas para desplegar.
- No se afirma que exista un proyecto Supabase real conectado ni que Mercado Pago esté activo.

El próximo hito es Task 4: revisión de seguridad, autorización y RLS. Hasta completarla no se deben aplicar los artefactos Supabase heredados a un entorno remoto.

## Reglas

- No subir secretos ni hardcodear credenciales.
- No aplicar migraciones destructivas sin revisión.
- Toda función crítica debe tener tests.
- Todo webhook debe ser idempotente.
- Todo cambio administrativo crítico debe auditarse.
- Toda transición de estado debe pasar por la máquina de estados central.
