# Solicitudes creadas desde administración

Diseño corregido por indicación explícita del usuario el 25 de octubre de 2026: el técnico no debe aceptar las solicitudes.

## Experiencia

Desde Solicitudes o la ficha de un cliente, Crear solicitud permite elegir cliente, domicilio, equipo, categoría y tipo de servicio, alcance personalizado, técnico, fecha, hora y duración. El equipo puede quedar pendiente en el borrador, pero es obligatorio al enviar para que el profesional pueda diagnosticar y cerrar el trabajo. Permite copiar el precio de un presupuesto existente o definir un total en ARS y una comisión por porcentaje o importe. El resumen muestra total, comisión y participación del técnico, distinguiendo los cargos estimados de Mercado Pago.

Se puede guardar un borrador durable y revisarlo antes de enviar. Enviar congela alcance, precio y reparto, crea la solicitud y el trabajo canónicos y asigna directamente al técnico elegido y reserva la visita. El cliente recibe inmediatamente el resumen para confirmar y pagar; el técnico no realiza una aceptación. Su confirmación es explícita y solo puede realizarla el cliente autenticado; la aprobación del proveedor de pagos sigue siendo la única autoridad para considerar pagado el trabajo.

## Persistencia y permisos

Los borradores administrativos se guardan en una tabla privada con RLS, permisos y comprobaciones de sesión en funciones privadas, expuestas mediante wrappers invoker. Crear o enviar importes personalizados requiere operations y finance, o owner, con MFA. Los clientes y técnicos reciben únicamente el resumen correspondiente a su rol.

Los precios manuales se identifican explícitamente en service_quotes mediante un origen administrativo. Se conserva la invariancia económica de los presupuestos calculados; un presupuesto administrativo valida total positivo, reparto exacto y cantidades finitas sin imponer el recargo de la calculadora. Sus importes y alcance se construyen exclusivamente en la función administrativa y quedan inmutables al enviar. El pago usa el mismo presupuesto aceptado y el mismo técnico que el checkout actual.

## Estados y errores

Borrador editable → asignación directa y envío al cliente → confirmación del cliente → pago. Se reutilizan agenda, vencimiento, elegibilidad y cuentas de cobro del sistema; no se crean ofertas para el técnico. Los reintentos de envío devuelven los mismos identificadores, y las ediciones de borrador usan versión esperada. Un precio o técnico enviado no se reescribe. Una asignación no disponible o vencida bloquea el pago; la disponibilidad se verifica al enviar y el consentimiento sigue siendo exclusivamente del cliente. La visita queda bloqueada hasta pago aprobado.

## Diseño visual

Consola operativa de servicios domésticos: domicilio, equipo, visita, técnico, alcance, presupuesto y reparto. Se reutilizan tipografía, azules de acción, blancos y grises de superficies, verde de confirmación y ámbar de pendiente del panel. Secciones secuenciales y resumen económico visible reemplazan tarjetas de métricas y pasos redundantes. Sin rediseño del shell. Espaciado de la consola y controles accesibles con estados de carga, error y recuperación.

## Verificación

Pruebas de cálculo monetario, límites de comisión, permisos, propiedad de domicilio/equipo, guardado y recuperación de borrador, envío idempotente, confirmación exclusivamente del cliente sin aceptación técnica, privacidad, y congelación del reparto. Verificar migración y RLS contra el proyecto vinculado, ejecutar asesores y comprobar interfaz, tipos, lint y compilación. No crear solicitudes ni cobros reales como prueba.
