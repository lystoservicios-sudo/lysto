# Test results

Fecha: 2026-08-19

## Ejecutado en este entorno

```bash
node --experimental-strip-types tests/run-domain-tests.ts
```

Resultado actual:

```txt
124/124 tests passed
```

Cobertura de los tests ejecutados:

- Diagnóstico preliminar de aire acondicionado.
- Pricing Flexible/Prioridad.
- Máquina de estados de requests, jobs y payments.
- Matching profesional.
- Permisos por rol.
- Reviews y calidad.
- Cierre técnico.
- Validación de solicitud cliente.
- Flujo operativo completo cliente → pago → job → asignación → aceptación → cierre → review.
- Cola operativa admin.
- Herramientas del profesional.
- Comprobante público seguro.
- Workflows admin.
- Respuesta profesional a solicitudes.
- Registro de equipos.
- Garantías, soporte y notificaciones.
- KPIs operativos.
- Contrato de schema Supabase: tablas obligatorias, RLS y migraciones sin versiones duplicadas.
- Mantenimientos recomendados.
- Validaciones de formularios cliente/profesional/admin/cierre técnico.
- Inventario de pantallas obligatorias.
- Inventario de route handlers API obligatorios.
- Migración transaccional RPC de Supabase.
- Simulación integral end-to-end de dominio.
- Auth/access redirects.
- Scheduling/SLA.
- Payout/liquidación.
- Release gates.

## No ejecutado en este entorno

No se pudieron ejecutar estos comandos porque no hay dependencias instaladas en el runtime actual y no hay acceso al registry npm desde este contenedor:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test:e2e
pnpm build
```

Quedan preparados en `package.json`, `vitest.config.ts`, `playwright.config.ts` y `.github/workflows/ci.yml` para correr en la máquina local o GitHub Actions.
