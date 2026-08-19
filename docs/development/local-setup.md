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

Supabase local no forma parte del setup obligatorio actual. Si una tarea futura requiere una instancia local, instalá y configurá la CLI de Supabase siguiendo la documentación acordada por el equipo antes de iniciar sus servicios. La presencia de migraciones o configuración en el repositorio no significa que exista un proyecto remoto real conectado.

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
