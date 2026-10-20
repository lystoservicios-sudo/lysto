# Ensayo de servicio completo — ARS 100

Fecha: 20/10/2026. Producción: `https://lystohogar.com`.

El propietario autorizó un servicio simulado con sus cuentas cliente, técnico y administrador, y un pago real de ARS 100 que realizará personalmente. Las tarifas generales y los trabajos anteriores no se modificaron.

## Identidad del ensayo

- Presupuesto inicial: `54e026b0-3fd5-493f-ac5f-75fc15ca0341`.
- Revisión aceptada: `60b3e663-4059-4680-902e-61587a77e293`.
- Solicitud: `1fbbacac-13f4-452a-abed-6460965a7681`.
- Trabajo: `e6b0c59a-71c7-4cbf-9f62-0e7d6b686036`.
- Equipo ficticio aislado: `4b1ba1a9-d1b5-497c-95c3-960e500e5277`, “PRUEBA E2E 20-10-2026”.
- Checkout: `82f2a5e5-90cb-45f3-ab17-06611b740e13`.
- Total ARS 100; comisión Lysto ARS 18; parte profesional ARS 82 antes de cargos del proveedor.

## Preparación y límites de cobertura

El asistente actual de solicitudes no aplica el precio especial del propietario. Se recorrieron sus pasos iniciales con el equipo y domicilio existentes, pero el pedido de prueba se preparó mediante la API de presupuestos autenticada como cliente. Esta API sí aplica el precio especial existente de ARS 100.

La estimación automática devolvió traslado sin verificar y equipo desconocido. Se preparó una segunda revisión mediante `persist_calculated_quote`, con una sesión administrativa vigente y controles normales de autorización, versión y tarifa. Esta revisión conserva 100/18/82, identifica explícitamente el servicio como simulación sin intervención física y documenta el traslado manual ficticio sin costo y las características técnicas de prueba. El presupuesto anterior quedó reemplazado por el mecanismo normal de revisiones.

La aceptación antigua de presupuestos no vincula un equipo. Para poder probar diagnóstico y cierre sin modificar el equipo real, se agregó un equipo ficticio separado y se vinculó únicamente a la solicitud recién creada, dentro de una transacción con controles de identidad, estado, presupuesto y precio. Quedó una entrada `qa.e2e.fixture.prepared` en auditoría. No se presenta esta preparación como una prueba completa del asistente nuevo.

Los scripts de preparación, que contienen el domicilio, quedan fuera del repositorio, en la carpeta privada de la sesión. No se copian credenciales ni cookies al código.

## Recorrido observado

1. Cliente: presupuesto de ARS 100 visible.
2. Administrador: revisión de alcance e importes, luego habilitación para aceptar.
3. Cliente: aceptación por interfaz y creación de la solicitud, sin cobro.
4. Administrador: disponibilidad rechaza 21/10 a las 18 porque el profesional tiene disponibilidad hasta las 17. La franja 21/10 a las 14 permite seleccionarlo.
5. Administrador: propuesta enviada, con reserva temporal de 30 minutos.
6. Técnico: consulta de ficha y aceptación desde Propuestas.
7. Técnico: inicio bloqueado hasta aprobación del pago.
8. Cliente: botón de pago muestra ARS 100. Se intenta abrir Mercado Pago.
9. El checkout queda `creating`, sin `preference_id`, con `last_error=provider_request_failed`. La consulta de estado conserva ese intento; no hay pago aprobado de este ensayo.

## Hallazgos

- **Regresión de publicación:** producción estaba en `e3b1634`, que no incluía las correcciones anteriores de presupuestos. Solicitudes del administrador caía con `Cannot read properties of undefined (reading 'map')`. Se integró esa versión con las correcciones en `8c2170c`, y se publicó `dpl_244xcKqJ22gkzNiQ7z6Ja8jEsKuv`. La pantalla se recuperó; 46 pruebas focalizadas y la compilación de producción pasaron.
- **Ficha técnica antes de aceptación:** un trabajo `pending_professional_acceptance` se presenta como “Esperando el pago del cliente” y “Estado por verificar”, sin ofrecer aceptar en esa ficha. La aceptación sí está disponible en Propuestas.
- **Fecha en ficha técnica antes de aceptación:** el trabajo propuesto para 21/10 a las 14 muestra “20 oct 2026, 9:00 p. m.” en Datos de la visita. Pendiente contrastar después de la confirmación y corregir el tratamiento de fecha/franja.
- **Apertura del checkout bloqueada:** respuesta genérica de pago, sin diagnóstico suficiente en los logs actuales. Se agregan registros limitados a códigos permitidos, estado HTTP y etapa; nunca cuerpos del proveedor, credenciales, URLs ni datos personales. Dos pruebas de privacidad fallan antes y pasan después; 39 pruebas de credenciales, contratos, preparación e interacción con el proveedor pasan.

