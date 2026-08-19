# Instalación local

## 1. Copiar archivos al repo

```bash
git clone https://github.com/lystoservicios-sudo/lysto.git
cd lysto
git checkout -b feat/mvp-operativo-base
# descomprimir el ZIP en esta carpeta
```

## 2. Instalar pnpm

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
```

## 3. Instalar dependencias y verificar

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

## 4. Supabase

```bash
codex mcp add supabase --url "https://mcp.supabase.com/mcp?project_ref=dqonlqcurvjnjgsczevu&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching"
codex mcp login supabase
/mcp
npx skills add supabase/agent-skills
```

Aplicar migraciones solo después de revisar:

```bash
supabase link --project-ref dqonlqcurvjnjgsczevu
supabase db push
```
