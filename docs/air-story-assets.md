# Aire acondicionado: fotografía por capas

La sección `AirStory` usa un único producto generado con cuatro conjuntos físicamente coherentes. Se recortan mediante `clip-path` en el navegador y se desplazan en profundidad visual al recorrer el relato; no se cambia a un modelo geométrico después de cargar. La tapa cubre las piezas al principio. Al desplazarse, se abre el conjunto y se explican flujo, intercambio de calor, drenaje y diagnóstico.

## Recursos y generación

- Herramienta: `image_gen` integrada, generación nueva; sin API externa ni clave.
- Original preservado: `public/images/air-exploded-original.png`, 1254 × 1254, RGBA.
- Recurso de producción: `public/images/air-exploded.webp`, 1200 × 1200, WebP calidad 90, alfa preservado.
- `sharp` se usó únicamente para conversión y optimización. No se pintó ni reconstruyó la imagen con código.
- La imagen es ilustrativa, no un despiece de un modelo comercial ni una guía para realizar reparaciones.

Prompt utilizado, sin imágenes de referencia:

> Create a premium photorealistic exploded product photography asset of ONE white wall-mounted mini-split indoor air conditioner, on a REAL transparent alpha background, 1536x1536 square. This is a compositing-ready sprite sheet for a luxury home services website, NOT an infographic, NO text, NO labels, NO arrows, NO logos, NO floor or backdrop. Physical realism, precise materials, matte warm-white molded plastic, fine aluminium fins, copper pipe details, graphite filter mesh, softly lit from upper left, restrained blue reflections. Camera: slightly elevated front-right 3/4 view, mostly front so the whole elongated unit looks long and elegant, long axis horizontal, right side recedes slightly. Render FOUR entirely isolated component groups in FOUR horizontal rows, all with exactly the same perspective, scale, width and horizontal center, and clear completely transparent empty horizontal gutters between rows; never any overlap between rows. Keep all objects fully within canvas and within x=120..1416. Row 1 occupies y=90..350 ONLY: the smooth curved white FRONT COVER / exterior fascia of this air conditioner, simple seamless rounded corners, a very subtle front LED indicator, detached from unit. Row 2 occupies y=420..640 ONLY: the TWO wide removable fine charcoal-mesh AIR FILTERS with white/gray frames sitting side by side, thin curved profiles. Row 3 occupies y=720..960 ONLY: the dense aluminium-finned indoor EVAPORATOR COIL heat exchanger, full-width silver fins with short curved copper loops at the right, realistic small copper pipes, on a discreet slim white cradle. Row 4 occupies y=1070..1410 ONLY: the full-width remaining WHITE REAR HOUSING and base assembly with a visible long black CROSS-FLOW BLOWER turbine cylinder, small right motor, lower white condensate drain pan and an elegant open white outlet louver. Each of four parts is individually opaque and isolated by actual transparency; only subtle small ambient occlusion within the parts, no cast shadow into gutters. All four groups belong to exactly the same one coherent mini split indoor unit. It should look like a precise physical product exploded for an architectural design magazine, highly detailed and expensive-looking, restrained not oversharpened. NO outer compressor, no duplicated extra components, no neon, no diagram outlines, no checkerboard drawn into background.

## Interacción y accesibilidad

- Desplazamiento natural, sin interceptar rueda ni gestos. El producto permanece visible mientras se recorren las cuatro etapas.
- Cuatro botones permiten avanzar o volver; conservan foco, anuncian la etapa elegida y respetan movimiento reducido al desplazar.
- En móvil, los saltos manuales se calculan con la posición fija de destino, también antes de que la imagen se fije. En pantallas de hasta 600 px de alto, la imagen sigue el flujo normal para dejar espacio de lectura.
- El contenido completo y el producto desarmado están presentes en el HTML inicial. Sin JavaScript, se puede leer todo el relato.
- Con `prefers-reduced-motion`, las piezas se muestran separadas sin transformaciones; los controles siguen disponibles.
- Un `requestAnimationFrame` por evento agrupa las mediciones. Se pausa fuera de pantalla o con documento oculto; se limpian observadores, temporizadores y escuchadores al desmontar.

## Contenido técnico

Las descripciones se basan en la [lista de mantenimiento de ENERGY STAR](https://www.energystar.gov/saveathome/heating-cooling/maintenance-checklist) y [Home Cooling 101 del Department of Energy](https://www.energy.gov/sites/default/files/2016/11/f34/HomeCooling101.pdf). No se prometen beneficios médicos, ahorro cuantificado ni el precio más bajo. El recorrido comercial explica diagnóstico y propuesta para aprobar antes de avanzar.

La compilación, las comprobaciones globales y la revisión visual de la integración corresponden a la entrega principal. Las pruebas propias de `tests/unit/air-story.vitest.test.tsx` cubren HTML inicial, controles en ambos sentidos, preferencia de movimiento y seguimiento del desplazamiento con limpieza.
