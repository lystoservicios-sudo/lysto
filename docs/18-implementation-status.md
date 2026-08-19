# Estado de implementación de la base local

Fecha de evidencia: 2026-08-19

La rama `feat/mvp-implementation` consolida una base en desarrollo. No equivale a un producto desplegado ni a una operación real de punta a punta.

## Alcance disponible

- Pantallas y navegación para los ámbitos público, cliente, profesional y administrativo.
- Dominio para diagnóstico, pricing, matching, estados, pagos, cierre, calidad, soporte, scheduling y liquidaciones.
- Contratos de rutas API y adaptadores de persistencia para continuar la integración.
- Migraciones 001–007, seed piloto, políticas RLS/Storage y tipos Supabase verificados localmente.
- Configuración reproducible de Node.js, pnpm y CI.

Parte de la UI y de las APIs todavía utiliza mocks, fixtures o respuestas contractuales. No se afirma que Supabase, Mercado Pago u otros proveedores estén conectados.

## Evidencia local vigente

- lint aprobado;
- typecheck aprobado;
- 124/124 tests de dominio aprobados;
- 45/45 tests unitarios aprobados;
- 376/376 tests pgTAP aprobados después de un reset local completo;
- lint de base aprobado sin advertencias;
- build aprobado con 77 rutas;
- E2E de Playwright no ejecutado.

La evidencia detallada y sus límites están en `checks/TEST_RESULTS.md`.

## Próximo gate

Task 4 quedó aprobada para desarrollo local. Task 5 debe conectar Auth, perfiles y protección por rol; Task 8 debe completar la inspección real de archivos y limpieza de huérfanos.

Las migraciones todavía no están autorizadas para producción: corresponde reemplazar mocks gradualmente, configurar secrets por canales seguros, validar staging e integraciones externas, ejecutar E2E/backups y preparar el despliegue.
