# Asignación directa y pago — Implementation Plan

**Goal:** Enviar una solicitud administrativa asignada y lista para que el cliente confirme y pague, sin aceptación del técnico. El recorrido Pedir conserva su asignación automática existente.

**Architecture:** Sustituir únicamente la asignación mediante oferta dentro de `private.save_admin_service_request` por asignación directa y reserva de agenda, con las mismas validaciones, locks, permisos, límites y comisiones. Una solicitud enviada no crea `assignment_offers` ni establece `jobs.accepted_at`. La reserva administrativa conserva su confirmación de agenda por administración; eso no acredita pago ni aceptación del técnico. La visita sigue bloqueada hasta consentimiento del cliente y pago aprobado.

**Tech Stack:** Next.js, React, TypeScript, PostgreSQL/Supabase, checkout canónico de Mercado Pago.

La corrección explícita del usuario sustituye el requisito anterior de esperar la aceptación del técnico. No se requiere una nueva confirmación del diseño ni del despliegue ya autorizado.

1. Reproducir: cambiar las pruebas de formulario y cliente para exigir envío directo. Añadir prueba SQL transaccional con rollback que envíe, confirme como cliente y prepare el checkout sin sesión ni respuesta del técnico.
2. Migración creada por la CLI dedicada: reemplazar `private.save_admin_service_request`, conservar validadores y añadir locks de asignación/agenda; validar elegibilidad; fijar profesional, asignación automática, versiones y reserva; emitir inmediatamente el aviso al cliente. No crear ofertas ni simular aceptación técnica. Mantener wrappers, RLS, consentimiento versionado, privacidad y contabilidad.
3. Corregir textos en `components/admin/managed-service-request-form.tsx` y `components/customer/managed-request-confirmation.tsx`, incluyendo revisión, botón, resultado y mensaje al cliente. Conservar recuperación e idempotencia.
4. Verificar casos positivos y negativos: disponibilidad, ausencia de ofertas/aceptación, confirmación y checkout inmediatos, importes, versiones antiguas, permisos y bloqueo de visita sin pago. Preservar las regresiones de Pedir automático. Revisar el cambio independientemente.
5. Aplicar exclusivamente la migración nueva al proyecto verificado, comprobar el esquema y los advisors; compilar con configuración real de producción, preparar sin cambiar dominio y publicar esa misma versión. Comprobar el formulario en el dominio real.

No modificar pedidos históricos, identidades, credenciales ni otros cambios locales. Las pruebas en la base se revierten y no llaman a Mercado Pago ni entregan notificaciones.
