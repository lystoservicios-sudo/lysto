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

No enlaces un proyecto ni apliques migraciones desde esta guía. Las migraciones, seeds y políticas Supabase heredadas no están aprobadas para desplegar hasta completar Task 4 de seguridad, autorización y RLS.

La presencia de esos archivos no demuestra que exista un proyecto Supabase real conectado.
