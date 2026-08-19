# Lysto — MVP Operativo

Lysto es una web app responsive, mobile-first, para operar un marketplace gestionado de servicios técnicos para hogares. El MVP inicial cubre técnicos de aire acondicionado en Buenos Aires, Argentina.

## Alcance real del MVP

No es una demo. Esta base está pensada para operar el negocio de punta a punta:

- Cliente: landing, registro/login, solicitud guiada, diagnóstico preliminar, dirección, horario, presupuesto Flexible/Prioridad, pago, seguimiento, review e historial de equipos.
- Profesional: onboarding por invitación, aprobación, documentación, herramientas, zonas, solicitudes, trabajos, registro técnico, cierre, QR/comprobante y pagos.
- Admin: operación completa, invitaciones, aprobación, clientes, solicitudes, matching/asignación, trabajos, pagos, precios, diagnóstico, calidad y auditoría.

## Stack

- Next.js App Router + TypeScript.
- Tailwind CSS.
- Supabase Auth/Postgres/Storage/RLS.
- Mercado Pago preparado por módulo.
- Tests de dominio, Vitest y Playwright.
- GitHub Actions.

## Instalación

```bash
pnpm install
pnpm dev
```

Si no tenés `pnpm`:

```bash
npm install -g pnpm
```

## Variables de entorno

Copiar `.env.example` a `.env.local`. No subir `.env.local`.

```bash
cp .env.example .env.local
```

## Tests

```bash
pnpm test:domain
pnpm typecheck
pnpm lint
pnpm build
```

Los tests de dominio se pueden correr sin instalar dependencias externas con Node 22:

```bash
node --experimental-strip-types tests/run-domain-tests.ts
```

## Supabase MCP

```bash
codex mcp add supabase --url "https://mcp.supabase.com/mcp?project_ref=dqonlqcurvjnjgsczevu&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching"
codex mcp login supabase
/mcp
npx skills add supabase/agent-skills
```

## Reglas

- No subir secretos.
- No hardcodear credenciales.
- No hacer migraciones destructivas sin revisión.
- Todas las funciones críticas deben tener tests.
- Toda tabla sensible debe tener RLS.
- Todo webhook debe ser idempotente.
- Todo cambio admin crítico debe auditarse.
- Toda transición de estado debe pasar por la máquina central.

## Estado de implementación local

Ver:

- `docs/18-current-implementation-status.md`
- `checks/ROUTE_INVENTORY.md`
- `checks/TEST_RESULTS.md`

Estado actual:

- Pantallas públicas, cliente, profesional y admin creadas.
- Diseño visual mobile-first con componentes reutilizables.
- Dominio principal implementado y testeado.
- Migraciones Supabase diseñadas.
- API routes contractuales preparadas.
- 50/50 tests de dominio pasando.

Pendiente externo:

- Instalar dependencias y ejecutar `pnpm build`/`pnpm typecheck` en entorno con Node + pnpm.
- Subir a GitHub manualmente o resolver permiso 403 de la integración.
- Aplicar migraciones a Supabase real.
- Cargar secrets y credenciales reales.
- Activar Mercado Pago real/sandbox.
