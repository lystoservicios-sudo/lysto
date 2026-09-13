# Profesional: revisión de UI y UX

## Alcance

13 vistas modernizadas: jornada, solicitudes, detalle de solicitud, trabajos, detalle de trabajo, agenda, cobros, perfil, capacitación, soporte, ficha de equipo, Mercado Pago y registro por invitación. Se agregaron límites de carga, error y registro inexistente.

Identidad conservada: shell y navegación comunes, azul Lysto, superficies claras, tipografía existente. Se reutilizan PageIntro, CountTabs, StatusPill, Button/ButtonLink, Input/Textarea, InfoNotice, EmptyState, FormFeedback, MediaUploader y EquipmentThumbnail. El CSS nuevo está limitado a `.pro-workspace`.

## Evidencia visual

Carpeta: `output/pro-ui-qa/`.

- 13 capturas de escritorio a 1440 × 1000.
- 13 capturas móviles a 390 × 844.
- Verificación de las 13 rutas a 320 px: sin desbordamiento horizontal de la página.
- `route-checks.json` y `narrow-checks.json`: títulos y medidas observados en navegador.
- Las capturas de página completa muestran la barra fija a la altura del viewport inicial; no es una barra intercalada en el contenido.

Se inspeccionaron visualmente las familias de listado, detalle, formularios y ayuda. Se redujo la altura de los indicadores del inicio móvil, se evitó el estiramiento de las etiquetas de estado y se mejoró el contraste de placeholders dentro del área profesional.

## Interacciones verificadas

- Filtros de trabajos mediante teclado (End selecciona Finalizados), búsqueda vacía y recuperación.
- Menú móvil: bloqueo del fondo, Escape y devolución del foco a Abrir navegación.
- Detalles por ID y rechazo de IDs inexistentes, trabajos de otro profesional y solicitudes impagas.
- Borradores de perfil, respuestas, consultas y visita: guardado sólo en sessionStorage, errores de almacenamiento y eliminación del aviso de guardado al editar nuevamente.
- Recorrido de prueba del trabajo: no continúa sin diagnóstico ni aprueba en nombre del cliente.
- Registro en pasos: campos etiquetados, validación nativa, navegación atrás conservando datos.
- Capacitación: expansión de guías, lectura y guardado de progreso local.
- Agenda pendiente: fecha más cercana primero, con prueba de regresión.

## Alcance funcional deliberado

Los datos siguen siendo demostrativos. El filtro del profesional es de presentación, no reemplaza autorización del servidor. No se conectaron asignaciones, aceptación real, cambios de estado, liquidaciones, OAuth, envíos, carga de documentación ni validación de invitaciones. Las fotos de trabajo son vistas previas locales y no se incluyen en los borradores. Los importes no se presentan como saldo disponible.

## Verificación técnica

- 35 pruebas específicas del profesional; pruebas de navegación compartida incluidas en la comprobación final.
- 124/124 pruebas de dominio pasaron.
- Revisión de código independiente: sin bloqueantes; el orden de agenda observado fue corregido y cubierto por una prueba.
- Lint acotado al cambio profesional: sin errores.
- El lint global tiene una incidencia previa en `next-env.d.ts` (referencia generada de Next); por eso se verifica el código cambiado por separado y se compila con `--no-lint`.
- La suite global se ejecutó durante cambios concurrentes de precios ajenos a este trabajo. En la última ejecución registrada, 215 pruebas pasaron y una suite nueva de precios no pudo importar su componente todavía en creación. No se alteraron esos archivos.

## Resultado final de compilación

La primera compilación de producción terminó correctamente e incluyó las 13 rutas profesionales (121–128 kB de JS inicial, incluyendo 103 kB comunes del sistema). Después se corrigieron el orden de agenda, las claves de formularios y el contraste de placeholders.

La compilación final compiló el frontend, pero se detuvo en el chequeo de tipos de un cambio concurrente ajeno al rediseño: `app/api/customer/request/submit/route.ts:9`, llamada `rpc('submit_service_quote', { p_quote_id: quoteId })`, cuyo argumento se infiere como `undefined`. No se modificó esa integración ni se desactivó el chequeo de tipos. La vista previa se entrega en modo desarrollo.

Última suite acotada: **42/42** (35 profesional + 7 navegación/shell). El cambio visual está terminado; no se afirma que el proyecto completo esté listo para desplegar mientras persista el error global.

Vista previa final confirmada en `http://localhost:3000/pro/dashboard`: respuesta 200, título correcto, viewport 390 px sin desbordamiento y acción de visita de 48 px de altura. El servidor de desarrollo queda activo para revisión.
