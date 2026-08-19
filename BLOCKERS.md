# Blockers reales para terminar integración en entorno del proyecto

Estas tareas requieren acceso, credenciales o decisiones externas. No bloquean seguir desarrollando pantallas, dominio y tests locales, pero sí bloquean dejar producción real conectada.

## 1. GitHub

Estado: la integración intentó escribir en `lystoservicios-sudo/lysto` y devolvió `403 Resource not accessible by integration`.

Acción requerida:

```bash
git clone https://github.com/lystoservicios-sudo/lysto.git
cd lysto
git checkout -b feat/mvp-operativo-base
unzip /ruta/lysto-mvp-operativo-v3.zip -d /tmp/lysto_pkg
cp -R /tmp/lysto_pkg/lysto/. .
git add .
git commit -m "chore: initialize lysto mvp operativo"
git push -u origin feat/mvp-operativo-base
```

## 2. Dependencias

Estado: el entorno actual no pudo descargar pnpm desde registry.

Acción requerida en tu máquina:

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

## 3. Supabase MCP / Supabase real

Estado: migraciones y seeds están creados, pero no aplicados al proyecto real desde este entorno.

Acción requerida:

```bash
codex mcp add supabase --url "https://mcp.supabase.com/mcp?project_ref=dqonlqcurvjnjgsczevu&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching"
codex mcp login supabase
/mcp
```

Luego aplicar migraciones desde Supabase CLI/Codex MCP.

## 4. Secrets

No se subió ningún secreto al repo. Configurar localmente:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
MERCADOPAGO_PUBLIC_KEY=
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=
LYSTO_DEFAULT_PLATFORM_FEE_RATE=0.18
```

## 5. Mercado Pago real

Pendiente:

- Credenciales sandbox/producción.
- Webhook URL pública.
- Confirmar modelo exacto: cobro directo, autorización/captura, split marketplace, pago a cuenta o liquidación posterior.
- OAuth profesional para split.

## 6. Decisiones comerciales/legales

Pendiente de validación humana:

- Texto legal de garantía.
- Política de devolución.
- Relación comercial con profesionales.
- Comisión Lysto.
- Momento exacto de liberación/liquidación de pagos.
