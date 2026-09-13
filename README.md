# Lysto

Lysto es un marketplace gestionado de servicios técnicos para hogares, con alcance inicial de aire acondicionado en Buenos Aires. Este repositorio contiene la preparación de producto y operación para clientes, profesionales y operadores.

## Estado actual

**Preparación local avanzada; producción no habilitada.** Las 40 tareas de la hoja de ruta fueron abordadas, pero varias conservan verificaciones de DB, staging, proveedor, responsables o piloto real. El contador de tareas no autoriza tráfico ni cobros. El estado verificable está en [production-handover](docs/release/production-handover.md) y el registro estructurado en [production-progress](docs/plans/2026-09-10-production-progress.json).

## Desarrollo local

Requiere Node.js 22 y pnpm 9.15.0 mediante Corepack:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm test:tooling
corepack pnpm build
```

Copiar `.env.example` a `.env.local` sólo con valores del entorno autorizado. Por decisión del proyecto, la base usa exclusivamente el Supabase remoto conectado; su esquema está reconciliado y las pruebas SQL se ejecutan con rollback. No iniciar Supabase local ni Docker para esta hoja de ruta. Nunca registrar credenciales o datos reales en el checkout.

## Release

Los gates G01–G16 y la evidencia firmada gobiernan el lanzamiento. `technical` exige G01–G13, `pilot` G01–G15 y `general` G01–G16. Crear un inventario NO-GO desde un checkout limpio:

```bash
corepack pnpm release:manifest -- --release-id <id> --environment staging --output output/release/<id>/manifest.json
```

Seguir [release-policy](docs/release/release-policy.md), [production-runbook](docs/release/production-runbook.md) y [go-no-go](docs/release/go-no-go.md). No publicar políticas definitivas, desplegar, activar cobros ni abrir tráfico basándose sólo en documentación local.

## Reglas técnicas

- Secretos fuera del repositorio y logs; cuentas personales con MFA.
- Mutaciones críticas autorizadas en servidor, invariantes en transacción y auditoría durable.
- Webhooks, comandos, outbox, pagos y devoluciones idempotentes.
- RLS y Storage privado por propietario/rol; DTO mínimos y paginación estable.
- Migraciones compatibles, backup verificado, rollback de aplicación y restore sólo bajo incidente.
