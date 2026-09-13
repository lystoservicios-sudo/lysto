# Inventario de API

Generado desde los métodos exportados en `app/api/**/route.ts`. Total: **94 métodos**. El control automático falla si aparece o desaparece un método sin regenerar este archivo.

| Método | Ruta | Estado | Autoridad | Destino canónico | Prueba contractual |
|---|---|---|---|---|---|
| `POST` | `/api/admin/approve-professional` | Retirada 410 | Pública; contrato retirado, sin mutación | `/api/admin/professionals/approve` | `tests/unit/api-route-contracts.vitest.test.ts` |
| `POST` | `/api/admin/assign-professional` | Retirada 410 | Pública; contrato retirado, sin mutación | `/api/pricing/offers` | `tests/unit/api-route-contracts.vitest.test.ts` |
| `GET` | `/api/admin/audit` | Activa | Sesión: admin | `/api/admin/audit` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/admin/invite-professional` | Activa | Sesión: admin; permiso operations | `/api/admin/invite-professional` | `tests/integration/api-inventory.test.ts` |
| `PATCH` | `/api/admin/invite-professional` | Activa | Sesión: admin; permiso operations | `/api/admin/invite-professional` | `tests/integration/api-inventory.test.ts` |
| `GET` | `/api/admin/notifications` | Activa | Sesión: sesión; permiso operations | `/api/admin/notifications` | `tests/integration/api-inventory.test.ts` |
| `PATCH` | `/api/admin/notifications` | Activa | Sesión: sesión; permiso operations | `/api/admin/notifications` | `tests/integration/api-inventory.test.ts` |
| `GET` | `/api/admin/permissions` | Activa | Sesión: sesión; permiso owner | `/api/admin/permissions` | `tests/integration/api-inventory.test.ts` |
| `PUT` | `/api/admin/permissions` | Activa | Sesión: sesión; permiso owner | `/api/admin/permissions` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/admin/pricing/update` | Retirada 410 | Pública; contrato retirado, sin mutación | `/api/pricing/policy` | `tests/unit/api-route-contracts.vitest.test.ts` |
| `POST` | `/api/admin/professionals/approve` | Activa | Sesión: admin; permiso operations | `/api/admin/professionals/approve` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/admin/professionals/documents/review` | Activa | Sesión: admin; permiso operations | `/api/admin/professionals/documents/review` | `tests/integration/api-inventory.test.ts` |
| `GET` | `/api/admin/professionals/invitations` | Activa | Sesión: sesión; permiso operations | `/api/admin/professionals/invitations` | `tests/integration/api-inventory.test.ts` |
| `GET` | `/api/admin/professionals/review` | Activa | Sesión: admin; permiso operations | `/api/admin/professionals/review` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/admin/professionals/review` | Activa | Sesión: admin; permiso operations | `/api/admin/professionals/review` | `tests/integration/api-inventory.test.ts` |
| `GET` | `/api/admin/professionals` | Activa | Sesión: sesión; permiso operations | `/api/admin/professionals` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/admin/professionals/suspend` | Activa | Sesión: admin; permiso operations | `/api/admin/professionals/suspend` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/contact` | Activa | Sesión y autorización verificadas por el servicio de la ruta | `/api/contact` | `tests/integration/api-inventory.test.ts` |
| `GET` | `/api/customer/addresses` | Activa | Sesión: customer | `/api/customer/addresses` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/customer/addresses` | Activa | Sesión: customer | `/api/customer/addresses` | `tests/integration/api-inventory.test.ts` |
| `PUT` | `/api/customer/addresses` | Activa | Sesión: customer | `/api/customer/addresses` | `tests/integration/api-inventory.test.ts` |
| `DELETE` | `/api/customer/addresses` | Activa | Sesión: customer | `/api/customer/addresses` | `tests/integration/api-inventory.test.ts` |
| `GET` | `/api/customer/equipment/photos` | Activa | Sesión: customer | `/api/customer/equipment/photos` | `tests/integration/api-inventory.test.ts` |
| `GET` | `/api/customer/equipment` | Activa | Sesión: customer | `/api/customer/equipment` | `tests/integration/api-inventory.test.ts` |
| `DELETE` | `/api/customer/equipment` | Activa | Sesión: customer | `/api/customer/equipment` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/customer/profile/email` | Activa | Sesión: customer | `/api/customer/profile/email` | `tests/integration/api-inventory.test.ts` |
| `GET` | `/api/customer/profile` | Activa | Sesión: customer | `/api/customer/profile` | `tests/integration/api-inventory.test.ts` |
| `PUT` | `/api/customer/profile` | Activa | Sesión: customer | `/api/customer/profile` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/customer/request/submit` | Activa | Sesión y autorización verificadas por el servicio de la ruta | `/api/customer/request/submit` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/diagnosis/generate` | Activa | Sesión: customer,admin | `/api/diagnosis/generate` | `tests/unit/diagnosis-route.vitest.test.ts` |
| `POST` | `/api/equipment/register` | Activa | Sesión: customer | `/api/equipment/register` | `tests/integration/api-inventory.test.ts` |
| `GET` | `/api/health/live` | Activa | Pública; sonda mínima | `/api/health/live` | `tests/integration/api-inventory.test.ts` |
| `GET` | `/api/health/ready` | Activa | Pública; sonda mínima | `/api/health/ready` | `tests/integration/api-inventory.test.ts` |
| `GET` | `/api/internal/outbox` | Activa | Servicio interno; secreto específico | `/api/internal/outbox` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/internal/outbox` | Activa | Servicio interno; secreto específico | `/api/internal/outbox` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/internal/refunds` | Activa | Servicio interno; secreto específico | `/api/internal/refunds` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/jobs/advance` | Retirada 410 | Pública; contrato retirado, sin mutación | `/api/pricing/job/status` | `tests/unit/api-route-contracts.vitest.test.ts` |
| `POST` | `/api/jobs/cancel` | Activa | Sesión: admin; permiso operations | `/api/jobs/cancel` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/jobs/confirm` | Activa | Sesión: customer | `/api/jobs/confirm` | `tests/integration/api-inventory.test.ts` |
| `GET` | `/api/jobs/extras` | Activa | Sesión: professional,customer,admin | `/api/jobs/extras` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/jobs/extras` | Activa | Sesión: professional,customer,admin | `/api/jobs/extras` | `tests/integration/api-inventory.test.ts` |
| `PATCH` | `/api/jobs/extras` | Activa | Sesión: professional,customer,admin | `/api/jobs/extras` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/jobs/final-report` | Activa | Sesión: professional | `/api/jobs/final-report` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/jobs/reschedule` | Activa | Sesión: customer,professional,admin | `/api/jobs/reschedule` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/jobs/update-status` | Retirada 410 | Pública; contrato retirado, sin mutación | `/api/pricing/job/status` | `tests/unit/api-route-contracts.vitest.test.ts` |
| `GET` | `/api/maintenance/schedule` | Activa | Sesión: customer | `/api/maintenance/schedule` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/maintenance/schedule` | Activa | Sesión: customer | `/api/maintenance/schedule` | `tests/integration/api-inventory.test.ts` |
| `GET` | `/api/mercadopago/account` | Activa | Sesión y autorización verificadas por el servicio de la ruta | `/api/mercadopago/account` | `tests/integration/api-inventory.test.ts` |
| `DELETE` | `/api/mercadopago/account` | Activa | Sesión y autorización verificadas por el servicio de la ruta | `/api/mercadopago/account` | `tests/integration/api-inventory.test.ts` |
| `GET` | `/api/mercadopago/checkouts` | Activa | Sesión y autorización verificadas por el servicio de la ruta | `/api/mercadopago/checkouts` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/mercadopago/checkouts` | Activa | Sesión y autorización verificadas por el servicio de la ruta | `/api/mercadopago/checkouts` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/mercadopago/create-preference` | Activa | Sesión y autorización verificadas por el servicio de la ruta | `/api/mercadopago/create-preference` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/mercadopago/oauth/authorize` | Activa | Sesión y autorización verificadas por el servicio de la ruta | `/api/mercadopago/oauth/authorize` | `tests/integration/api-inventory.test.ts` |
| `GET` | `/api/mercadopago/oauth/callback` | Activa | Profesional; sesión, state y cookie | `/api/mercadopago/oauth/callback` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/mercadopago/webhook` | Activa | Proveedor; firma y consulta canónica | `/api/mercadopago/webhook` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/notifications/emit` | Activa | Sesión y autorización verificadas por el servicio de la ruta | `/api/notifications/emit` | `tests/integration/api-inventory.test.ts` |
| `GET` | `/api/payments/refund-requests` | Activa | Sesión: admin | `/api/payments/refund-requests` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/payments/refund-requests` | Activa | Sesión: admin | `/api/payments/refund-requests` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/payments/webhook/apply` | Retirada 410 | Pública; contrato retirado, sin mutación | `/api/mercadopago/webhook` | `tests/unit/api-route-contracts.vitest.test.ts` |
| `GET` | `/api/pricing/job` | Activa | Sesión y autorización verificadas por el servicio de la ruta | `/api/pricing/job` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/pricing/job/status` | Activa | Sesión: professional,customer | `/api/pricing/job/status` | `tests/integration/api-inventory.test.ts` |
| `GET` | `/api/pricing/offers` | Activa | Sesión: admin,professional | `/api/pricing/offers` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/pricing/offers` | Activa | Sesión: admin,professional | `/api/pricing/offers` | `tests/integration/api-inventory.test.ts` |
| `GET` | `/api/pricing/policy` | Activa | Sesión y autorización verificadas por el servicio de la ruta | `/api/pricing/policy` | `tests/integration/api-inventory.test.ts` |
| `PUT` | `/api/pricing/policy` | Activa | Sesión y autorización verificadas por el servicio de la ruta | `/api/pricing/policy` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/pricing/quote` | Activa | Sesión y autorización verificadas por el servicio de la ruta | `/api/pricing/quote` | `tests/integration/api-inventory.test.ts` |
| `GET` | `/api/pricing/quotes` | Activa | Sesión y autorización verificadas por el servicio de la ruta | `/api/pricing/quotes` | `tests/integration/api-inventory.test.ts` |
| `PATCH` | `/api/pricing/quotes` | Activa | Sesión y autorización verificadas por el servicio de la ruta | `/api/pricing/quotes` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/pro/jobs/action` | Retirada 410 | Pública; contrato retirado, sin mutación | `/api/pricing/job/status` | `tests/unit/api-route-contracts.vitest.test.ts` |
| `POST` | `/api/pro/onboarding/evaluate` | Retirada 410 | Pública; contrato retirado, sin mutación | `/api/admin/professionals/review` | `tests/unit/api-route-contracts.vitest.test.ts` |
| `POST` | `/api/professional/onboarding/accept` | Activa | Sesión confirmada e invitación/onboarding vigente | `/api/professional/onboarding/accept` | `tests/integration/api-inventory.test.ts` |
| `GET` | `/api/professional/onboarding/context` | Activa | Sesión confirmada e invitación/onboarding vigente | `/api/professional/onboarding/context` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/professional/onboarding/documents/finalize` | Activa | Sesión confirmada e invitación/onboarding vigente | `/api/professional/onboarding/documents/finalize` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/professional/onboarding/documents/read` | Activa | Sesión confirmada e invitación/onboarding vigente | `/api/professional/onboarding/documents/read` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/professional/onboarding/documents/sign` | Activa | Sesión confirmada e invitación/onboarding vigente | `/api/professional/onboarding/documents/sign` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/professional/onboarding/login` | Activa | Sesión confirmada e invitación/onboarding vigente | `/api/professional/onboarding/login` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/professional/onboarding/register` | Activa | Sesión confirmada e invitación/onboarding vigente | `/api/professional/onboarding/register` | `tests/integration/api-inventory.test.ts` |
| `GET` | `/api/professional/onboarding` | Activa | Sesión confirmada e invitación/onboarding vigente | `/api/professional/onboarding` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/professional/onboarding` | Activa | Sesión confirmada e invitación/onboarding vigente | `/api/professional/onboarding` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/professional/onboarding/submit` | Activa | Sesión confirmada e invitación/onboarding vigente | `/api/professional/onboarding/submit` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/professional/respond-request` | Retirada 410 | Pública; contrato retirado, sin mutación | `/api/pricing/offers` | `tests/unit/api-route-contracts.vitest.test.ts` |
| `POST` | `/api/quality/open-case` | Activa | Sesión: admin; permiso quality | `/api/quality/open-case` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/reviews/submit` | Activa | Sesión: customer | `/api/reviews/submit` | `tests/integration/api-inventory.test.ts` |
| `GET` | `/api/scheduling/availability` | Activa | Sesión: professional,admin | `/api/scheduling/availability` | `tests/integration/api-inventory.test.ts` |
| `PUT` | `/api/scheduling/availability` | Activa | Sesión: professional,admin | `/api/scheduling/availability` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/service-request/preview` | Retirada 410 | Pública; contrato retirado, sin mutación | `/api/pricing/quote` | `tests/unit/api-route-contracts.vitest.test.ts` |
| `PATCH` | `/api/support/cases/[id]` | Activa | Sesión: customer,professional,admin | `/api/support/cases/[id]` | `tests/integration/api-inventory.test.ts` |
| `GET` | `/api/support/cases` | Activa | Sesión: customer,professional,admin | `/api/support/cases` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/support/cases` | Activa | Sesión: customer,professional,admin | `/api/support/cases` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/uploads/finalize` | Activa | Sesión: customer,professional | `/api/uploads/finalize` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/uploads/read` | Activa | Sesión y autorización verificadas por el servicio de la ruta | `/api/uploads/read` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/uploads/sign` | Activa | Sesión: customer,professional | `/api/uploads/sign` | `tests/integration/api-inventory.test.ts` |
| `PATCH` | `/api/warranty/claim/[id]` | Activa | Sesión: admin; permiso quality | `/api/warranty/claim/[id]` | `tests/integration/api-inventory.test.ts` |
| `POST` | `/api/warranty/claim` | Activa | Sesión: customer | `/api/warranty/claim` | `tests/integration/api-inventory.test.ts` |
