# Lysto V4 - Continuación sin depender de GitHub/Supabase productivo

Fecha: 2026-08-19

> **DOCUMENTO HISTÓRICO — CORTE V4 DEL 2026-08-19.** Los conteos y bloqueos que siguen se conservan como registro de ese momento y ya no representan el estado vigente. Consultá [`README.md`](../README.md), [`checks/TEST_RESULTS.md`](../checks/TEST_RESULTS.md) y [`docs/18-current-implementation-status.md`](18-current-implementation-status.md) para la evidencia actual.

## Decisión de supervisión
No se considera terminado al 100% productivo mientras falten credenciales, migraciones aplicadas en Supabase real, CI ejecutado con dependencias, Mercado Pago sandbox y QA mobile manual. Como esas tareas requieren intervención externa, se siguió avanzando en áreas que no dependen de eso.

## Avances V4

### Seguridad/Auth
- Se agregó `lib/auth/onboarding-access.ts`.
- Valida registro de cliente.
- Valida invitación profesional.
- Define acceso por rol a `/app`, `/pro`, `/admin`.
- Define redirección posterior al login.
- Normaliza teléfonos argentinos.

### Scheduling/SLA
- Se agregó `lib/scheduling/service-slot.ts`.
- Clasifica cupos por franja horaria.
- Calcula SLA estimado según prioridad/distancia/estacionamiento.
- Recomienda slots por zona.
- Bloquea slots completos.

### Marketplace/Payout
- Se agregó `lib/marketplace/payouts.ts`.
- Decide si un pago está listo para liquidar al profesional.
- Bloquea liquidación si hay reclamo/calidad abierta.
- Bloquea liquidación si falta cuenta Mercado Pago profesional.
- Genera referencia de liquidación sanitizada.

### Release gates
- Se agregó `lib/release/release-gates.ts`.
- Define criterios objetivos para decidir demo vs lanzamiento.
- Evita mentir sobre producción: si faltan secrets, build, e2e o MP sandbox, no se marca launch ready.

### Tests agregados
- `tests/domain/auth-access.test.ts`
- `tests/domain/scheduling.test.ts`
- `tests/domain/payouts.test.ts`
- `tests/domain/release-gates.test.ts`

Resultado actual de dominio:

```txt
105/105 tests passed
```

## Estado real

### Implementado como código base local
- Pantallas y rutas principales.
- Lógica de dominio.
- Migraciones y seed.
- Contratos API.
- Tests de dominio.
- CI configurado.
- Documentación técnica.

### No verificable todavía desde esta sesión
- `pnpm install`, por falta de red en el runtime.
- `pnpm build`, porque no están instaladas dependencias.
- Playwright real, porque faltan browsers/deps.
- Supabase real, porque requiere aplicar migraciones con sesión local.
- Mercado Pago real, porque requiere credenciales.
- GitHub push, porque el conector devolvió 403.

## Próximo bloque lógico
1. Instalar dependencias localmente.
2. Corregir cualquier error real de typecheck/build con dependencias instaladas.
3. Aplicar migraciones en Supabase staging.
4. Probar auth real.
5. Probar Mercado Pago sandbox.
6. Ejecutar Playwright.
7. Subir rama y PR.
