# Matriz de alcance Lysto MVP Operativo

| Área | Estado local | Evidencia |
|---|---|---|
| Landing pública | Armado | app/(public)/page.tsx |
| Servicio aire acondicionado | Armado | app/(public)/servicios/aire-acondicionado/page.tsx |
| Login/registro | Armado UI + contratos auth | app/(auth), lib/auth/onboarding-access.ts |
| Wizard cliente | Armado UI + validación + diagnóstico + precio | features/service-request/air-conditioning-wizard.tsx |
| Diagnóstico preliminar | Implementado y testeado | lib/diagnosis/rules.ts, tests/domain/diagnosis.test.ts |
| Dirección/horario | Implementado en wizard y validación | lib/service-request/validation.ts |
| Dos precios | Implementado y testeado | lib/pricing/calculate-price.ts |
| Pago MP | Contratos API + split/idempotencia | lib/payments, app/api/mercadopago |
| Matching | Implementado y testeado | lib/matching/score-professionals.ts |
| Portal profesional | Pantallas + lógica de onboarding/respuesta/cierre | app/(professional), lib/professional, lib/use-cases/professional-workflow.ts |
| Registro equipo | Implementado y testeado | lib/equipment/equipment-registry.ts |
| Cierre técnico | Implementado y testeado | lib/jobs/final-report.ts |
| Comprobante/QR | Implementado a nivel token seguro | app/comprobante/[token], lib/qr/public-receipt.ts |
| Review | Implementado y testeado | app/(customer)/app/trabajos/[id]/review, lib/reviews |
| Admin | Pantallas y operaciones | app/(admin), lib/admin |
| Precios admin | Pantalla + lógica | app/(admin)/admin/precios, lib/admin/pricing-admin.ts |
| Calidad/garantía/reclamos | Pantallas + lógica | app/(admin)/admin/calidad, lib/quality, lib/warranty |
| Notificaciones | Contratos + templates | lib/notifications |
| Scheduling/SLA | Implementado V4 | lib/scheduling/service-slot.ts |
| Payout/Liquidación | Implementado V4 | lib/marketplace/payouts.ts |
| Release gates | Implementado V4 | lib/release/release-gates.ts |
| Supabase schema | Diseñado | supabase/migrations |
| RLS | Base diseñada + checklist | migrations + tests/rls |
| Tests dominio | 105/105 passing | checks/domain-test-output-v4.txt |
| Build/CI real | Pendiente por entorno | BLOCKERS.md |
| Supabase productivo | Pendiente por intervención | BLOCKERS.md |
| Mercado Pago real | Pendiente por credenciales | BLOCKERS.md |
