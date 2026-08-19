# Estado honesto del sistema Lysto

Fecha de evidencia: 2026-08-19

## Respuesta corta

Lysto es una base de MVP en desarrollo con una superficie amplia de UI, dominio, rutas API y automatización de calidad. No es todavía un sistema productivo conectado y operativo de punta a punta.

## Evidencia verificada

- 124/124 tests de dominio aprobados.
- 41/41 tests unitarios aprobados.
- lint y typecheck aprobados.
- build de producción aprobado con 77 rutas.
- Playwright E2E no ejecutado.

El detalle y los límites de esta evidencia están en `checks/TEST_RESULTS.md`.

## Qué está implementado

- Pantallas y navegación para los ámbitos público, cliente, profesional y administrativo.
- Dominio para diagnóstico, pricing, matching, estados, pagos, cierre, calidad, soporte, scheduling y liquidaciones.
- Contratos de rutas API, repositorios y adaptadores para continuar la integración.
- Configuración de entorno validada y CI reproducible.

Varias pantallas y APIs todavía utilizan mocks, fixtures o respuestas contractuales. Los tests y el build no demuestran persistencia ni proveedores reales.

## Qué falta para producción

- Completar Task 4 de seguridad, autorización y RLS.
- Reemplazar mocks por persistencia e integraciones verificadas.
- Configurar secrets por canales seguros.
- Validar Supabase, Mercado Pago y proveedores opcionales en entornos controlados.
- Ejecutar E2E en navegador y validar un despliegue.
- Resolver requisitos legales y operativos.

Las migraciones, seeds y políticas Supabase heredadas no son desplegables hasta superar Task 4. No se afirma que exista un proyecto Supabase real conectado.

El push y el PR están omitidos por decisión de coordinación, no por un error 403 actual.
