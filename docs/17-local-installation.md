# Instalación local

La guía canónica y mantenida está en [`docs/development/local-setup.md`](development/local-setup.md).

## Inicio rápido seguro

Usá Node.js 22 y ejecutá pnpm mediante Corepack. Corepack lee `packageManager` y selecciona pnpm 9.15.0 sin instalar comandos globales:

```bash
node --version
corepack pnpm --version
corepack pnpm install --frozen-lockfile
```

`corepack enable` es opcional. Si falla por permisos, no requiere una terminal de administrador; continuá usando `corepack pnpm ...`.

Creá `.env.local` a partir de `.env.example` y completá solo valores de desarrollo mediante canales seguros. No commitees credenciales.

Ejecutá los gates actuales:

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

## Supabase

El esquema local endurecido puede recrearse y probarse sin enlazar un proyecto remoto:

```bash
corepack pnpm supabase start
corepack pnpm supabase db reset --local
corepack pnpm supabase test db --local
corepack pnpm supabase db lint --local --schema public --schema private --level warning --fail-on warning
```

Estos comandos sólo operan el stack local. No uses `link`, `db push` ni credenciales remotas desde esta guía; la evidencia local no demuestra que exista un proyecto Supabase real conectado ni autoriza un despliegue.
