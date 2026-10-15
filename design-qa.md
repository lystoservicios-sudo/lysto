# Acceso cliente Lysto — opción 3

Fecha: 15 de octubre de 2026. Implementación sobre el sistema existente; sin publicación ni cambios de datos en producción.

## Referencia y evidencia

- Fuente visual: `C:/Users/quime/.codex/generated_images/01a113b5-c26c-7343-bd9a-4e894c9a32af/exec-85b1e4e1-c2fb-48a1-ac93-acfa0f17fa2a.png`.
- La imagen fuente mide 1224 × 1285 y contiene dos pantallas. Se recortaron las regiones de 600 × 1285 de cada pantalla y normalizaron, conservando proporción, a 390 × 844 con espacio blanco residual. No se comparó el tablero completo con una sola pantalla.
- Capturas reales del navegador integrado: `output/auth-design/login-mobile.png`, `recovery-mobile.png`, `reset-link-missing-mobile.png`, `confirmation-invalid-mobile.png` a 390 × 844. Densidad de comparación 1; sin marco de dispositivo.
- Registro: `output/auth-design/registration-details-mobile.png` y `registration-access-mobile.png`; componentes reales en una vista aislada con datos legales de ejemplo. No contiene claves, no conecta al backend y rechaza cualquier envío final. El rótulo de ensayo es infraestructura de verificación, no parte de la UI publicada.
- Comparación conjunta, fuente izquierda y aplicación derecha: `output/auth-design/login-comparison.png`, `registration-comparison.png`.
- Anchos adicionales comprobados: 320, 768 y 1280; capturas y medidas en `output/auth-design/login-320.png`, `login-768.png`, `login-1280.png`, `responsive.json`. Sin desbordamiento horizontal; acción principal de 48 px en los tres anchos.

## Hallazgos e iteraciones

1. **P2 resuelto: densidad del segundo paso.** La primera comparación conjunta mostraba descripción y título de paso repetidos que desplazaban el envío. Se eliminó la descripción redundante del registro, se conservó el título de paso solo para lectores de pantalla y se ajustaron separaciones a 16 px. La nueva captura y comparación muestran el envío principal completo. El pie puede requerir desplazamiento en móvil por las versiones legales reales y los objetivos táctiles de 44 px; esta diferencia de contenido frente al mock es intencional.
2. **P2 resuelto: recuperación en Login.** El enlace estaba junto a la etiqueta de contraseña; ahora aparece debajo del campo, alineado a la derecha como en la referencia. Se verificó primero con prueba fallida, después prueba aprobada y recaptura real de la aplicación compilada.
3. **P2 resuelto: coherencia de confirmación.** La página HTML protegida tenía otras proporciones de marca/imagen. Su CSS estática ahora replica los tamaños de la cabecera móvil y de escritorio del shell cliente.

No quedan hallazgos visuales P0/P1/P2 accionables en el alcance verificado. No se reinterpreta el diseño como página de marketing: no hay menús comerciales, tarjetas exteriores ni navegación autenticada.

## Superficies de fidelidad

- **Tipografía:** Inter/fallback existente, títulos de 26 px (24 a 320 px), campos de 16 px, etiquetas de 14 px. Se conservaron pesos, jerarquía y legibilidad del producto. Las comparaciones a resolución completa permiten leer etiquetas y controles; las medidas DOM complementan la inspección de detalle, por lo que no se necesitaron ampliaciones artificiales.
- **Espaciado:** cabecera de 208 px móvil y 236 px escritorio, formulario con margen lateral de 24 px, controles de al menos 48 px y radios de 10–12 px. Sin tarjetas ni sombras decorativas. Registro conserva desplazamiento natural, sin ocultar acciones detrás de barras fijas.
- **Colores:** azul #075cff, tinta #0d1830, secundario #5d6c84, hielo #f0f5fd. Contrastes calculados: secundario/blanco 5,33:1; secundario/hielo 4,86:1; blanco/azul 5,27:1; tinta/blanco 17,64:1.
- **Imagen:** se reutiliza `public/images/room-architecture.webp`, el mismo ambiente semirrealista de Lysto, sin dibujo CSS ni imagen nueva. Proporción conservada y fondo integrado en hielo. Iconos existentes de Lucide.
- **Contenido:** registro mantiene datos personales, teléfono, email, contraseñas y consentimiento versionado. Las respuestas de registro/reenvío/recuperación siguen siendo genéricas; no afirman que exista una cuenta ni garantizan entrega de correo. Los errores de enlace ofrecen una recuperación útil.

## Interacciones verificadas

- Navegador integrado: ingreso, mostrar/ocultar contraseña sin escribir credenciales, avance del registro con Enter, retroceso con datos conservados, reenvío desplegado automáticamente desde el enlace de recuperación, recuperar acceso, enlace de restablecimiento ausente y confirmación inválida.
- Consola de la aplicación compilada revisada durante el recorrido final: sin errores nuevos registrados. No se enviaron registros, emails ni cambios de contraseña reales.
- Pruebas de componentes: validación por paso, coincidencia y límites de contraseña, conservación tras errores, consentimiento, payload completo, completar cuenta sin stepper, duplicados bloqueados y estados genéricos de revisión del correo.
- Contratos: POST explícito, token, CSRF, cookie, origen, HTTP status, cache no-store, HTML escapado y CSP restringida a recursos de mismo origen. Si el cambio de contraseña funciona pero falla el cierre global, la acción principal es iniciar sesión, no repetir innecesariamente el cambio.
- Movimiento: transiciones de 160–200 ms; cabecera compacta con foco móvil, entrada de paso y feedback; estilos alternativos sin movimiento mediante `prefers-reduced-motion` y la preferencia global ya existente.

## Verificación técnica y límites

- Suite completa Vitest: **1765/1765**, 212 archivos, salida 0.
- Dominio: **174/174**, salida 0.
- Build completo de producción: salida 0, con chequeo de tipos/lint y 108 páginas estáticas generadas.
- La primera ejecución se interrumpió por falta de espacio y archivos generados incompletos; se regeneraron los tipos y se repitió la verificación. El intento de salida movida cargaba otra instancia de React desde otro checkout; la compilación definitiva se realizó en el checkout correcto y pasó. No se alteró código de la app para esconder ninguno de esos fallos.
- La política legal local no está configurada para abrir altas reales. La vista de registro utilizada en la comparación es deliberadamente aislada; las acciones del producto siguen conectadas a sus implementaciones actuales y no se modificaron credenciales ni configuración de producción.
- No se ejecutó el suite E2E que requiere entorno de datos ni se crearon cuentas. Se adaptó su recorrido de registro sin quitar verificaciones legales.

final result: passed

---

# Administración Lysto — revisión de UI/UX (histórico)

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
