# Provincia antes de la dirección y validación obligatoria

Fecha: 26/10/2026, Argentina. Estado: **publicado y comprobado en el dominio público**. Reemplaza el ingreso manual publicado en 8cb1de6, retirado por indicación expresa del titular.

## Comportamiento publicado

El formulario compartido pide Provincia antes de Dirección. Incluye las 23 provincias argentinas y CABA como jurisdicción separada, con nombres e IDs oficiales contrastados contra GeoRef. Dirección permanece deshabilitada hasta elegir provincia. La elección se aplica al proveedor antes del límite de resultados y prevalece sobre una provincia escrita en el texto. Cambiarla vacía dirección/localidad/altura y comprobante, y descarta búsquedas o confirmaciones anteriores que lleguen tarde.

Se retiraron «Mi dirección no aparece», el formulario manual, sus avisos y la salida agregada para esa alternativa. El servidor rechaza mode manual, coordenadas nulas, centroides y comprobantes manuales antiguos aun firmados auténticamente; tampoco los renueva. Completar el perfil o guardar un domicilio nuevo exige una selección oficial resuelta, coordenadas precisas y comprobante vinculado al texto. Una búsqueda sin coincidencias o un fallo del proveedor conserva el texto para corregir o reintentar y no habilita un domicilio no validado.

La validación del domicilio acepta Argentina; el cálculo comercial, su caché y la cobertura conservan el límite CABA/Buenos Aires. No hay cambios de esquema, permisos ni cobertura de precios. No se reescriben domicilios existentes. La edición de una etiqueta o acceso de un domicilio completo ya guardado conserva la ubicación. El perfil parcial ahora toma juntos los cuatro campos geográficos de la nueva selección validada, evitando mezclarlos con datos anteriores.

## Publicación

- Runtime: 8f2c3a62dda26ee3e782d7cb6d76fea48e406370.
- Deployment: dpl_7i2YDtmW78RcmjhCjq3CUSP3MTyB, preparado sin dominio, READY y promovido tras los controles.
- Inmediatamente antes de promover, el dominio todavía apuntaba a dpl_BJpcaH7e3ivTTirBxeJNFmkDiFPs; no hubo una publicación concurrente que integrar.
- Después de promover, lystohogar.com apunta al candidato; live devuelve HTTP 200 y el commit exacto. Ready devuelve HTTP 200, production/ready, sin avisos, con solicitudes y checkouts habilitados.
- No se añadieron dependencias, secrets ni configuración. Se conservan los correos automáticos y las publicaciones previas de asignación directa y aprobación documental.

## Pruebas y revisión

| Control | Resultado |
| --- | --- |
| Tipos y lint generales | Ambos exit 0. |
| Dominio | 174/174, exit 0. |
| Herramientas | 165/165, exit 0. |
| Búsqueda y catálogo | 58/58; incluye provincia autoritativa, identidad censal y fallos del proveedor. |
| Backend ampliado | 84/84; nacional final 17/17, con solapamientos: no sumar. |
| Consumidores/profesional | 37/37 con comprobantes reales firmados y transporte controlado. |
| Autenticación/persistencia | 32/32, incluida la corrección del perfil parcial. |
| UI compartida nueva | 10/10: orden, deshabilitado inicial, cambio de provincia, respuestas tardías y rechazo manual/cross-province. |
| Revisión independiente | Sin P1/P2 pendientes en el cambio. Regresiones nuevas observadas rojas antes de implementar. |

La corrida completa ejecutó **2.478 casos en 271 archivos**: 2.477 pasaron y una aserción de mensaje conservaba «Elegí una sugerencia», mientras el producto devolvía correctamente «Elegí la provincia y seleccioná una dirección de la lista». Se actualizó únicamente esa expectativa y se reejecutó professional-address-selection: **2/2, exit 0**, además de lint del archivo. Se contrastaron las mismas identidades de prueba y cero diferencias de runtime respecto del candidato. No se repitió toda la suite después de ese cambio exclusivamente de aserción, ni se alteró el informe original para declararlo verde.

Informes locales ignorados: output/province-first-final-unit.json (corrida completa), output/province-first-selection-message-final.json (archivo corregido) y archivos province-first-* de tipos, lint y controles enfocados. Las regresiones originales de Hogar y calculadora conservan creación atómica, reintento, piso/acceso, versiones y comprobantes; se adaptó su selección al nuevo orden obligatorio.

## Navegador del dominio público

La sesión disponible es administrativa. Se probó el componente compartido en /admin/precios; no se crearon usuarios, domicilios de clientes, pedidos, presupuestos ni pagos productivos para probar.

1. Provincia habilitada y vacía; Dirección deshabilitada; cero botones de ingreso manual.
2. Seleccionar CABA habilita Dirección. «Pavón 2012» recibe HTTP 200, tres opciones, todas provincia 02. La primera se confirma como AV PAVON 2012, San Cristóbal, CABA; resolve HTTP 200, source georef, precisión range_interpolated, coordenadas finitas y comprobante presente. El comprobante no se imprimió ni guardó en la evidencia.
3. Cambiar a Buenos Aires vacía Dirección. La misma búsqueda recibe HTTP 200, doce opciones, todas provincia 06, sin resultados CABA.
4. Cambiar a Córdoba vacía Dirección. La misma búsqueda recibe HTTP 200, diez opciones, todas provincia 14. La primera se confirma como PJE PAVON 2012, Córdoba, Córdoba; resolve HTTP 200, source georef, precisión range_interpolated, coordenadas finitas y comprobante presente. Esto valida domicilio; no se calculó ni amplió la cobertura de servicio.
5. Una calle sintética inexistente muestra «No encontramos coincidencias» y no ofrece ingreso manual.

Evidencia local: output/province-first-production-health.json, output/province-first-browser-evidence.json y captura output/province-first-published.png. Escaneo posterior del deployment, nivel error, últimos 15 minutos y límite 100: **cero entradas, exit 0**. Es una ventana acotada, no un monitor continuo.

## Límites

Las coincidencias dependen de cobertura y disponibilidad del proveedor. Sin una coincidencia validada no se completa el domicilio ni el perfil; no se crean puntos ficticios para superar ese requisito. Las pruebas de persistencia usan los componentes y servicios reales con transporte controlado; no equivalen a una nueva alta productiva de cliente/profesional. Los límites generales de apertura y recuperación permanecen en el [informe histórico de lanzamiento](2026-10-25-launch-readiness.md).
