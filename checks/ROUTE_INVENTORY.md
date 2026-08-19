# Lysto route inventory

Estado actualizado luego de continuar el desarrollo local.

## Público
- `/`
- `/servicios/aire-acondicionado`
- `/como-funciona`
- `/ayuda`
- `/login`
- `/registro`
- `/comprobante/[token]`

## Cliente
- `/app`
- `/app/solicitar/aire-acondicionado`
- `/app/solicitudes`
- `/app/solicitudes/[id]`
- `/app/trabajos`
- `/app/trabajos/[id]`
- `/app/equipos`
- `/app/equipos/[id]`
- `/app/direcciones`
- `/app/perfil`
- `/app/pagos`

## Profesional
- `/pro` redirect a `/pro/dashboard`
- `/pro/dashboard`
- `/pro/onboarding/[token]`
- `/pro/solicitudes`
- `/pro/solicitudes/[id]`
- `/pro/trabajos`
- `/pro/trabajos/[id]`
- `/pro/agenda`
- `/pro/equipos/[id]`
- `/pro/pagos`
- `/pro/perfil`
- `/pro/mercadopago`

## Admin
- `/admin` redirect a `/admin/dashboard`
- `/admin/dashboard`
- `/admin/solicitudes`
- `/admin/solicitudes/[id]`
- `/admin/trabajos`
- `/admin/trabajos/[id]`
- `/admin/profesionales`
- `/admin/profesionales/[id]`
- `/admin/profesionales/invitaciones`
- `/admin/clientes`
- `/admin/clientes/[id]`
- `/admin/equipos`
- `/admin/pagos`
- `/admin/precios`
- `/admin/servicios`
- `/admin/diagnostico`
- `/admin/calidad`
- `/admin/configuracion`
- `/admin/auditoria`

## API contracts
- `/api/diagnosis/generate`
- `/api/uploads/sign`
- `/api/mercadopago/create-preference`
- `/api/mercadopago/webhook`
- `/api/mercadopago/oauth/callback`
- `/api/admin/invite-professional`

## Pantallas que dejaron de ser placeholders simples
- Dashboard cliente con métricas, trabajo activo, timeline, equipos y pagos.
- Solicitudes cliente con lista y detalle.
- Trabajos cliente con seguimiento y detalle.
- Equipos cliente con historial técnico.
- Direcciones, pagos y perfil cliente.
- Dashboard admin con métricas, cola operativa, trabajos y auditoría.
- Solicitudes admin con ranking sugerido y acciones.
- Trabajos admin con estados y cierre técnico esperado.
- Profesionales admin con revisión, documentación y aprobación.
- Clientes admin con equipos y trabajos.
- Pagos, precios, diagnóstico, servicios, equipos, calidad, configuración y auditoría admin.
- Dashboard profesional con agenda, checklist y solicitudes.
- Solicitudes profesional con detalle y respuesta.
- Trabajos profesional con estados, registro de equipo y cierre técnico.
- Onboarding profesional completo por invitación.
- Perfil, pagos, agenda, Mercado Pago profesional.
- Comprobante público con token.
