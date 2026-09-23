# Envío inmediato de invitaciones profesionales

Diseño aprobado el 23 de septiembre de 2026: al crear una invitación, la petición intenta entregar **esa misma invitación** antes de responder. La base conserva el evento de outbox, el token privado, los leases y la idempotencia para recuperarse de errores; no se presenta una cola como si fuera un envío.

El servidor valida que el transporte de correo esté configurado antes de crear una invitación. Tras la creación, reclama exclusivamente su evento por ID de invitación usando una RPC limitada a `service_role`, reutiliza el envío existente y devuelve `sent` solo cuando Resend acepta el mensaje y la base confirma el resultado. Si hay rechazo, timeout o falta de configuración, devuelve un error explícito y conserva el evento para reintento; no crea otra invitación. La interfaz muestra el enlace de un solo uso cuando exista, y distingue claramente “enviada” de “no enviada”.

El worker programado sigue sirviendo como recuperación de fallos y entrega de otras notificaciones. No se exponen tokens ni claves en listados, logs o cliente. Se prueba autorización, selección exacta, aceptación, fallo y ausencia de transporte. Producción requiere además `RESEND_API_KEY`, remitente verificado, clave válida de Supabase y scheduler; el código no puede suplir esos secretos.
