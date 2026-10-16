# Carga normalizada de ubicaciones

## Objetivo

Evitar que clientes y técnicos guarden provincias, localidades, calles o alturas mal escritas, sin cambiar los textos, la jerarquía ni la estética actual de los formularios.

## Alcance

La misma regla se aplica en:

- finalización del perfil del cliente;
- alta y edición de direcciones en Más;
- creación de un hogar;
- creación o edición de una dirección dentro de Pedir;
- dirección base del registro del técnico.

No se modifica el contenido visible existente. Los campos mantienen sus etiquetas actuales, incluso cuando dos flujos usan palabras diferentes como `Número` y `Altura`, o `Ciudad` y `Localidad`.

## Arquitectura aprobada

1. GeoRef Argentina provee provincias, localidades, calles y direcciones normalizadas.
2. Google Geocoding, ya utilizado en el cálculo de rutas, confirma el punto final y su cobertura en CABA o Provincia de Buenos Aires.
3. Downshift aporta el comportamiento accesible de combobox sin imponer estilos.
4. El navegador nunca recibe claves de Google. Todas las consultas pasan por rutas privadas de Lysto.
5. Una dirección resuelta vuelve al navegador acompañada por una prueba firmada y de corta duración. Los guardados nuevos o con ubicación modificada requieren esa prueba.
6. El servidor usa los componentes normalizados incluidos en la prueba; no confía en el texto que pueda alterar el navegador.
7. Las direcciones existentes pueden actualizar datos no geográficos —nombre, piso, departamento, acceso o referencia— sin volver a seleccionarse. Si cambia calle, número, ciudad o provincia, se exige una nueva selección.

## Interacción

- Los controles conservan exactamente sus etiquetas y su posición.
- Provincia, localidad/ciudad y calle muestran coincidencias debajo del campo mientras se escribe.
- Las opciones dependen de las elecciones anteriores para reducir homónimos.
- Al escribir la altura, el último desplegable muestra direcciones completas.
- Tocar una dirección completa normaliza los cuatro valores y confirma la ubicación.
- El registro técnico conserva su único campo `Dirección`; sus opciones muestran direcciones completas.
- Cualquier edición posterior en un componente geográfico invalida la confirmación anterior.
- Carga, vacío, error, teclado, foco y movimiento reducido forman parte del componente, pero no agregan instrucciones permanentes ni reemplazan el copy actual.

## Seguridad y resiliencia

- Las rutas requieren una sesión de cliente o técnico, incluyendo técnicos todavía en onboarding.
- Las consultas se limitan por cuenta, se abortan al cambiar el texto y usan una espera breve para evitar una llamada por pulsación.
- Las respuestas de GeoRef y Google se validan con esquemas estrictos.
- La prueba firmada caduca, usa comparación segura de firma y no contiene secretos.
- Ante indisponibilidad o ambigüedad, el sistema no guarda una ubicación nueva como confirmada.
- Las claves de proveedores continúan únicamente en el servidor.

## Decisiones de interfaz

- **Intención:** una persona carga su dirección con la naturalidad de un formulario común, pero el sistema evita silenciosamente errores que afectarían asignación y precio.
- **Paleta y superficies:** se heredan por completo de cada pantalla; el menú usa una superficie elevada, borde suave y el mismo foco azul existente.
- **Profundidad:** una sola capa flotante para las opciones, sin tarjetas decorativas ni nuevos bloques explicativos.
- **Tipografía y espaciado:** se heredan de los controles actuales; base de 4 px y objetivos táctiles mínimos de 44 px.
- **Firma del producto:** cada opción combina la dirección normalizada con su contexto territorial, útil para distinguir calles repetidas sin añadir preguntas nuevas al formulario.

## Fuera de alcance

- Cambiar el texto actual de los formularios.
- Dibujar mapas o pedir al usuario que mueva un pin.
- Autocompletar con datos no seleccionados.
- Cambiar todavía el algoritmo comercial de distancia o asignación.
- Reescribir direcciones históricas ya usadas en servicios.

