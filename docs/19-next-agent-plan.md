# Próximo plan de agentes

Aunque se avanzó el bloque local sin GitHub/Supabase productivos, para seguir al 100% el orden correcto es:

## A00 Supervisor
- Revisar build real luego de instalar dependencias.
- Convertir cualquier error de compilación en tareas concretas.
- No permitir secretos ni migraciones destructivas.

## A03 Supabase
- Aplicar migraciones 001 y 002 en branch/staging.
- Correr tests RLS manuales desde SQL editor.
- Confirmar buckets privados.

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
- Ejecutar dominio, unit, integration, E2E.
- Cubrir flujo completo: cliente → pago → admin → profesional → cierre → review.
