# Administración Lysto — revisión de UI/UX

Fecha: 10 de septiembre de 2026.

## Alcance y referencia

Adaptación de las **25 pantallas existentes** a la dirección aprobada «Lysto evolucionado», con prioridad en el uso móvil. Es una implementación sobre el producto existente, no una reproducción literal de cifras, personas, fotos o funciones ficticias de las imágenes.

- Verdad visual: `E:/Proyectos/GitHub/Lysto/output/admin-ui-concepts/final/01-dashboard.png` a `25-marketplace.png`.
- Implementación: `http://localhost:3000/admin/dashboard` y las otras 24 rutas del inventario.
- Evidencia: `output/admin-ui-qa/01-desktop.png` a `25-desktop.png`, y sus equivalentes `01-mobile.png` a `25-mobile.png`.
- Comparación conjunta de referencia e implementación: `output/admin-ui-qa/comparison-1.png` a `comparison-5.png`. Cada hoja incluye cinco pares, referencia a la izquierda e implementación a la derecha.
- Mediciones de las 50 vistas: `output/admin-ui-qa/responsive-checks.json`.
- Escritorio: viewport CSS 1487 × 1058, densidad 1. Capturas de viewport a escala nativa. Las hojas comparativas reducen ambos lados por igual; no se usan para afirmar igualdad píxel a píxel.
- Móvil: viewport CSS 390 × 844, densidad 1; capturas de página completa con altura variable. Verificaciones adicionales de precios a 320 × 740 y solicitudes a 768 × 1024.
- Estado: datos demostrativos iniciales, menú cerrado, tema claro. Las referencias contienen más registros y otros datos; esa diferencia de contenido es intencional.

## Hallazgos e iteraciones

1. **[P2 resuelto] Demasiada altura de resumen en móvil.** Las cuatro métricas desplazaban innecesariamente los controles de búsqueda. Se redujo padding y se ocultaron únicamente sus aclaraciones secundarias en celular; se conservaron etiqueta y valor. Evidencia posterior: `02-mobile.png`, con métricas compactas y filtros que se reorganizan sin scroll horizontal.
2. **[P2 resuelto] Proporciones y acción de matching.** La primera versión daba demasiado espacio al contexto y utilizaba filas verticales de hechos que empujaban la acción hacia abajo. Se invirtió la proporción a 1:1,7 y se organizó la información de cada candidato en dos columnas. Evidencia posterior: `06-desktop.png`, `06-mobile.png` y primera fila de `comparison-2.png`. La acción mide 44 px de alto y queda entre y=925,98 y y=969,98 en el viewport de escritorio.
3. **[P2 resuelto] Filtros conservados al cambiar de grupo.** Cambiar la pestaña de solicitudes reinicia la tabla y evita conservar un filtro incompatible con el nuevo grupo.
4. **[P1 funcional resuelto] Detalles con el primer registro fijo.** Las cuatro rutas dinámicas ahora resuelven el identificador recibido. Un ID inexistente presenta una recuperación explícita, nunca los datos de otra persona. Cubierto por ocho pruebas de rutas.

No se detectaron otros bloqueos de uso en las vistas recorridas. La comparación es de dirección visual, jerarquía y adaptación al producto; no certifica equivalencia funcional con cada control dibujado por IA.

## Superficies de fidelidad

- **Tipografía:** Inter y fallback del sistema existentes. Títulos de 30 px en escritorio y 25,6 px en móvil; textos de operación de 13–14 px, entradas móviles de 16 px. Jerarquía, pesos y ajuste de texto comprobados. Las capturas del navegador tienen diferente suavizado respecto de los mockups; no se atribuye esa rasterización a diferencias del CSS.
- **Espaciado:** shell existente, superficies de 12–16 px de radio, separaciones de 20–24 px, encabezados y acción principal por pantalla. Tablas en escritorio y filas con etiquetas en móvil/tablet. Las pantallas de detalle apilan el contenido sin ocultar información. Se acepta menor densidad de registros por utilizar la muestra real del repositorio.
- **Color:** canvas claro `#f8fafc`, panel blanco, azul primario `#0066ff`, bordes `#e5eaf2` y estados semánticos verde/ámbar/rojo con texto. Se conserva la relación visual con Cliente.
- **Imágenes/iconos:** se reutiliza la marca y Lucide del producto. Iniciales identifican perfiles sin fotos disponibles. No se fabricaron fotos de evidencia, retratos o mapas de cobertura. Los mapas de las referencias se sustituyen por datos de zona y capacidad, no por un dibujo que pretenda ser un mapa real. No se agregaron dependencias de imágenes externas.
- **Contenido:** idioma español y dominio de aire acondicionado. Importes y perfiles proceden de la muestra existente. Reportes, calidad y finanzas distinguen información disponible de datos faltantes; no se inventan tendencias ni tiempos de SLA.
- **Inspección enfocada:** se comprobó el panel de candidatos, sus etiquetas, distribución y botón mediante captura posterior al ajuste y medidas DOM; también la matriz de precios a 320 px, el listado móvil y el drawer. Evidencia: `06-desktop.png`, `06-mobile.png`, `prices-320.png`, `requests-tablet.png`, `mobile-navigation.png`.

