# Búsqueda de direcciones y salida manual

## Objetivo autorizado

El usuario pidió corregir el buscador completo, encontrar la dirección correcta, evitar bloqueos si ninguna opción sirve, probarlo y publicarlo. Se trabaja sobre la rama de revisión existente; no se revierten publicaciones concurrentes ni se contratan servicios.

## Diagnóstico reproducido

La búsqueda publicada usa GeoRef sin filtros territoriales en modo discovery, recorta a100 antes de ordenar y pierde localidad en textos de varias comas. La consulta pública «Corrientes1234» devolvió100 candidatos nacionales sin CABA; agregando «CABA,Argentina» se repitió el mismo problema. Las sugerencias incluyen tramos sin ubicación; elegirlas puede fallar y el guardado exige una selección confirmada.

## Alternativas

1. Corregir las consultas de GeoRef y agregar ingreso manual firmado: reutiliza proveedores, evita nuevas claves/costos y permite guardar sin declarar coordenadas verificadas. Elegida.
2. Cambiar a un proveedor comercial de autocompletado: requiere evaluar cobertura, facturación, privacidad y credenciales; no es necesario para corregir estas fallas demostradas.
3. Incorporar un mapa con pin libre: necesita almacenar puntos propios del usuario separados de la caché global para evitar que un pin arbitrario cambie el traslado de otros. No se sustituye verificación de proveedor por coordenadas inventadas.

## Diseño

- Buscar dentro de CABA/Buenos Aires antes de aplicar límites, consultando por separado si falta contexto. Interpretar localidad/provincia/país en formatos habituales; conservar el contexto conocido y permitir reemplazo explícito.
- Priorizar calle y altura coincidentes, ubicación utilizable e identidad territorial. No presentar otra calle como coincidencia exacta ni perder el identificador censal oficial.
- El componente compartido ofrece «Mi dirección no aparece» siempre, incluidos falta de resultados y caída del proveedor. Permite escribir calle, altura, localidad y provincia, corregirlos y confirmar esa entrada.
- La variante manual del endpoint existente emite un comprobante firmado, vinculado al texto, con source manual, precision unverified y coordenadas null. No inventa identificadores oficiales ni escribe puntos en la caché verificada.
- El registro y guardado aceptan esa entrada manual. El traslado y el presupuesto siguen usando coordenadas verificadas por el servidor; una dirección manual no habilita por sí misma una oferta o cobro. Si el proveedor no consigue ubicarla, la pantalla explica el siguiente paso y ofrece ayuda/revisión existente.
- No cambiar esquemas de base ni reescribir domicilios de producción para probar.

## Criterios de aceptación

Pruebas rojas/verdes de consultas representativas, formatos equivalentes, contexto, calle numerada, altura incorrecta, duplicados y proveedor caído. Pruebas de entrada manual, edición, errores y carreras; firma, expiración, renovación y ausencia de contaminación de caché. Verificar registro/guardado y presupuesto no ofertable sin traslado. Revisión independiente, suite completa, tipos, lint, build y comprobación del candidato/publicación. Pruebas reales de ubicación usarán direcciones públicas; no se crearán solicitudes ni pagos reales.
