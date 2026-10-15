# Pedir: imágenes del aire acondicionado

## Uso

Imágenes de producto generadas con la herramienta integrada `image_gen`, no con CLI/API externa. Referencia visual aprobada: `exec-454bcebc-ff06-4c8f-bcb9-427139e24d5d.png` (selección de síntoma con gotas transparentes realistas).

Son ilustraciones genéricas del síntoma declarado; no fotografías del equipo del cliente ni diagnósticos. El nombre y las características del aire se muestran como contenido de la interfaz, nunca incrustados en la imagen. No sustituyen la escena 3D real de Hogar ni determinan el presupuesto.

Todas mantienen un lienzo de 1536 × 1024, perspectiva y encuadre coherentes. La variante neutral sirve también para instalación, mantenimiento y “No sé qué le pasa”.

| Estado | Archivo público recomendado | Cambio visual |
| --- | --- | --- |
| Neutral | `/images/service-request/air-neutral.webp` | Aire abierto, sin efectos |
| `no_enfria` | `/images/service-request/air-no-enfria.webp` | Cambio discreto de orientación de la aleta |
| `pierde_agua` | `/images/service-request/air-pierde-agua.webp` | Pequeña huella húmeda y gotas claras |
| `hace_ruido` | `/images/service-request/air-hace-ruido.webp` | Leve desenfoque fotográfico localizado en las aletas |
| `no_enciende` | `/images/service-request/air-no-enciende.webp` | Salida cerrada, indicador oscuro |
| `no_funciona_calor` | `/images/service-request/air-no-funciona-calor.webp` | Aleta orientada ligeramente hacia abajo |

No todos los síntomas tienen una manifestación visual inequívoca. La etiqueta seleccionada es siempre la fuente explícita de significado: no depender exclusivamente de diferencias pequeñas entre imágenes. Mantener la aclaración “Ilustración del síntoma, no un diagnóstico”.

## Prompts finales (normalizados)

**Base — `product-mockup`:** Un único aire acondicionado split interior blanco, sin marca, como fotografía de producto o render 3D fotorrealista premium. Carcasa suavemente redondeada, uniones sutiles, pequeña marca de estado negra inactiva, salida oscura y aletas realistas entreabiertas. Cámara casi frontal, lado derecho levemente visible, borde superior subiendo apenas hacia la derecha. Iluminación neutra suave desde arriba a la izquierda. Lienzo horizontal 1536 × 1024, producto centrado y algo por encima del centro vertical, espacio transparente debajo. Fondo genuinamente transparente, bordes alfa suavizados. Sin habitación, pared, piso, texto, interfaz, marca, logo, control remoto, flechas, agua, hielo, niebla ni aire coloreado.

**Ediciones — `precise-object-edit`:** Usar la imagen base como objetivo exacto. Conservar cuerpo, silueta, encuadre, escala, perspectiva, materiales, iluminación, marca de estado y lienzo. Preservar transparencia. Cambiar solamente el detalle de cada variante:

- **`no_enfria`:** Abrir aproximadamente 15 grados más la aleta inferior larga y mostrar algo más del interior oscuro. Sin niebla, humo, hielo, escarcha, agua, colores térmicos ni una causa supuesta.
- **`pierde_agua`:** Añadir una huella húmeda pequeña bajo la salida, cerca del 40 % del ancho, una gota clara pendiente y dos o tres gotas pequeñas cayendo debajo. Reflejos grises/blancos y refracción realistas; nunca gotas azules grandes o de caricatura. Sin charco.
- **`hace_ruido`:** Añadir una doble exposición mínima, fotográficamente plausible, en las aletas y apenas en un borde inferior; cuerpo nítido. Sin ondas de sonido dibujadas, anillos, piezas rotas, humo ni desplazamientos grandes.
- **`no_enciende`:** Cerrar la aleta inferior en posición de reposo, dejando una ranura oscura estrecha. Indicador oscuro. Sin humo, advertencias, aire visible ni daños inventados.
- **`no_funciona_calor`:** Orientar ligeramente hacia abajo la aleta, sin aire visible ni efectos térmicos. Sin llamas, brillo rojo/naranja, hielo, agua, niebla o daños inventados.

Una prueba inicial de `no_enfria` produjo niebla demasiado visible: se descartó y no forma parte de los archivos del proyecto.

## Verificación y formato

- Las seis salidas PNG fueron inspeccionadas visualmente con `view_image`.
- Todas tienen 1536 × 1024 y canal alfa. Los bordes superior/inferior muestreados son transparentes; un píxel de esquina de la variante ruido tiene alfa 1/255, igualmente casi transparente.
- WebP generado desde cada PNG mediante el `sharp` existente, con `lossless: true`, `effort: 6`, sin recortar, redimensionar, retocar ni componer imágenes.
- Comparación de las seis parejas con `sharp` decodificado: cero diferencias de alfa y cero diferencias RGB en píxeles visibles.
- WebP pesa entre 406 576 y 451 812 bytes por imagen; PNG entre 1 104 498 y 1 196 803 bytes. Los PNG son fuentes hermanas disponibles en la misma carpeta; el consumidor debería preferir WebP o la optimización de imagen de Next.js.
- La vista local de WebP mostró un artefacto del decodificador de previsualización. Los datos decodificados con `sharp` son exactamente iguales a los PNG inspeccionados; verificar además en la interfaz durante el control visual del formulario.

No se sobrescribió `public/images/customer-home-air.png`. No hubo cambios en interfaz, lógica, dependencias, cuentas ni datos reales.
