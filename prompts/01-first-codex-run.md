# Primera corrida recomendada en Codex

Repositorio: https://github.com/lystoservicios-sudo/lysto.git

Objetivo: levantar la base del MVP operativo completo de Lysto desde este paquete.

Pasos:

```bash
git clone https://github.com/lystoservicios-sudo/lysto.git
cd lysto
git checkout -b feat/mvp-operativo-base
# copiar el contenido del ZIP entregado dentro del repo
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Después conectar Supabase MCP:

```bash
codex mcp add supabase --url "https://mcp.supabase.com/mcp?project_ref=dqonlqcurvjnjgsczevu&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching"
codex mcp login supabase
/mcp
npx skills add supabase/agent-skills
```

No escribir secretos en README, docs, prompts ni commits.

Primera tarea de Codex luego de instalar dependencias:

1. Ejecutar checks.
2. Corregir cualquier error de lint/typecheck/build.
3. Revisar migración SQL en Supabase branch/staging.
4. No aplicar a producción sin confirmación.
5. Abrir PR contra `main`.
