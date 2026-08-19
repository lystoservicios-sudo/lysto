# Estado actual de implementación

Fecha de evidencia: 2026-08-19

Esta rama es una base de desarrollo verificada, no un sistema operativo de punta a punta ni un entorno productivo conectado.

## Implementado en la base local

### Producto y UI

- Superficies públicas para presentación, servicio, ayuda, login, registro y comprobante.
- Áreas de cliente para solicitudes, trabajos, equipos, direcciones, pagos y perfil.
- Área profesional con onboarding, solicitudes, trabajos, agenda, pagos y perfil.
- Área administrativa para operación, matching, profesionales, clientes, equipos, pagos, precios, diagnóstico, calidad, configuración y auditoría.

Estas superficies permiten desarrollar y revisar los recorridos previstos, pero varias todavía consumen mocks o datos simulados.

### Dominio y APIs

- Diagnóstico, pricing Flexible/Prioridad y validación del wizard.
- Máquinas de estado para solicitudes, trabajos y pagos.
- Matching profesional, permisos por rol, cierre técnico y reviews.
- Calidad, garantías, soporte, scheduling, liquidaciones y gates de release.
- Inventario y contratos de rutas API para los flujos del MVP.

Los contratos y tests no implican que todas las rutas estén conectadas a persistencia o proveedores reales.

### Configuración y automatización

- Node.js 22 y pnpm 9.15.0 fijados para desarrollo y CI.
- Instalación reproducible mediante `pnpm install --frozen-lockfile`.
- Validación separada de configuración pública y de servidor.
- CI con jobs de calidad en Ubuntu y tests de dominio en Windows.
- Documentación de setup local y reglas para no commitear credenciales.

## Evidencia verificada

- `pnpm lint`: aprobado.
- `pnpm typecheck`: aprobado.
- tests de dominio: 124/124 aprobados.
- tests unitarios: 45/45 aprobados.
- reset local de Supabase 001–007 + seed: aprobado.
- tests pgTAP: 376/376 aprobados.
- lint de base `public`/`private`: aprobado sin advertencias.
- `pnpm build`: aprobado con 77 rutas.
- Playwright E2E: no ejecutado.

El detalle está en `checks/TEST_RESULTS.md`.

## Supabase local endurecido

Las migraciones 001–007 y el seed piloto se aplican desde una base local vacía. La revisión cubre roles confiables, RLS, privilegios por columna, comprobantes, solicitudes de reembolso auditadas e idempotentes, Storage firmado, inbox/outbox y tipos generados.

Esta evidencia aprueba desarrollo local, no un despliegue remoto. No se afirma que exista un proyecto Supabase real conectado; staging, secrets, Auth, backups, E2E y observabilidad siguen pendientes.

## Pendiente para una operación real

- Reemplazar mocks de UI y APIs por persistencia e integraciones verificadas.
- Conectar Auth, perfiles y protección por rol de Task 5.
- Configurar secrets por entorno mediante canales seguros.
- Completar la validación de bytes y limpieza de archivos de Task 8.
- Integrar y validar Mercado Pago en sandbox antes de producción.
- Ejecutar E2E en navegador sobre los recorridos críticos.
- Resolver decisiones legales, operativas y de despliegue.
- Publicar la rama y abrir un PR cuando exista autorización; actualmente se omite por decisión, no por un error de GitHub.

## Próximo hito

Task 5: autenticación, perfiles y protección por rol. La conexión a servicios reales y la ejecución E2E deben avanzar sobre la base local ya endurecida.
