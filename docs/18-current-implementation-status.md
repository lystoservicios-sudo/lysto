# Estado actual de implementación

Este documento registra el avance real luego de continuar el trabajo sin depender de GitHub ni Supabase productivo.

## Implementado localmente

### UI/pantallas
- Landing pública.
- Página del servicio de aire acondicionado.
- Cómo funciona.
- Ayuda/FAQ.
- Login.
- Registro cliente.
- Comprobante público.
- Panel cliente.
- Solicitudes cliente: listado y detalle.
- Trabajos cliente: listado y detalle.
- Equipos cliente: listado y detalle.
- Direcciones cliente.
- Pagos cliente.
- Perfil cliente.
- Panel profesional.
- Onboarding profesional por invitación.
- Solicitudes profesional: listado y detalle.
- Trabajos profesional: listado y operación.
- Agenda profesional.
- Pagos profesional.
- Perfil profesional.
- Mercado Pago profesional.
- Panel admin.
- Solicitudes admin: listado y detalle con matching sugerido.
- Trabajos admin: listado y detalle.
- Profesionales admin: listado, detalle e invitaciones.
- Clientes admin: listado y detalle.
- Equipos admin.
- Pagos admin.
- Precios admin.
- Diagnóstico admin.
- Servicios admin.
- Calidad admin.
- Configuración admin.
- Auditoría admin.

### Lógica de dominio
- Diagnóstico preliminar.
- Precio Flexible/Prioridad.
- Matching/ranking profesional.
- Máquina de estados.
- Cálculo split marketplace.
- Validación de webhooks duplicados.
- Validación de permisos de rutas por rol.
- Validación de wizard cliente.
- Validación de cierre técnico.
- Review y score de calidad.
- Cola operativa admin.
- Checklist de herramientas.
- Comprobante público seguro.
- Lifecycle de punta a punta.

### Base de datos
- Migración inicial completa con perfiles, clientes, profesionales, solicitudes, respuestas, media, diagnósticos, precios, trabajos, equipos, pagos, reviews, reclamos, garantías, calidad, settings y auditoría.
- Migración de extensiones operativas con zonas, capacitación profesional, notificaciones y comprobantes públicos.
- Seed de aire acondicionado, problemas, preguntas, opciones, precios, settings y módulos de capacitación.
- RLS base y políticas iniciales para recursos sensibles.

### Calidad
- 50 tests de dominio ejecutados y pasando.
- CI configurado.
- Playwright preparado.
- Checklist QA manual.
- Checklist RLS.

## No terminado porque requiere ejecución externa o credenciales
- Build real con dependencias instaladas.
- Deploy.
- Supabase productivo con migraciones aplicadas.
- Mercado Pago real.
- Secrets reales.
- GitHub push/PR por error 403 de integración.
- Tests E2E reales en navegador luego de instalar dependencias.

## Próximo bloque técnico recomendado
1. Instalar dependencias en entorno local/CI.
2. Ejecutar typecheck/build y corregir cualquier error de compilación.
3. Conectar Supabase real con env vars.
4. Aplicar migraciones en branch/staging.
5. Cambiar mocks por queries server-side gradualmente.
6. Integrar Mercado Pago sandbox.
7. Ejecutar E2E completo.
