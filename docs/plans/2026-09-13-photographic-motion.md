# Habitación fotográfica y relato del aire acondicionado

**Goal:** Conservar el aspecto de la imagen aprobada al animar la portada y explicar visualmente el valor del aire, el diagnóstico y la propuesta de reparación.

**Architecture:** Sustituir el intercambio imagen/modelo geométrico por capas fotográficas con profundidad moderada. Un componente independiente presenta un aire acondicionado desarmándose al desplazarse. Imágenes locales optimizadas, transformaciones CSS y un bucle de animación acotado; texto siempre accesible y alternativa estática con movimiento reducido.

**Tech stack:** Next.js, React, CSS, generación integrada de imágenes, Vitest y navegador.

**Ampliación autorizada:** El usuario precisó que el negocio es el mantenimiento del hogar con personal calificado, especializado y aprobado que trabaja con Lysto. El inicio debe desarrollar esta diferencia, la confianza al abrir la puerta, precios claros, calificaciones y seguimiento. Se incorporan una introducción editorial, una sección de confianza y otra de cuidado continuo; se alinean Solución, Nosotros y preguntas frecuentes. La oferta actual continúa siendo aire acondicionado, sin inventar nuevos servicios ni promesas absolutas de seguridad.

La autonomía de diseño autorizada por el usuario continúa vigente. Su dirección actual es conservar la primera imagen, mejorar el realismo y añadir una explicación comercial con piezas funcionales del aire. Se compararon geometría procedural más detallada (seguiría alejándose de la imagen), reconstrucción volumétrica por IA (necesita servicio externo) y capas derivadas de la imagen. Se elige la última por fidelidad, ligereza y control visual.

## 1. Habitación (root)

- Crear una placa de arquitectura y recortes independientes del sillón, mesa y planta a partir de `public/images/lysto-home.webp`; conservar luz, cámara, materiales y escala.
- Guardar los originales generados y activos optimizados en el proyecto; registrar prompts.
- Reemplazar `components/marketing/home-scene.tsx` por composición por capas. Desplazamiento y puntero aportan profundidad sin girar demasiado una imagen plana. Mantener la fotografía completa como alternativa si una capa no carga.
- No mostrar un segundo modelo distinto después de la carga. Suspender animación fuera de pantalla, limpiar listeners y respetar movimiento reducido.

## 2. Aire acondicionado (agente de implementación)

- Crear `components/marketing/air-story.tsx`, estilos propios y recursos `public/images/air-*`.
- Dirección: un producto blanco y realista que se abre en carcasa, filtros, serpentín y ventilador/desagüe, con separación animada. Usar imágenes generadas fieles a producto físico, no cubos CSS.
- Texto: confort para descansar/trabajar/disfrutar; por qué importan flujo de aire, intercambio térmico y drenaje; revisar el síntoma, diagnosticar y definir un presupuesto apropiado antes de avanzar. No prometer ahorro cuantificado, beneficios médicos ni precio más bajo garantizado.
- Sección clara en celular, scroll natural y controles accesibles para recorrer etapas. Texto y visual útiles sin JS/movimiento.
- Referencia factual: Energy Star maintenance checklist y DOE HomeCooling101. La imagen es una vista ilustrativa de un split; no instrucciones de reparación.

## 3. Integración y comprobación (root + revisión)

- Integrar entre servicios y proceso de Inicio, evitando repetir la sección existente de confort; mantener navegación y páginas aprobadas.
- Verificar comportamiento de controles, retroceso, fallback, móvil y limpieza de animación. Probar enlaces de entrada pública y nuevas interacciones.
- Revisión independiente de requisitos y calidad. ESLint, TypeScript, pruebas relevantes y compilación final aislada; actualizar vista previa en 3001.
- Mostrar el resultado y explicar brevemente que la habitación usa capas fotográficas animadas para preservar su apariencia.

## Resultado

Completados habitación, relato del aire, ampliación de confianza y cuidado continuo, alineación de las páginas públicas y revisión independiente. Corregidos dos casos móviles de la animación: destino al elegir una etapa antes de fijarse la imagen y lectura en pantallas de poca altura. ESLint, TypeScript, 325 pruebas unitarias y compilación de producción aprobados; 8 pruebas de integración omitidas según configuración previa. Vista de producción actualizada en 3001. Detalle en `docs/public-website-handoff.md`.
