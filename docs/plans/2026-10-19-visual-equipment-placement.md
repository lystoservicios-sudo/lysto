# Alta visual de equipos

**Objetivo:** mover la acción a `+ Equipos`, antes de `+ Ambientes`, y ubicar el aire visualmente; el formulario conserva únicamente Datos del aire.

**Arquitectura:** reutilizar el flujo de alta/reubicación y sus escrituras versionadas. Un navegador con flechas recorre los ambientes del hogar ordenados por planta, omite plantas vacías y conserva los datos del equipo. La escena sigue ubicando el aire al tocar una pared. Una vista simple de paredes permite seleccionar sin WebGL y mediante teclado. Bloquear cambios durante el guardado o una operación pendiente de confirmar.

**Diseño:** para clientes que reconocen su living, dormitorio, paredes y aire sin conocer coordenadas. Conservar el azul de acción, superficies claras, paredes marfil, madera de la maqueta y tipografía existente. Flechas de 44 px, nombre/planta al centro y separación de 8 px. La maqueta y el equipo son el foco; reemplazar lista de ambientes por navegación visual y coordenadas por interacción sobre la pared.

**Tecnologías:** React, Next.js, Three.js, CSS Modules, Vitest y Playwright.

1. Ajustar las pruebas de Hogar al nuevo acceso y ausencia de controles de ubicación; agregar cobertura de cambio de ambiente entre plantas, conservación del borrador, límites y selección sin GPU. Comprobar los fallos antes de implementar.
2. En `customer-hogar.tsx`, mover la acción, incorporar navegación de ambientes y conservar la ubicación de equipos existentes al entrar desde otra planta. Compartir la protección de cambios de pared entre la maqueta y la vista simple.
3. En `hogar-forms.tsx`, omitir Ubicación en el ambiente y sus campos cuando Hogar usa la ubicación visual; conservar los controles opcionales para el recorrido de solicitud de servicio que también consume este formulario. Añadir `equipment-wall-picker.tsx` como alternativa visual; mantener datos y guardado existentes. Estilizar navegación y paredes en `customer-hogar.module.css`.
4. Actualizar los recorridos de navegador para elegir una pared, recorrer ambientes y confirmar persistencia. Verificar pruebas de Hogar, tipos y lint; revisar escritorio, móvil y selección real de pared en navegador local.

No se requieren migraciones ni cambios a la API de equipos.

## Verificación realizada

- 121 pruebas de ocho archivos aprobadas: flujos y operaciones pendientes de Hogar, formulario, catálogo, escena, creación visual de ambientes y recorrido de solicitud de servicio.
- TypeScript y lint de los archivos afectados sin errores.
- Revisión local en navegador: escritorio y ancho de 390 px; navegación entre plantas con conservación del nombre y marca; selección real de pared en la maqueta y en la vista simple; verificación del cuerpo enviado al guardar contra un transporte de prueba sin datos reales.
- Ajuste móvil de la barra: selector de planta en su propia fila para conservar su legibilidad al añadir el acceso Equipos.
- Capturas locales en `output/equipment-visual/desktop.png` y `output/equipment-visual/mobile.png`. Los recorridos E2E con backend real se actualizaron, pero no se ejecutaron en esta revisión local.
- Las páginas temporales de prueba se retiraron al terminar. Sin publicación en producción en esta etapa.
