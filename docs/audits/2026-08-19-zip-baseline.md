# Auditoría de línea base del ZIP de Lysto

**Fecha:** 19/08/2026

**Fuente:** `lysto-mvp-operativo-v4.zip`

**Raíz del proyecto dentro del ZIP:** `lysto/`

**SHA-256:** `5355BE23D06CA41A787A0AF30A422D9B8E7FC17954061D1297108DB84D893C7B`

## Alcance de la importación

Se importó la base recuperable de la aplicación preservando los documentos aprobados de `docs/plans/`. La copia excluyó `tsconfig.tsbuildinfo`, `node_modules`, `.next`, cualquier `.git` anidado y todos los archivos `.env*` salvo `.env.example`. El ZIP no contenía `node_modules`, `.next` ni un repositorio Git anidado.

`.env.example` contiene únicamente valores de desarrollo o marcadores y no se importaron credenciales, contraseñas ni tokens reales. `.gitignore` ya cubre dependencias, artefactos de Next.js, archivos `.env*` salvo el ejemplo y archivos `*.tsbuildinfo`, por lo que no necesitó reglas adicionales.

## Dependencias reproducibles

`pnpm install --frozen-lockfile=false` resolvió 579 paquetes, agregó 474 y generó `pnpm-lock.yaml`. Informó una dependencia directa obsoleta (`@testing-library/jest-dom@6.10.0`) y dos subdependencias obsoletas (`uuid@9.0.1` y `whatwg-encoding@3.1.1`).

Una segunda ejecución con `pnpm install --frozen-lockfile` terminó con código 0 y no modificó el lockfile. Su SHA-256 permaneció en `E2079ACA2B8378E8BA7DF53ED4FB7C4EC3984248F2B1E763266C2E147121593D`.

El launcher global disponible fuera del proyecto es pnpm 11.18.0. Dentro del proyecto, `packageManager` selecciona pnpm 9.15.0 como versión efectiva. El lockfile usa formato 9.0 y la instalación congelada fue reproducible con esa versión efectiva.

## Cinco controles de línea base

Los controles se ejecutaron por separado desde Windows con Node.js 22.23.2 y pnpm efectivo 9.15.0. Todos fallan en esta línea base; estos resultados son fallas heredadas conocidas y no una certificación de funcionamiento.

### 1. `pnpm test:domain`

- **Resultado:** FAIL, código 1.
- `tests/domain/schema-contract.test.ts` usa `URL.pathname` como ruta nativa.
- Node intenta leer una ruta con la unidad duplicada: `E:\\E:\\...\\supabase\\migrations\\202608190001_initial_schema.sql`.
- La ejecución se detiene con `ENOENT` antes de completar las pruebas de dominio.

### 2. `pnpm typecheck`

- **Resultado:** FAIL, código 2.
- TypeScript informa 13 errores.
- Hay contratos divergentes en asignación administrativa y respuesta profesional.
- Falta el módulo `@/lib/quality/support`.
- Existen tipos incompletos en el formulario del cliente, cookies de Supabase y fixtures de onboarding profesional.

### 3. `pnpm lint`

- **Resultado:** FAIL, código 1.
- ESLint informa 15 problemas: 14 errores y 1 advertencia.
- Un error corresponde a navegación interna con `<a>` en `components/layout/marketing-header.tsx`.
- Trece errores son usos explícitos de `any` en `lib/data-access/supabase/repository.ts`.
- La advertencia corresponde al export por defecto anónimo en `eslint.config.mjs`; `--max-warnings=0` también la vuelve bloqueante.

### 4. `pnpm test:unit`

- **Resultado:** FAIL, código 1.
- Vitest no encuentra archivos que coincidan con `tests/**/*.vitest.{test,spec}.ts(x)`.

### 5. `pnpm build`

- **Resultado:** FAIL, código 1.
- Next.js no puede resolver `@/lib/quality/support`, importado por `app/api/quality/open-case/route.ts`.
- Next.js también advierte que `experimental.typedRoutes` pasó a `typedRoutes`, pero el bloqueo de compilación comprobado es el módulo inexistente.

## Riesgos recuperados que requieren trabajo posterior

- Se encontraron 40 archivos de pantallas, componentes o handlers que dependen de `lib/mock/lysto-data.ts`; la información simulada todavía domina recorridos críticos.
- Las políticas iniciales de Storage en `supabase/migrations/202608190001_initial_schema.sql` permiten insertar en tres buckets a cualquier usuario autenticado sin comprobar pertenencia del objeto, solicitud, trabajo o profesional.
- La política `public receipts are public with token` de `supabase/migrations/202608190002_operational_extensions.sql` permite seleccionar cualquier fila no revocada; no exige que la consulta conozca el token. Debe reemplazarse por una interfaz limitada y verificable antes de exponer comprobantes.
- La base importada no debe presentarse como funcional ni apta para producción hasta estabilizar toolchain, contratos, seguridad y persistencia en las tareas siguientes del plan.

## Conclusión

El ZIP es una base de código amplia y recuperable, pero su estado comprobado es deliberadamente rojo. El lockfile permite reproducir esta línea base y los cinco controles anteriores establecen el punto de partida exacto para la estabilización.
