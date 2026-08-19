# Configuración local

## Requisitos

El proyecto usa Node.js 22 y pnpm 9.15.0. Un gestor de versiones de Node puede leer `.node-version` para seleccionar la versión correcta.

Después de instalar Node.js 22, invocá pnpm mediante Corepack. Corepack lee la versión exacta desde `packageManager`:

```bash
node --version
corepack pnpm --version
```

Las versiones esperadas son Node `v22.x` y pnpm `9.15.0`. No instales otra versión de pnpm ni actualices dependencias como parte del setup.

`corepack enable` es opcional y solo crea comandos globales más cortos. Si falla por permisos de escritura, no solicites permisos de administrador: usá `corepack pnpm ...` como se muestra en esta guía.

## Instalar dependencias

Desde la raíz del repositorio, instalá exactamente las versiones registradas en el lockfile:

```bash
corepack pnpm install --frozen-lockfile
```

Si el lockfile y `package.json` no coinciden, detenete y revisá el cambio en lugar de regenerar o actualizar dependencias automáticamente.

## Variables de entorno

Creá `.env.local` a partir del archivo de ejemplo:

```powershell
Copy-Item .env.example .env.local
```

En macOS o Linux:

```bash
cp .env.example .env.local
```

Completá únicamente las variables necesarias para la tarea con valores de desarrollo. El ejemplo no contiene secretos y no se deben agregar credenciales reales a `.env.example`.

## Desarrollo y verificaciones

Iniciá la aplicación con:

```bash
corepack pnpm dev
```

Antes de entregar un cambio, ejecutá las comprobaciones aplicables:

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

## Supabase local

La CLI de Supabase está fijada como dependencia de desarrollo del proyecto. Para trabajar sobre base de datos, Auth, RLS o Storage, iniciá el stack local y recreá el esquema desde cero:

```bash
corepack pnpm supabase start
corepack pnpm supabase db reset --local
corepack pnpm supabase test db --local
corepack pnpm supabase db lint --local --schema public --schema private --level warning --fail-on warning
```

Estos comandos usan únicamente los servicios locales configurados en `supabase/config.toml`. No ejecutes `link`, `db push` ni comandos contra un proyecto remoto como parte del setup local. La presencia de migraciones verificadas no significa que exista un proyecto Supabase remoto conectado ni autoriza un despliegue.

Los archivos temporales de Supabase deben permanecer fuera del control de versiones. Las migraciones y `supabase/seed.sql`, en cambio, sí son parte del repositorio.

## Trabajo con worktrees

Usá un worktree y una rama por tarea. En cada worktree:

1. Confirmá la rama activa antes de editar.
2. Ejecutá `corepack pnpm install --frozen-lockfile` dentro de ese worktree.
3. Creá su propio `.env.local` si la tarea lo necesita.
4. Revisá el diff y las verificaciones antes de commitear.

No compartas ni copies `node_modules` o `.env.local` entre worktrees.

## Credenciales

Nunca commitees contraseñas, tokens, claves API, credenciales de servicio ni archivos `.env` reales. Si una credencial se expone por error, detené el trabajo y pedí su rotación; eliminarla de un commit posterior no la invalida ni la borra del historial.
