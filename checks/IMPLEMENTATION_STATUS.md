# Estado de implementación de Lysto

Última actualización: 2026-08-19

## Estado actual

La rama `feat/mvp-implementation` es una base de desarrollo verificada. Incluye pantallas, rutas, dominio, contratos API, configuración reproducible y artefactos Supabase heredados, pero todavía no constituye un producto conectado o desplegado.

Varias pantallas y APIs conservan mocks, fixtures o respuestas contractuales. No se afirma una integración real con Supabase, Mercado Pago ni otros proveedores.

## Evidencia local

- lint aprobado;
- typecheck aprobado;
- 124/124 tests de dominio aprobados;
- 41/41 tests unitarios aprobados;
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

## Gate pendiente

Task 4 debe auditar seguridad, autorización, RLS, privilegios, storage y autenticación. Hasta entonces, las migraciones, seeds y políticas Supabase heredadas no deben aplicarse en staging o producción.

Después de ese gate corresponde reemplazar mocks, configurar secrets de forma segura, validar proveedores reales, ejecutar E2E y preparar el despliegue.

La publicación de la rama y el PR están pendientes por decisión de coordinación, no por un error de permisos vigente.
