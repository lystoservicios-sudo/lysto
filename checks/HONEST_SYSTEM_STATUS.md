# Estado honesto del sistema Lysto

Fecha de evidencia: 2026-08-19

## Respuesta corta

Lysto es una base de MVP en desarrollo con una superficie amplia de UI, dominio, rutas API y automatización de calidad. No es todavía un sistema productivo conectado y operativo de punta a punta.

## Evidencia verificada

- 124/124 tests de dominio aprobados.
- 45/45 tests unitarios aprobados.
- 376/376 tests pgTAP aprobados después de un reset local completo 001–007.
- lint de los esquemas `public` y `private` sin advertencias.
- lint y typecheck aprobados.
- build de producción aprobado con 77 rutas.
- Playwright E2E no ejecutado.

El detalle y los límites de esta evidencia están en `checks/TEST_RESULTS.md`.

## Qué está implementado

- Pantallas y navegación para los ámbitos público, cliente, profesional y administrativo.
- Dominio para diagnóstico, pricing, matching, estados, pagos, cierre, calidad, soporte, scheduling y liquidaciones.
- Contratos de rutas API, repositorios y adaptadores para continuar la integración.
- Base Supabase local endurecida: roles/RLS, Storage, recibos, solicitudes de reembolso auditadas e idempotentes, inbox/outbox, seed piloto y tipos generados.
- Configuración de entorno validada y CI reproducible.

Varias pantallas y APIs todavía utilizan mocks, fixtures o respuestas contractuales. Los tests demuestran la base persistente local, pero no que la aplicación ya la use de punta a punta ni que existan proveedores reales.

## Qué falta para producción

- Reemplazar mocks por persistencia e integraciones verificadas.
- Configurar secrets por canales seguros.
- Conectar Auth/perfiles y validar Supabase remoto, Mercado Pago y proveedores opcionales en entornos controlados.
- Implementar la validación de bytes y limpieza de archivos privados de Task 8.
- Ejecutar E2E en navegador y validar un despliegue.
- Resolver requisitos legales y operativos.

Las migraciones 001–007 son reproducibles y verificadas localmente. Eso no autoriza todavía un despliegue remoto: no se afirma que exista un proyecto Supabase real conectado ni que staging, backups o E2E estén validados.

El push y el PR están omitidos por decisión de coordinación, no por un error 403 actual.
