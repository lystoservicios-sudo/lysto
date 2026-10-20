# Solicitud bloqueada por fotos pendientes — 20 de octubre de 2026

## Causas comprobadas

En producción se pudo seleccionar una foto, avanzar hasta el resumen y obtener exactamente el bloqueo reportado: precio sin confirmar, pago deshabilitado y aviso de fotos pendientes. El botón para comprobar el presupuesto produjo **cero solicitudes** a `/api/customer/requests/preview`: la función retornaba antes de consultar al servidor.

Una segunda comprobación detectó que recargar y agregar otra foto generaba un nuevo borrador de subida. La validación del presupuesto exige que las fotos pertenezcan al mismo borrador y rechazaba esa combinación con HTTP 400.

## Correcciones

- `2e7cbae`: guardar automáticamente las fotos al seleccionarlas en Pedir; esperar su verificación antes de avanzar desde Detalles; ofrecer reintento y eliminación; recuperar el paso de fotos si quedan pendientes al consultar el presupuesto.
- `4cc5fd8`: recuperar en el servidor el borrador de una foto previamente verificada antes de agregar otra después de recargar. Se conserva la comprobación de identidad y de fotos todavía no asociadas a otro pedido. Los otros usos del cargador conservan el guardado manual.
- Base: `28d38ae`, que contiene la publicación previa `c20ed56` y sus correcciones de cuentas, pagos y visitas.

## Verificación

- Las regresiones nuevas fallaron antes de cada corrección; después pasaron 68 pruebas focalizadas de solicitud, subida, recuperación y recorrido completo con límites externos simulados.
- TypeScript y ESLint de los archivos modificados: correctos.
- Compilación de producción: correcta.
- Publicación final: `dpl_5xqsSFLnqp6juKWdGAAWCtKjbtu4`, `READY`, alias `https://lystohogar.com`.
- Navegador real contra producción, con la cuenta del propietario autorizada: seleccionar foto inicia guardado automáticamente; Continuar permanece deshabilitado durante la subida; `/api/uploads/sign` y `/api/uploads/finalize` responden 200; después permite continuar.
- Después de recargar, agregar una segunda foto recupera primero el borrador anterior mediante finalización idempotente. Las dos fotos llegan al presupuesto y este responde HTTP 200, en lugar del HTTP 400 anterior.
- No se prepararon trabajos ni se crearon checkouts o pagos en esta verificación.

## Impedimentos de cotización separados del fallo de fotos

La ficha antigua del propietario carece de capacidad/tecnología confirmadas. Declararlas en el pedido devuelve `equipment_declaration_requires_review`, según la política vigente; esa comprobación no se deshabilitó.

Con el equipo de pruebas registrado del propietario, la consulta del presupuesto devuelve `travel_unverified`. El calculador llama a Google Maps usando `GOOGLE_MAPS_SERVER_API_KEY`, ausente en producción y en la configuración local examinada. Producción sí contiene `OPENROUTESERVICE_API_KEY`, pero la versión publicada no tiene una integración que la utilice. Se consultó al usuario qué proveedor quiere usar para resolver ese impedimento. Por ello, estas verificaciones **no certifican que cualquier solicitud nueva pueda llegar al pago**.

Evidencia privada de la carga automática: `output/photo-request-20261020/automatic-upload-production.png` (excluida de Git y despliegue).
