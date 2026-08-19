# Estado de implementación de la base local

Fecha de evidencia: 2026-08-19

La rama `feat/mvp-implementation` consolida una base en desarrollo. No equivale a un producto desplegado ni a una operación real de punta a punta.

## Alcance disponible

- Pantallas y navegación para los ámbitos público, cliente, profesional y administrativo.
- Dominio para diagnóstico, pricing, matching, estados, pagos, cierre, calidad, soporte, scheduling y liquidaciones.
- Contratos de rutas API y adaptadores de persistencia para continuar la integración.
- Migraciones, seeds y políticas Supabase heredadas como material pendiente de auditoría.
- Configuración reproducible de Node.js, pnpm y CI.

Parte de la UI y de las APIs todavía utiliza mocks, fixtures o respuestas contractuales. No se afirma que Supabase, Mercado Pago u otros proveedores estén conectados.

## Evidencia local vigente

- lint aprobado;
- typecheck aprobado;
- 124/124 tests de dominio aprobados;
- 41/41 tests unitarios aprobados;
- build aprobado con 77 rutas;
- E2E de Playwright no ejecutado.

La evidencia detallada y sus límites están en `checks/TEST_RESULTS.md`.

## Gate pendiente

Task 4 debe revisar seguridad, autorización y RLS antes de aplicar cualquier migración, seed o política Supabase heredada en un entorno local compartido, staging o producción.

Después de ese gate corresponde reemplazar mocks gradualmente, configurar secrets por canales seguros, validar integraciones externas, ejecutar E2E y preparar el despliegue.
