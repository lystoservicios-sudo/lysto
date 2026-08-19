# Acceptance criteria por pantalla

## Cliente
- Dashboard: muestra trabajo activo, métricas, pagos recientes y equipos.
- Wizard: no permite avanzar sin datos mínimos cuando esté conectado a forms reales.
- Solicitud detalle: muestra diagnóstico, precio, dirección, horario, pago y profesional asignado.
- Trabajo detalle: muestra timeline, técnico, estado y cierre.
- Equipos: muestra historial técnico y próximo mantenimiento.
- Pagos: muestra Mercado Pago, importe, comisión y comprobante.
- Perfil/direcciones: guarda datos del cliente.

## Profesional
- Onboarding: token válido, datos personales, matrícula, herramientas, zonas, disponibilidad y documentos.
- Dashboard: agenda, métricas, checklist y solicitudes pendientes.
- Solicitud detalle: acepta/rechaza y registra evento.
- Trabajo detalle: cambia estados, registra equipo y cierra informe técnico.
- Pagos/Mercado Pago: muestra liquidaciones y vinculación OAuth.

## Admin
- Dashboard: cola operativa, métricas, trabajos y auditoría.
- Solicitudes: filtros, matching sugerido, asignación/reasignación/cancelación.
- Trabajos: intervención de estados, disputa, garantía y cierre.
- Profesionales: invitación, aprobación, suspensión, documentación y score.
- Precios: reglas editables sin hardcode.
- Diagnóstico: reglas y textos modificables.
- Pagos: webhooks, split, reembolsos y liquidaciones.
- Calidad: reviews, reclamos, garantías y acciones correctivas.
- Auditoría: acciones críticas con actor, entidad y metadata.
