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

El comprobante usa ahora la misma firma HMAC-SHA256 completa en base64url, con el mismo propósito, alcance y vencimiento. Se conserva la verificación de tokens anteriores. Los retornos firmados omiten el indicador de resultado, que nunca es autoridad para aprobar un pago; siempre consultan el estado canónico. En el dominio de producción los enlaces quedan en 149 caracteres y pasan por el SDK real.

Para recuperar el intento ya preparado, solamente se compactan los tres destinos antiguos exactos de Lysto, firmados y válidos, de un checkout aún no emitido y en estado `creating`, que exceden el límite y por tanto nunca pudieron atravesar la validación del SDK. Se conserva la expiración del comprobante, identidad del checkout, clave de idempotencia, importes, vendedor y demás datos congelados. No se alteran preferencias ya emitidas.

## Pendiente

Resolver la apertura del checkout, dejar el pago de ARS 100 al usuario, verificar la confirmación canónica y el split realmente aplicado, completar diagnóstico, aprobación del cliente, cierre técnico y conformidad final. El circuito completo todavía no está aprobado.
