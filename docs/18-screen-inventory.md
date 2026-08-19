# Inventario de pantallas del MVP operativo

Este documento lista las pantallas que existen en la web app y su objetivo funcional.

## Público

| Ruta | Objetivo |
|---|---|
| `/` | Landing comercial, confianza y CTA. |
| `/servicios/aire-acondicionado` | Presentación del servicio inicial. |
| `/como-funciona` | Explicar flujo de cliente y respaldo Lysto. |
| `/ayuda` | Preguntas frecuentes. |
| `/login` | Ingreso de usuarios. |
| `/registro` | Alta de clientes. |

## Cliente

| Ruta | Objetivo |
|---|---|
| `/app` | Resumen del cliente, trabajo activo, equipos y CTA. |
| `/app/solicitar/aire-acondicionado` | Wizard completo de solicitud. |
| `/app/solicitudes` | Historial de solicitudes. |
| `/app/solicitudes/[id]` | Detalle de solicitud. |
| `/app/trabajos` | Trabajos activos/pasados. |
| `/app/trabajos/[id]` | Seguimiento del trabajo. |
| `/app/equipos` | Equipos registrados. |
| `/app/equipos/[id]` | Historia técnica del equipo. |
| `/app/direcciones` | Direcciones guardadas. |
| `/app/pagos` | Pagos y estados. |
| `/app/perfil` | Datos personales y notificaciones. |

## Profesional

| Ruta | Objetivo |
|---|---|
| `/pro` | Entrada al portal profesional. |
| `/pro/dashboard` | Agenda, métricas y trabajo activo. |
| `/pro/onboarding/[token]` | Registro por invitación. |
| `/pro/solicitudes` | Solicitudes asignadas. |
| `/pro/solicitudes/[id]` | Aceptar/rechazar solicitud. |
| `/pro/trabajos` | Trabajos del profesional. |
| `/pro/trabajos/[id]` | Workspace técnico. |
| `/pro/agenda` | Agenda diaria. |
| `/pro/equipos/[id]` | Ficha de equipo atendido. |
| `/pro/pagos` | Pagos y liquidaciones. |
| `/pro/perfil` | Perfil profesional. |
| `/pro/mercadopago` | Conexión marketplace split. |

## Admin

| Ruta | Objetivo |
|---|---|
| `/admin` | Entrada al centro operativo. |
| `/admin/dashboard` | Métricas, alertas y acciones. |
| `/admin/solicitudes` | Embudo de solicitudes. |
| `/admin/solicitudes/[id]` | Matching y asignación. |
| `/admin/trabajos` | Trabajos. |
| `/admin/trabajos/[id]` | Detalle operativo. |
| `/admin/profesionales` | Red profesional. |
| `/admin/profesionales/[id]` | Documentación, score y control. |
| `/admin/profesionales/invitaciones` | Invitaciones. |
| `/admin/clientes` | Clientes. |
| `/admin/clientes/[id]` | Detalle cliente. |
| `/admin/equipos` | Equipos. |
| `/admin/pagos` | Pagos y webhooks. |
| `/admin/precios` | Pricing. |
| `/admin/servicios` | Catálogo de servicios. |
| `/admin/diagnostico` | Reglas de diagnóstico. |
| `/admin/calidad` | Reviews, reclamos y garantías. |
| `/admin/configuracion` | Settings. |
| `/admin/auditoria` | Audit logs. |

## Pantallas agregadas en la continuación

| Ruta | Objetivo |
|---|---|
| `/app/trabajos/[id]/review` | Review final del servicio y profesional. |
| `/app/garantias` | Garantías vigentes y reclamos del cliente. |
| `/app/mantenimientos` | Recordatorios de mantenimiento por equipo. |
| `/pro/soporte` | Soporte operativo para profesionales. |
| `/pro/capacitacion` | Módulos internos de capacitación. |
| `/admin/reclamos` | Cola de reclamos y casos críticos. |
| `/admin/garantias` | Gestión operativa de garantías. |
| `/admin/notificaciones` | Auditoría de notificaciones internas/email/WhatsApp. |
| `/admin/zonas` | Configuración de zonas operativas. |
| `/admin/reportes` | Reportes de negocio y operación. |
| `/admin/matching` | Ranking de profesionales y asignación. |
| `/admin/marketplace` | Configuración de comisión, split y reglas comerciales. |
