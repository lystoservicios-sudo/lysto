# Estado de implementación Lysto MVP Operativo

Última actualización: 2026-08-19

## Inventario actual
- Pantallas/rutas con `page.tsx`: 61
- Route handlers API: 26
- Módulos TS en `lib/`: 66
- Tests de dominio: 29 archivos
- Migraciones Supabase: 4
- Tests ejecutados en este entorno: 124/124 passed

## Estado real
Esta versión es una base de MVP operativo muy avanzada: tiene pantallas, rutas, diseño, lógica de dominio, contratos API, migraciones, RLS, RPC transaccionales, tests y documentación. Todavía no puede llamarse producción 100% porque faltan credenciales reales, dependencias instaladas en tu entorno, conexión Supabase real, Mercado Pago real, build local/CI y subida al repo.

## Pantallas implementadas
- Público: landing, servicio aire acondicionado, cómo funciona, ayuda, login, registro, comprobante público.
- Cliente: dashboard, wizard completo, solicitudes, detalle, trabajos, seguimiento, review, equipos, direcciones, pagos, perfil, garantías, mantenimientos.
- Profesional: dashboard, onboarding por invitación, solicitudes, detalle, trabajos, operación, agenda, equipos, pagos, perfil, Mercado Pago, soporte, capacitación.
- Admin: dashboard, solicitudes, detalle, trabajos, detalle, profesionales, invitaciones, clientes, equipos, pagos, precios, servicios, diagnóstico, calidad, configuración, auditoría, reclamos, garantías, notificaciones, zonas, reportes, matching, marketplace.

## Funciones implementadas
- Diagnóstico preliminar.
- Precios Flexible/Prioridad.
- Matching y ranking profesional.
- Asignación admin.
- Aprobación profesional.
- Onboarding profesional.
- Respuesta profesional aceptar/rechazar.
- Validación de solicitud cliente.
- Validación de media.
- Flujo completo de servicio.
- Máquina de estados.
- Pagos, split e idempotencia.
- Registro de equipo.
- Cierre técnico.
- Comprobante público.
- Review y recálculo de rating.
- Calidad/reclamos/garantías.
- Notificaciones.
- KPIs operativos.
- Auditoría admin.
- Scheduling/SLA.
- Liquidación/payout.
- Validaciones de formularios.
- Repository layer Supabase preparado.
- RPC transaccionales Supabase para solicitud, webhook, asignación, respuesta profesional, cierre y review.

## Base de datos
- Migración 001: esquema central completo.
- Migración 002: extensiones operativas.
- Migración 003: funciones, triggers y políticas adicionales.
- Migración 004: flujos transaccionales RPC.
- Seed inicial de aire acondicionado.

## Bloqueos externos reales
- GitHub: la integración devolvió 403 para escribir en `lystoservicios-sudo/lysto`.
- Dependencias: este contenedor no puede descargar npm/pnpm.
- Supabase real: las migraciones están creadas, pero requieren aplicar con Supabase MCP/CLI autenticado en tu entorno.
- Mercado Pago real: requiere credenciales sandbox/producción, app marketplace, webhook URL y OAuth.
- Producción: requiere correr lint/typecheck/build/e2e en entorno con dependencias.