### Causa y corrección del checkout

La instrumentación confirma `ValidationError` en `preference_create`. La prueba con la librería real reproduce el rechazo: los tres `backUrls` superan su máximo de 150 caracteres. El fallo sucede antes de cualquier solicitud al proveedor.

El comprobante usa ahora la misma firma HMAC-SHA256 completa en base64url, con el mismo propósito, alcance y vencimiento. Se conserva la verificación de tokens anteriores. Los retornos firmados omiten el indicador de resultado, que nunca es autoridad para aprobar un pago; siempre consultan el estado canónico. En el dominio de producción los enlaces quedan en 150 caracteres y pasan por el SDK real.

Para recuperar el intento ya preparado, solamente se compactan los tres destinos antiguos exactos de Lysto, firmados y válidos, de un checkout aún no emitido y en estado `creating`, que exceden el límite y por tanto nunca pudieron atravesar la validación del SDK. Se conserva la expiración del comprobante, identidad del checkout, clave de idempotencia, importes, vendedor y demás datos congelados. No se alteran preferencias ya emitidas.

### Checkout listo y entrega al usuario

- Corrección publicada: commit `7df0e64`, deployment `dpl_9daui7rw4ud3T34NZ9smegqT9E8h`, `READY`, asignado a `lystohogar.com`.
- 68 pruebas focalizadas aprobadas en los nueve archivos de retorno, credenciales, contrato y preparación; TypeScript, ESLint y compilación de producción aprobados.
- El mismo checkout pasó a `ready`, sin duplicación ni cambio de 100/18/82. Preferencia real: `389157374-dd98c8de-07b8-422c-b265-9917a1c0eca6`.
- Navegador abierto en Mercado Pago, pantalla “¿Cómo querés pagar?”, con “Servicio técnico Lysto” y **$100** visibles.
- Verificación posterior: un solo checkout, cero pagos registrados, vendedor del checkout coincide con la cuenta de Mercado Pago vinculada al técnico.
- Mercado Pago muestra como nombre comercial `consultamedicaonline.com.ar`; queda registrada esta observación de la configuración del vendedor. No se modificó la identidad comercial.
- La reserva canónica es 21/10, 14–16 Argentina; `jobs.scheduled_time_window` conserva 18–20 del pedido original. Pendiente verificar y corregir las pantallas/comprobantes que lean esos campos antiguos.
- Captura local: `C:\Users\quime\.codex\private\lysto-sessions\e2e-checkout-100.png`. Archivo ficticio preparado para probar carga de evidencia: `e2e-evidencia-simulada.png`, explícitamente marcado como simulación y sin reparación física.

### Pago y split confirmados

El usuario completó el pago. Se verificó primero la observación canónica guardada por Lysto y luego se consultó directamente `GET /v1/payments/184166569165` con la credencial existente de la plataforma, sin copiar ni registrar secretos.

- Pago real `184166569165`: `approved`, detalle `accredited`, liberación `released`, ARS 100, sin reembolsos.
- Referencia externa: el checkout `82f2a5e5-90cb-45f3-ab17-06611b740e13`. Un solo pago registrado y observación sin incidencias.
- Mercado Pago devuelve `application_fee=18`, `mercadopago_fee=7.61` y `net_received_amount=74.39`.
- `charges_details` identifica un cargo efectivo de ARS 18 desde `collector` hacia `marketplace_owner`, y ARS 7,61 hacia Mercado Pago. No son solamente importes esperados del presupuesto.
- `marketplace_owner=208363173` coincide con `/users/me` de la credencial de la plataforma. La cuenta del vendedor congelada en el checkout, `389157374`, coincide con la cuenta vinculada al técnico.
- La respuesta de pago visible para la plataforma omite los campos de identidad de comprador/vendedor. No se infiere de esos campos ausentes que comprador y vendedor sean la misma persona. El usuario informó que utilizó una tarjeta propia asociada a la cuenta del técnico.
- El usuario vio una venta de ARS 100; ese importe coincide con el bruto. El neto confirmado por el proveedor es ARS 74,39. El split de esta operación sí está aplicado.
- Por indicación del usuario, el nombre comercial observado no se investigará.

### Servicio simulado completado

El técnico registró llegada, diagnóstico y alcance. El cliente aceptó el diagnóstico; el técnico envió el informe final y el cliente confirmó el servicio. Se usó evidencia gráfica explícitamente ficticia, sin afirmar una reparación física ni publicar una reseña.

Consulta posterior: trabajo `completed`, diagnóstico `accepted`, un informe final, cero adicionales, un checkout, un pago aprobado de ARS 100 y cero reembolsos. El equipo real permanece separado del equipo de ensayo.

Captura: `C:\Users\quime\.codex\private\lysto-sessions\e2e-servicio-completado.png`.

### Administración de pagos y regresiones

