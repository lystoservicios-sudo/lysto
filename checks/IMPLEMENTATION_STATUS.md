# Estado de implementación de Lysto

Última actualización: 2026-08-19

## Estado actual

La rama `feat/mvp-implementation` es una base de desarrollo verificada. Incluye pantallas, rutas, dominio, contratos API, configuración reproducible y una base Supabase local endurecida, pero todavía no constituye un producto conectado o desplegado.

Varias pantallas y APIs conservan mocks, fixtures o respuestas contractuales. La base Supabase local está verificada, pero no se afirma una integración remota ni una conexión real con Mercado Pago u otros proveedores.

## Evidencia local

- lint aprobado;
- typecheck aprobado;
- 124/124 tests de dominio aprobados;
- 45/45 tests unitarios aprobados;
- 376/376 tests pgTAP aprobados sobre un reset local completo;
- lint de base sin advertencias;
- build aprobado con 77 rutas;
- Playwright E2E no ejecutado.

Ver `checks/TEST_RESULTS.md` para el detalle y las limitaciones.

## Alcance implementado

- Público: landing, servicio, ayuda, autenticación y comprobante.
- Cliente: dashboard, solicitud, trabajos, review, equipos, direcciones, pagos, garantías y mantenimientos.
- Profesional: onboarding, solicitudes, trabajos, agenda, pagos, perfil, soporte y capacitación.
- Admin: operación, matching, profesionales, clientes, pagos, pricing, calidad, configuración, auditoría y reportes.
- Dominio: diagnóstico, pricing, matching, estados, pagos, cierre, reviews, calidad, soporte, scheduling, liquidaciones y gates de release.
- APIs y repositorios: contratos y adaptadores listos para continuar la integración.
- Supabase local: migraciones 001–007, RLS por rol/propietario, Storage firmado, solicitudes de reembolso auditadas e idempotentes, inbox/outbox, seed piloto y tipos generados.

## Próximo gate

Task 4 quedó aprobada para desarrollo local. Task 5 debe conectar autenticación, perfiles y protección por rol sin ampliar permisos directos de escritura.

Antes de staging o producción todavía corresponde reemplazar mocks, configurar secrets de forma segura, validar uploads privados y proveedores reales, ejecutar E2E, backups y gates de despliegue.

La publicación de la rama y el PR están pendientes por decisión de coordinación, no por un error de permisos vigente.
