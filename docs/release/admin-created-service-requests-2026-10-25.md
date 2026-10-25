# Solicitudes creadas por administración — verificación

Fecha del usuario: 25 de octubre de 2026, Buenos Aires.

## Alcance

Acceso desde `/admin/solicitudes` y la ficha del cliente a `/admin/solicitudes/nueva`. El operador elige cliente, domicilio, equipo, servicio, alcance, técnico, agenda, total y comisión por porcentaje o monto fijo. Puede tomar como referencia un presupuesto anterior, guardar un borrador, revisar y enviar. Los borradores e historial tienen paginación.

El equipo puede quedar pendiente en el borrador; debe estar seleccionado al enviar y seguir vigente cuando el cliente confirma, porque el diagnóstico y cierre técnicos requieren ese vínculo. El técnico acepta mediante el flujo de asignación existente. El cliente recibe el resumen y confirma explícitamente antes de abrir Mercado Pago. Administración no acepta ni paga por el cliente.

Crear importes personalizados requiere `owner` o ambos permisos `operations` y `finance`, con MFA y sesión vigente. Los importes enviados son inmutables. Cambios de asignación o agenda invalidan una confirmación con versiones anteriores. Un reemplazo administrativo utiliza una nueva solicitud; el flujo financiero heredado no puede clonar un contrato manual incompleto.

## Validaciones ejecutadas

- `pnpm lint`: sin errores.
- `pnpm typecheck` y validación de tipos integrada a la compilación: correctas.
- `pnpm test`: 174 pruebas de dominio correctas. La corrida inicial global incorporó la nueva regresión de equipo antes de implementar su corrección; se repitió la suite completa con el código final.
- Suite final de Vitest: **1.186 pruebas correctas, cero fallos y cero pendientes**, 169 archivos. Reporte: `output/admin-created-request-unit-tests.json` en la copia de trabajo aislada.
- `next build` con la configuración local existente: compilación correcta, 104 páginas generadas; la ruta temporal de revisión no se incluyó.
- Revisión independiente de especificación y calidad: sin P1/P2 pendientes. Las correcciones verificadas incluyen respuestas tardías, recuperación de envíos, historial, equipos, contexto de notificación, privacidad y reemplazos.

Se revisaron capturas de escritorio de 1.280 px y móvil de 390 px con datos de ejemplo. El ancho total móvil fue 390 px, sin desplazamiento horizontal. Capturas: `output/playwright/admin-created-request-desktop.png` y `output/playwright/admin-created-request-mobile.png`. La consola solo mostró el bloqueo de Google Fonts por la política CSS general ya existente, fuera del alcance de este cambio. El navegador integrado no ofreció conexión utilizable; la revisión se hizo con un navegador local de pruebas aislado. Se cerró el navegador y se retiró la ruta de prueba.

## Base de datos real

Proyecto: `dqonlqcurvjnjgsczevu`. Se utilizó exclusivamente el perfil dedicado mediante `scripts/supabase-lysto.cmd`, tras verificar `select 1`. La migración `20261025221040_admin_created_service_requests.sql` fue creada con la CLI, validada antes de aplicarse, aplicada en transacción y registrada en el historial remoto. Antes de sustituir la función de notificaciones se comprobó que coincidiera con la definición viva revisada.

La verificación transaccional real cubrió:

1. Guardado de borrador y rechazo de versiones antiguas.
2. Rechazo de envío sin equipo y validación de activos del cliente.
3. Envío idempotente y rechazo de cambios monetarios posteriores.
4. Bloqueo de los reemplazos heredados antes del consentimiento y de la clonación directa.
5. Confirmación del técnico y contexto válido del aviso por correo antes de aceptar el presupuesto.
6. Consentimiento del cliente con versiones actuales de asignación y agenda; rechazo de versiones antiguas.
7. Checkout bloqueado antes del consentimiento, preparación idempotente y reparto exacto: ARS 100,05 = 17,51 para Lysto + 82,54 para el profesional.
8. Visita bloqueada sin pago aprobado.
9. RLS y ausencia de comisiones en las proyecciones del cliente.

Todas las solicitudes, reservas, presupuestos, intenciones de cobro y avisos de esta prueba fueron revertidos. No se llamó al proveedor de pagos ni se procesaron entregas. Después de aplicar el esquema se verificaron RLS, prohibición de lectura directa de borradores, denegación anónima, wrappers públicos `security invoker` y ambos guards de reemplazo. La tabla administrativa quedó con cero registros.

Los asesores de seguridad y rendimiento devolvieron los mismos 71 avisos previos, **sin avisos nuevos**. No se alteraron recomendaciones ajenas a esta entrega.

## Publicación

El código se integró en el proyecto local conservando los cambios previos del usuario. La aplicación frontend todavía no se publicó en producción como parte de esta tarea. No se envió un PR ni se hizo push.
