# Matriz de alcance de la base Lysto

Fecha de evidencia: 2026-08-19

| Área | Estado actual | Evidencia o límite |
|---|---|---|
| Landing y páginas públicas | Implementadas como base UI | `app/(public)` |
| Login y registro | UI y contratos implementados | `app/(auth)`, `lib/auth` |
| Wizard cliente | UI, validación, diagnóstico y pricing | `features/service-request`, `lib/service-request` |
| Portal cliente | Superficie implementada; persisten mocks | `app/(customer)` |
| Portal profesional | Superficie y lógica implementadas; persisten mocks | `app/(professional)`, `lib/professional` |
| Administración | Superficie y operaciones contractuales; persisten mocks | `app/(admin)`, `lib/admin` |
| Diagnóstico y pricing | Implementados y testeados | `lib/diagnosis`, `lib/pricing` |
| Matching y estados | Implementados y testeados | `lib/matching`, `lib/domain` |
| Pagos y Mercado Pago | Contratos, split e idempotencia; proveedor real no conectado | `lib/payments`, `app/api/mercadopago` |
| Calidad, garantía y soporte | Lógica y superficies implementadas | `lib/quality`, `lib/warranty`, `lib/support` |
| Scheduling y liquidaciones | Implementados y testeados | `lib/scheduling`, `lib/marketplace` |
| Rutas API | Contratos presentes; no todas usan persistencia real | `app/api`, tests de contratos |
| Supabase schema | Artefactos heredados pendientes de Task 4 | `supabase/migrations`, `supabase/seed.sql` |
| RLS y autorización | No aprobadas para despliegue; auditoría pendiente | Task 4 de seguridad/RLS |
| Tests de dominio | 124/124 aprobados | `checks/TEST_RESULTS.md` |
| Tests unitarios | 41/41 aprobados | `checks/TEST_RESULTS.md` |
| Lint y typecheck | Aprobados | `checks/TEST_RESULTS.md` |
| Build | Aprobado con 77 rutas | `checks/TEST_RESULTS.md` |
| Playwright E2E | No ejecutado | No hay evidencia de navegador |
| Supabase real | No conectado ni desplegado | Bloqueado hasta Task 4 |
| Mercado Pago real | No conectado | Requiere configuración y validación externa |
| Deploy | No validado | Requiere gates de seguridad, E2E y entorno |

Esta matriz describe una base en desarrollo. No debe interpretarse como certificación de operación real de punta a punta.
