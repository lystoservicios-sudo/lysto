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
- tests unitarios: 41/41 aprobados.
- `pnpm build`: aprobado con 77 rutas.
- Playwright E2E: no ejecutado.

El detalle está en `checks/TEST_RESULTS.md`.

## Supabase heredado

El repositorio contiene migraciones, seeds y políticas RLS heredadas. No se afirma que estén aplicadas ni que exista un proyecto real conectado.

Estos artefactos no son desplegables hasta completar Task 4, que debe auditar autorización, RLS, privilegios, storage, autenticación y exposición de datos sensibles.

## Pendiente para una operación real

- Reemplazar mocks de UI y APIs por persistencia e integraciones verificadas.
- Completar Task 4 de seguridad/RLS antes de aplicar Supabase.
- Configurar secrets por entorno mediante canales seguros.
- Integrar y validar Mercado Pago en sandbox antes de producción.
- Ejecutar E2E en navegador sobre los recorridos críticos.
- Resolver decisiones legales, operativas y de despliegue.
- Publicar la rama y abrir un PR cuando exista autorización; actualmente se omite por decisión, no por un error de GitHub.

## Próximo hito

Task 4: endurecimiento de seguridad, autorización y RLS. La conexión a servicios reales y la ejecución E2E deben ocurrir después de ese gate.
