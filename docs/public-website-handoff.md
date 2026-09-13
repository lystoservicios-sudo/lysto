# Sitio público de Lysto

## Entrega

Inicio, Solución, Nosotros y Contacto comparten navegación adaptable, identidad azul/blanco/verde claro y llamadas a pedir servicio. Se incorporan preguntas frecuentes, cobertura, privacidad, metadatos sociales, sitemap y robots. Los enlaces anteriores de ayuda y aire acondicionado siguen funcionando.

La portada conserva la estética de la imagen aprobada mediante una habitación compuesta por capas fotográficas independientes: arquitectura, sillón, planta y mesa. Responden suavemente al desplazamiento y al puntero, sin cambiar a otro modelo después de cargar. La composición queda estática con movimiento reducido y recupera la fotografía original completa si falla una capa. Se retiraron el motor geométrico anterior y Three.js. La fuente Figtree está alojada en el proyecto con su licencia.

El inicio ahora desarrolla la propuesta de mantenimiento del hogar: personal calificado y especializado, seleccionado y aprobado para trabajar con Lysto; conocimiento de quién llega, presupuesto antes de avanzar, calificaciones y acompañamiento. Incluye nuevas secciones de confianza y cuidado continuo. Solución, Nosotros y las preguntas frecuentes transmiten el mismo modelo. La oferta publicada sigue siendo reparación, mantenimiento e instalación de aire acondicionado.

La sección de confianza usa fondo verde muy claro (`#eef5e8`), titulares azul oscuro/verde y acentos azules, tras suavizar el fondo azul intenso por pedido del usuario. Contraste comprobado en navegador: 6,05:1 para el cuerpo y al menos 5,30:1 para destacados y enlaces. Revisada a 390 y 1440 px sin desbordamiento horizontal.

Una sección del aire acondicionado separa visualmente carcasa, filtros, serpentín y conjunto de turbina/drenaje al desplazarse. Explica confort, funcionamiento y diagnóstico con presupuesto claro. Hay controles accesibles para avanzar y volver; en pantallas bajas la ilustración vuelve al flujo normal para no tapar la lectura. Recursos y prompts en `docs/room-image-assets.md` y `docs/air-story-assets.md`.

Login, registro, Google, confirmación, recuperación de contraseña y perfil progresivo se conectan a Supabase. El servidor verifica identidad, rol, email confirmado y datos mínimos. La primera solicitud recibe el domicilio guardado. La entrada de la cuenta, el perfil y la dirección muestran datos de la sesión real. Detalles de configuración en `docs/customer-auth-setup.md`.

## Contacto

Aplicar `20260913192625_marketing_contact.sql` y configurar `SUPABASE_SERVICE_ROLE_KEY` exclusivamente en el servidor. El formulario guarda consultas en `public.contact_inquiries`; permite lectura a administradores y bloquea lectura anónima o de clientes. Hay validación, consentimiento, campo trampa y límite persistente de tres consultas por email cada diez minutos. El estado de éxito requiere confirmación del guardado.

Las consultas se revisan en esa tabla con acceso administrativo de Supabase. No se envían correos automáticos ni hay una bandeja nueva en el panel administrativo. Para recibir avisos se puede integrar el canal real del negocio después de definirlo.

## Verificación de la entrega inicial, 13 de septiembre de 2026

- ESLint completo: sin advertencias.
- TypeScript completo: sin errores.
- Pruebas de dominio: 124 aprobadas.
- Pruebas unitarias: 316 aprobadas; 8 pruebas de integración de pagos omitidas por su configuración existente.
- Compilación de producción de Next: aprobada, 107 páginas generadas. La portada inicial cargaba 120 kB de JavaScript según el informe de Next.
- Revisión independiente de requisitos y código: sin bloqueantes tras corregir el helper de permisos de contacto, la dirección inicial y la protección del RPC de solicitudes.
- Navegador: portada a 320/390/1440 px, Solución a 768/1440 px, Nosotros, Contacto, login y registro en móvil. Sin desbordamiento horizontal en las medidas comprobadas. Se verificaron menú móvil, navegación, FAQ, foco del primer campo inválido, alternativa sin movimiento y respuesta de Google cuando el proveedor no está disponible.

## Verificación de la revisión visual y comercial

- ESLint completo y TypeScript: aprobados. Compilación de producción: aprobada, 107 páginas generadas; la portada carga 123 kB de JavaScript inicial y ya no requiere Three.js.
- Pruebas unitarias: 325 aprobadas, 8 de integración de pagos omitidas por su configuración existente. Se incluyen 9 pruebas nuevas de habitación y aire: composición inicial, recuperación de la fotografía, controles, movimiento reducido, desplazamiento y selección estable en móvil.
- Revisión independiente: propuesta de valor consistente, sin bloqueos después de corregir la posición de destino de los controles y desactivar la ilustración fija en pantallas bajas.
- Navegador: composición fotográfica cargada y movimiento de planos comprobado; nuevas secciones revisadas a 320, 390 y 1440 px, sin desbordamiento horizontal ni identificadores repetidos. Verificados modo sin movimiento y lectura en 740 × 360.
- Vista de producción reconstruida y reiniciada en el puerto 3001; comprobados los controles sobre esa compilación, incluida estabilidad de la etapa elegida en horizontal.
- El conjunto unitario emite una advertencia de `act` en una prueba existente de `MarketplaceAccount`; no falló ninguna prueba. Webpack emite advertencias de serialización de caché, sin impedir la compilación.

## Ampliación a partir del material de negocio

Las tres imágenes entregadas por el usuario se tradujeron a contenido comercial, sin publicar los pósteres internos. Solución incorpora una nueva ilustración de equipos/herramientas, navegación por servicio, síntomas desplegables, método de revisión, explicación del presupuesto y preparación para la visita. Nosotros desarrolla propósito, coordinación del equipo, preparación, aprendizaje y crecimiento como intención futura. Contacto añade orientación, guía para escribir, próximos pasos y FAQ propias, manteniendo intacto el formulario. Inicio suma una síntesis del método enlazada a Solución.

Verificación de esta ampliación: 11 pruebas existentes de navegación, enlaces y contacto aprobadas; TypeScript y ESLint de los archivos modificados aprobados; compilación final con lint/tipos aprobada, 107 páginas. Páginas revisadas en escritorio y móvil, incluido 320 px sin desbordamiento. Acordeones y anclas comprobados; envío vacío detenido por validación con foco en el nombre, sin enviar datos. Revisión independiente de contenido y código sin bloqueos. La nueva imagen WebP pesa 109 kB y se identifica como ilustración en su texto alternativo; recurso y prompt en `docs/service-care-assets.md`.

## Activación pendiente del entorno

No se aplicaron cambios a una base remota. Docker no estaba disponible para ejecutar Supabase local, por lo que las tres migraciones nuevas y sus pruebas SQL requieren aplicación/verificación en el entorno de destino. También requieren configuración real el proveedor Google y el envío de emails. El sitio no se publicó ni se enviaron mensajes externos.

Vista final de producción iniciada en `http://localhost:3001` con `LYSTO_BUILD_DIR=.next-site-build`. La vista de desarrollo sigue en el puerto 3000 con `.next-site-dev`. Las salidas separadas evitan interferencias durante la compilación.
