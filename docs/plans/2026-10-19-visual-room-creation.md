# Alta visual de ambientes

**Objetivo:** añadir ambientes desde su ubicación en la maqueta y elegir tipo/variante en un modal, sin pedir medidas, coordenadas, ventanas ni orientación.

**Diseño:** conservar la tipografía, superficies claras y azul de acción de Hogar. El elemento principal es la maqueta existente: círculos azules translúcidos en los costados libres y una vista del ambiente elegido que cambia al deslizar. Mantener edición, plantas, equipos, historial y controles accesibles. En una planta vacía, abrir directamente el selector del primer ambiente. En vista de lista o sin WebGL, ofrecer los mismos costados con botones descriptivos.

**Arquitectura:** calcular posiciones adyacentes válidas en una función pura que considere dimensiones, rotación, límites y superposiciones. Mantener el borrador en el cliente y persistir por la API/versionado actuales. Reutilizar la escena 3D en modo de vista previa sin rotación táctil para que el gesto horizontal cambie variantes. No requiere migraciones.

**Tecnologías:** React, Next.js, Three.js, CSS Modules, Vitest y Testing Library.

**Ajuste solicitado:** el tipo de ambiente se elige desde una lista desplegable compacta en lugar de botones, dejando más espacio a la maqueta. Las variantes siguen cambiando al deslizar o usar las flechas.

1. Añadir pruebas de posiciones en cuatro costados, ocupación, rotación y límites; comprobar que fallan y crear `lib/customer-homes/room-additions.ts`.
2. Añadir pruebas de alta visual, cancelación, planta vacía, variantes y error de guardado. Implementar `room-picker.tsx`, integrar en `customer-hogar.tsx` y adaptar las pruebas del flujo anterior.
3. Proyectar botones de ubicación en `home-scene.tsx`; conservar el encuadre y ofrecer alternativa sin GPU. Agregar estilos consistentes y responsive.
4. Ejecutar pruebas de Hogar, chequeo de tipos y lint de archivos afectados. Revisar visualmente la maqueta y el modal en navegador local, incluida interacción táctil y teclado.

Los cambios previos de autenticación, emails y otros archivos del árbol de trabajo quedan fuera de este trabajo.

## Validación

- 126 pruebas de Hogar, posiciones, variantes, recuperación de guardados y diálogos aprobadas.
- Revisión en navegador local con datos de prueba: cuatro costados, incorporación del ambiente, cambio de variantes por arrastre, flechas, planta vacía y foco de teclado.
- Vista móvil comprobada a 390 × 844; capturas en `output/hogar-visual/`.
- La pantalla temporal de prueba se retiró. No se modificaron datos de producción.

## Integración para publicar

- Trasladado sobre `main` en `ed0d5c80dbb86f177197541933d734fde9070f81`, conservando las actualizaciones de ubicación, recuperación de contraseña y accesos rápidos.
- El acceso de Equipo con un hogar vacío también abre el selector visual; su regresión falló antes del ajuste y pasó después.
- Verificados los 134 casos dirigidos de Hogar y diálogos. La comprobación del foco espera su restauración posterior al cierre; los seis casos del selector pasaron al verificar ese estado asíncrono.
- TypeScript y ESLint verificados para el candidato. La publicación debe pasar además por la CI completa de `main`.