## Interacciones comprobadas

- Búsqueda sin exigir acentos, filtros por estado y prioridad, pestañas y recuperación sin resultados.
- Enlaces con IDs correctos de clientes, solicitudes, profesionales y trabajos.
- Lista/agenda de trabajos y apertura del historial técnico dentro de Administración.
- Selección de candidato, bloqueo de solicitudes impagas y aviso de borrador sin asignación real.
- Simulación de precios: base de 40.000 + prioridad 1,25 = 50.000.
- Simulación de split: 50.000 al 18% = 9.000 para Lysto y 41.000 para el profesional.
- Borrador de precios conservado al navegar a Marketplace y volver mediante enlaces internos.
- Menú de herramientas con los 21 módulos no dinámicos; los cuatro detalles se alcanzan desde sus listados.
- Drawer móvil de 288 px, bloqueo de scroll, cierre con Escape y devolución de foco al disparador. El shell existente conserva sus pruebas de trampa de foco.
- Formularios etiquetados, controles táctiles de 44 px, foco visible, preferencias de movimiento reducido y anuncios de éxito locales.
- Estados de carga, error recuperable y registro inexistente.
- Recorrido de las 25 rutas en móvil y escritorio: sin desbordamiento horizontal visible. Consola revisada al finalizar el recorrido: sin errores de aplicación registrados.

## Verificaciones técnicas

- `pnpm typecheck`: pasó.
- `pnpm test:domain`: 124/124.
- `pnpm test:unit`: 155/155 en el primer recorrido completo.
- Suite final ampliada de Administración: 21/21, incluyendo las ocho comprobaciones nuevas de identificadores.
- ESLint de `components/admin`, `app/(admin)/admin` y la nueva suite: pasó.
- ESLint global: bloqueado por `next-env.d.ts:3`, referencia triple slash generada por Next. Ese archivo ya estaba modificado al comenzar; se preservó y no se cambió la configuración general para silenciarlo.
- Build de producción: `pnpm exec next build --no-lint` pasó (salida 0), con las 25 rutas administrativas incluidas. El lint del código modificado se validó por separado; el error global del archivo generado sigue siendo preexistente.
- Vista final reabierta mediante `pnpm start`. Dashboard comprobado en navegador, sin errores de consola. Evidencia: `output/admin-ui-qa/production-dashboard.png`; ancho normal del panel 499 px, contenido y scroll 484 px, sin desbordamiento. El override temporal del viewport fue restablecido.

## Límites deliberados

No se conectaron nuevas API, envíos de emails/WhatsApp, liquidaciones, devoluciones, invitaciones reales ni persistencia de configuración. Los borradores viven sólo durante la sesión de Administración y desaparecen al recargar. La UI informa ese límite antes de guardar. No se modificaron las áreas Cliente ni Profesional, ni los datos demostrativos compartidos.

## Checklist final

- [x] 25 rutas rediseñadas y recorridas.
- [x] 25 vistas móviles y 25 de escritorio registradas.
- [x] Cinco hojas comparativas revisadas.
- [x] Matching recapturado tras el ajuste de densidad.
- [x] Identificadores, filtros, formularios y recuperación comprobados.
- [x] Terminar build y reabrir vista previa final.

## Pulido posterior opcional

- Cuando existan los datos: mapas geográficos verificados, evidencia fotográfica, series históricas y datos de disponibilidad en tiempo real.
- Extender filtros/paginación y selecciones masivas cuando los listados dejen de ser muestras pequeñas.

final result: passed

Resultado aprobado para el alcance de adaptación visual y comportamiento demostrativo. El aviso de lint global preexistente y las integraciones pendientes están documentados; no se presenta esta entrega como operación real de pagos, envíos o asignaciones.
