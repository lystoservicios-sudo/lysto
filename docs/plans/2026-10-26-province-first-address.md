# Selección de provincia antes del domicilio — diseño y plan

Fecha: 26/10/2026. Este diseño reemplaza la alternativa manual publicada en 8cb1de6 por indicación expresa del titular.

## Diseño solicitado

Primero se elige una provincia argentina (23 provincias y Ciudad Autónoma de Buenos Aires como jurisdicción separada); después se habilita Dirección. El selector es obligatorio y muestra Córdoba, Santa Fe, Buenos Aires y CABA, entre las demás jurisdicciones argentinas. La provincia elegida es autoritativa tanto en UI como en servidor y se aplica al proveedor antes del límite de resultados. Escribir otra provincia en el texto no amplía ni sustituye el filtro elegido. Cambiar provincia vacía calle/altura/localidad, selección y comprobante; cancela respuestas pendientes.

Sólo una dirección resuelta y validada por el servidor permite completar el registro o guardar el domicilio. Se elimina Mi dirección no aparece, el formulario manual, los recibos sin coordenadas y su renovación. Los comprobantes manuales antiguos se rechazan. Si no hay coincidencias o falla el proveedor, se conserva la búsqueda y se pide corregir calle/altura/localidad o reintentar; no hay bypass. La cobertura del servicio conserva sus límites vigentes y se evalúa separadamente de la validación del domicilio. No se modifican direcciones existentes ni se amplía la cobertura de cotización.

## Implementación y pruebas

1. Backend territorial: catálogo canónico de provincias con IDs oficiales; lib/location/search-query.ts y georef.ts filtran por provincia explícita. Regresiones rojas/verde: sin provincia no consulta, Córdoba/Santa Fe/CABA/BA, homónimos, provincia escrita conflictiva y respuestas ajenas filtradas. Conservar IDs, parsing de localidad y mejoras previas de coincidencias.
2. Backend validación: contracts.ts, resolve.ts, proof.ts, renew y caché rechazan modo manual y comprobantes manuales. Aceptar direcciones argentinas canónicas con coordenadas verificadas, preservando la cobertura y las restricciones del cálculo de traslado. Regresiones de firma, provincia, no coincidencias y comprobantes antiguos.
3. UI compartida: FullAddressCombobox incorpora Provincia encima de Dirección. ArgentineAddressFields conserva sólo la provincia al editar calle y borra validación. Onboarding profesional usa el mismo selector y revisiones. Eliminar ManualAddressEntry y sus mensajes/estilos/ayuda exclusiva. Probar orden, deshabilitado inicial, filtro enviado, cambio de provincia, respuestas tardías y bloqueo del guardado sin dirección validada. Actualizar fixtures de consumidores sin relajar sus requisitos.
4. Verificación: tests enfocados primero, tipos, lint, dominio, herramientas, suite completa y revisión independiente. Compilar candidato sin dominio, comprobar commit exacto y versión pública antes de promover. Publicar conservando cambios concurrentes; verificar en navegador el selector, la búsqueda limitada y la ausencia de ingreso manual. Documentar límites sin crear usuarios, pedidos o cobros productivos de prueba.

No cambia el esquema ni se realizan escrituras masivas o destructivas. Continúa la autorización de publicar la reparación.

## Ejecución cerrada

Runtime 8f2c3a62dda26ee3e782d7cb6d76fea48e406370 publicado y comprobado. Revisión independiente y controles técnicos correctos. Corrida completa de 2.478 casos con una expectativa de mensaje antigua; su archivo se corrigió y pasó 2/2 sin cambios de runtime. No se reetiquetó el informe original ni se repitió la suite completa después de esa aserción. [Informe final y comprobación real por provincias](../qa/2026-10-26-province-first-address.md).
