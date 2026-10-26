# Activación del correo transaccional

Objetivo autorizado: completar el correo automático pendiente, preservando avisos internos, preferencias e idempotencia.

- [x] Verificar la cola y el dominio real auth.lystohogar.com en DNS y Resend autenticado.
- [x] Reproducir la aceptación de emails de estados de trabajo ya superados; validar guard con26 controles locales red/green/red.
- [x] Aplicar y verificar migración101 sin claims ni envíos de prueba en la reproducción.
- [x] Comprobar una primera entrega real autorizada, limitada a un evento vigente.
- [x] Preparar modo completo pausado en migración102, verificar permisos, activar el job exacto y observar cinco ejecuciones.
- [x] Confirmar seis Delivered, cuatro suppressed, cero colas/dead/leases.
- [x] Actualizar respaldo cifrado102 y espejo en otro disco, con fuentes y TOC comprobados.
- [x] Integrar la publicación administrativa concurrente; corregir y probar con rollback la confirmación de visita posterior al consentimiento/pago, aplicar104 y verificar respaldo104 independiente y reactivación.

No se cambian claves, remitentes, SMTP ni preferencias; tampoco se reinicia la ventana de un snapshot para forzar reenvíos. La restauración integral y el cobro/devolución real siguen siendo comprobaciones separadas. Evidencia y límites: [informe de correo](../qa/2026-10-25-automatic-email-activation.md).
