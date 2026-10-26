# Solicitudes creadas por administración — verificación

Fecha del usuario: 25 de octubre de 2026, Buenos Aires.

## Alcance

Acceso desde `/admin/solicitudes` y la ficha del cliente a `/admin/solicitudes/nueva`. El operador elige cliente, domicilio, equipo, servicio, alcance, técnico, agenda, total y comisión por porcentaje o monto fijo. Puede tomar como referencia un presupuesto anterior, guardar un borrador, revisar y enviar. Los borradores e historial tienen paginación.

El equipo puede quedar pendiente en el borrador; debe estar seleccionado al enviar y seguir vigente cuando el cliente confirma, porque el diagnóstico y cierre técnicos requieren ese vínculo. El técnico queda asignado directamente al enviar, sin aceptar la solicitud. El cliente recibe el resumen de inmediato y confirma explícitamente antes de abrir Mercado Pago. Administración no acepta ni paga por el cliente.

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

Publicada el 25/10/2026 por pedido explícito del usuario en https://lystohogar.com. Se preparó la rama `codex/admin-request-production-release` sobre el runtime real más reciente, `84749ada84856a1ff18cecc2503f8ffe5473c36b`, y se incorporó la función sin revertir las correcciones ya publicadas. El código ejecutable publicado corresponde a `00853e22680385dfc1430b7ad82455de9012cba0`.

- Despliegue: `dpl_GbWiZPVwzTQT1y2wioamSZN1pG11`, estado `READY / PROMOTED`, entorno `production`.
- Anterior: `dpl_C9CwFTKtfwuk6QeXuWkvny6o39wW`. Se comprobó que siguiera asignado al dominio inmediatamente antes de activar la nueva versión.
- Compilación remota con configuración real de producción: correcta, 118 páginas. Primero se preparó con `--skip-domain` y luego se promovió esa misma compilación.
- Base de producción antes de integrar: 2.299 pruebas unitarias correctas. Candidato integrado: 2.336 correctas y tres fallos del único archivo de recorrido de pagos que esperaba comisiones en la respuesta del cliente. Se actualizó exclusivamente esa prueba para exigir su ausencia y seguir comprobando reparto congelado, cargos y netos internos, proyecciones e idempotencia. La repetición focalizada aprobó las tres regresiones y la proyección privada: 4/4. Los reportes de la corrida global y de la repetición se conservan por separado; no se repitió toda la suite después de ese ajuste de pruebas.
- Función administrativa integrada: 40/40 pruebas enfocadas; dominio: 174/174; tipos y lint correctos. Revisión independiente del merge y del ajuste de pruebas: sin P1/P2.
- Se verificó por SHA-1 que los 840 archivos de código/recursos subidos no cambiaron con el ajuste exclusivo de pruebas. El resto de las seis entradas del manifiesto eran directorios vacíos. Los secretos, pruebas, salidas locales y SQL quedaron fuera de la subida.
- Comprobación real del dominio: asignado al nuevo despliegue. Desde la sesión administradora se abrió Solicitudes, se comprobó el enlace «Crear solicitud» y se abrió el formulario con clientes, domicilios, servicio, equipo, técnico, agenda, precio y comisión. No se guardaron borradores ni se enviaron solicitudes de prueba.
- Consulta de errores del despliegue en los últimos 15 minutos: cero entradas. Es una comprobación puntual, no monitoreo continuo.
- La verificación fresca de Supabase conservó RLS, wrappers invoker, denegación anónima y ambos guards de reemplazo. No se aplicaron cambios adicionales de base de datos durante la publicación.

Evidencia local: `output/admin-request-production-release.json`, informes y logs en `.worktrees/admin-request-production-release/output/`, y captura `output/playwright/admin-created-request-production.png`. Los cambios previos del usuario permanecieron intactos en la carpeta inicial. No se envió un PR ni se hizo push.

## Corrección vigente: sin aceptación del técnico

El requisito anterior de aceptación técnica fue retirado por corrección explícita del usuario. La asignación directa y el acceso inmediato del cliente a confirmar y pagar están publicados. Ver `direct-service-assignment-2026-10-25.md` para la verificación y el runtime actual. Los resultados anteriores de aceptación técnica describen la primera versión y ya no definen el flujo vigente.
