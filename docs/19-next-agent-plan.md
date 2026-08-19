# Próximo plan de agentes

Task 4 dejó una base Supabase local reproducible y revisada. Para continuar sin saltar gates, el orden correcto es:

## A00 Supervisor
- Conservar instalación frozen, 376 pgTAP, lint, typecheck, tests y build verdes.
- Convertir cualquier error de compilación en tareas concretas.
- No permitir secretos ni migraciones destructivas.

## A03 Supabase
- No modificar permisos 005–007 sin pgTAP positivo y negativo.
- Regenerar `database.types.ts` después de cualquier cambio de esquema.
- Mantener todo local hasta que exista un staging autorizado con secrets, dry-run, backup y plan de rollback.

## A04 Auth — próximo hito
- Implementar Task 5: login, sesiones, perfiles y protección por rol.
- Usar `app_metadata` + rol persistido; nunca confiar en `user_metadata` para autorización.
- Probar redirects, expiración, sesiones y acceso customer/pro/admin contra RLS real.

## A05 Cliente
- Sustituir mocks por queries server-side.
- Conectar wizard con `service_requests`, `request_answers`, `request_media`, `diagnosis_reports`, `price_options`.
- Conectar pagos reales.

## A06 Profesional
- Persistir onboarding en `professional_profiles`, `professional_documents`, `professional_tools`, `professional_service_zones`, `professional_availability`.
- Conectar estados de trabajo con `job_status_events`.
- Conectar cierre técnico con `job_final_reports`, `customer_equipment`, `equipment_service_records`.

## A07 Admin
- Conectar todas las tablas del panel admin.
- Implementar acciones server-side con audit log.
- Matching real: `rankProfessionals` + queries a profesionales aprobados.

## A08 Mercado Pago
- Crear preferencia real.
- Webhook real idempotente.
- OAuth profesional.
- Split marketplace cuando credenciales y configuración estén disponibles.

## A10 QA
- Ejecutar dominio, unit, pgTAP, integration y E2E.
- Cubrir flujo completo: cliente → pago → admin → profesional → cierre → review.