Diseño aprobado: ampliar Pagos con solicitudes ligadas a servicios activos, con comisión habitual o comisión Lysto cero; devoluciones totales/parciales y cancelaciones con revisión previa de servicio, destinatario, importe y motivo.

- La solicitud no debita al cliente: requiere su aceptación y el checkout existente.
- La comisión se fija en el servidor y se comprueba contra la tasa que revisó el administrador. Una modificación concurrente exige revisar nuevamente.
- Los adicionales técnicos anteriores conservan su comisión cero; los importes históricos no cambian.
- Las devoluciones reutilizan la reserva de saldo, la ejecución idempotente y la confirmación del proveedor. Una respuesta incierta conserva la misma clave de reintento.
- Las cancelaciones con enlace o pago requieren conciliación; cancelar no devuelve dinero automáticamente.
- Se corrige la pérdida de horario y domicilio al avanzar de `confirmed`: la reserva sigue disponible en los estados posteriores, con autorización de participante y profesional coincidente.
- Se corrige la fecha sin hora que aparecía el día anterior y se usa `scheduled_time_window` cuando no hay reserva canónica.
- La ficha de una propuesta pendiente dirige a Propuestas, sin indicar prematuramente que debe pagar el cliente.

Verificación sin Docker:

- 158 pruebas focalizadas iniciales aprobadas de pagos, estados canónicos, interacción simulada con Mercado Pago, reembolsos, interfaz y operaciones del profesional. Después de la revisión pasaron las 24 pruebas administrativas, las regresiones de visita/propuesta y las 58 de recuperación de cuentas incorporadas desde `origin/main`.
- Prueba SQL real dentro de una transacción con `ROLLBACK`, con solicitudes, trabajos, checkouts y un pago sintético nuevos. Ningún dato de esa prueba se confirma y ningún trabajador externo puede ver sus reintegros sin confirmar.
- La prueba SQL cubre comisión normal/cero, aceptación y rechazo del cliente, MFA, permisos de técnico/cliente, idempotencia, cambios de importe/tasa, propuestas inmutables, checkout único, devolución parcial y del saldo completo, rechazo de sobrerreembolso, cancelación con/sin conciliación y datos de visita en ocho estados.
- Se compara el importe/comisión/neto de cada adicional histórico antes y después del cambio de esquema; permanecen iguales.
- Archivo reproducible de aserciones: `tests/sql/admin-payments-rollback.sql`. El envoltorio con cuentas del propietario queda fuera del repositorio.
- El archivo SQL usa además un `SAVEPOINT` obligatorio y descarta sus fixtures antes de devolver el control; no puede ejecutarse por sí solo fuera de una transacción.
- Revisión independiente: corregidos motivo interno expuesto (ahora en tabla privada), búsqueda de servicios antiguos y confirmación de casos con identificación del cliente/servicio. Sin hallazgos importantes pendientes.
- Ambas migraciones se aplicaron y registraron en el proyecto enlazado. Se repitieron las aserciones sobre el esquema aplicado; después seguían existiendo cero solicitudes administrativas nuevas y cero solicitudes de reintegro.
- Asesores de seguridad/rendimiento: 71 observaciones antes y después, cero errores y cero observaciones nuevas.
- ESLint completo, TypeScript y compilación de producción aprobados. Código integrado con la recuperación MFA reciente, conservando las redirecciones de inicio de sesión.

Límites: no se emitieron nuevos cobros o devoluciones reales. Los estados alternativos del proveedor se verifican con respuestas simuladas; no equivalen a una certificación de todos los medios de pago. La concurrencia de dos conexiones PostgreSQL no se ejecutó en este ensayo. El asistente nuevo de solicitud conserva el límite de cobertura descrito arriba.

### Publicación y comprobación final

- Código `c20ed56`, despliegue `dpl_GvBVDcU5hCixsLc6HQLdCxHtwFfi`, estado `READY`, publicado en `https://lystohogar.com`.
- Cliente: “Servicio confirmado”, pago aprobado y el informe de simulación visibles.
- Técnico: “Servicio completado”, importe ARS 100, reserva del 21/10 a las 14:00 y domicilio completo conservados.
- Admin: Pagos muestra el pago real 100/18/7,61/74,39. Se abrieron y cerraron las revisiones de cobro habitual, cobro sin comisión, devolución parcial de 25 y cancelación, sin confirmar las operaciones.
- La búsqueda por referencia en cancelaciones devuelve el servicio esperado. Los formularios se limpiaron después de comprobarlos.
- Consulta final: el servicio está `completed`, un checkout, un pago aprobado de 100, cero adicionales, cero reintegros; cero solicitudes administrativas nuevas y cero casos de cancelación.
- Se conservaron las tres sesiones cifradas y se dejó abierto `/admin/pagos`.
- Capturas privadas: `e2e-servicio-completado.png`, `admin-cobro-sin-comision-revision.png`, `admin-devolucion-revision.png`.
