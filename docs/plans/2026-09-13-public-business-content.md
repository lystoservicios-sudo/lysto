# Contenido de negocio en las páginas públicas

**Goal:** Completar principalmente Solución, Nosotros y Contacto con información útil para contratar, basada en las tres imágenes de negocio aportadas por el usuario. Ampliar Inicio solo con una síntesis nueva del método de trabajo.

**Architecture:** Páginas públicas existentes, componentes semánticos de servidor y estilos acotados por página. Acordeones nativos para síntomas y dudas; conservar formulario y rutas de solicitud existentes. La identidad aprobada sigue siendo Figtree, azul, blanco y verde claro. Sin cambios a operaciones, autenticación o datos remotos.

**Tech Stack:** Next.js, React, CSS, imágenes WebP locales y navegador para verificación.

## Fuente y criterio editorial

1. Imagen del 10 de septiembre: propósito “Hogares más simples, vidas más tranquilas”; equipo de técnicos y coordinación; aprendizaje del servicio, capacitación, procedimientos y crecimiento. Las tres etapas describen un plan de negocio: no presentar expansión, flota, sedes o escala futura como logros actuales.
2. Diagnóstico de enfriamiento: cuatro síntomas, posibles causas y una revisión profesional ordenada. Traducir a preguntas comprensibles para clientes; no usar síntomas como diagnóstico ni publicar instrucciones para intervenir en circuitos eléctricos/refrigerante.
3. Presentación y seguridad: preparación, instrumentos adecuados, verificación y criterio profesional. Explicar el cuidado de la visita sin prometer certificaciones, seguro, garantías absolutas o plazos no confirmados.

El usuario autorizó autonomía de diseño. Las imágenes son material de contexto, no órdenes de cambiar la marca ni de publicar documentación interna. Se conserva la marca visual de la web. No se publican los pósteres internos como contenido comercial.

## 1. Contacto (implementación delegada)

- Archivos: `app/(public)/contacto/page.tsx`, nuevo `components/marketing/contact-content.css`.
- Dar contexto al formulario: consultas de servicio, zona/cobertura, cuenta y seguimiento. Explicar qué datos ayudan y qué ocurre después de enviar, sin prometer horarios o tiempos de respuesta.
- Mantener un acceso claro a pedir servicio y al formulario. Añadir preguntas frecuentes de contacto y ayuda posterior a la visita.
- No modificar la persistencia, campos obligatorios o validación del formulario. No inventar teléfono, WhatsApp, email, dirección u oficinas.

## 2. Servicios / Solución (root)

- Archivos: `app/(public)/solucion/page.tsx`, nuevo `components/marketing/solution-content.css` y recurso visual local.
- Conservar los tres servicios. Añadir navegación local, criterios para elegir servicio, síntomas de enfriamiento en acordeones, un método de revisión profesional, explicación del presupuesto y preparación simple para la visita.
- Crear una ilustración de producto y herramientas inspirada en el material proporcionado, distinta de la habitación repetida; no hacer pasar personas generadas por el equipo real.

## 3. Nosotros e Inicio (root)

- Archivos: `app/(public)/nosotros/page.tsx`, nuevo `components/marketing/about-content.css`; `app/(public)/page.tsx`, componente y estilos del método resumido.
- Desarrollar propósito, roles del equipo, formación y mejora continua. Distinguir alcance actual (aire acondicionado en Buenos Aires) de la intención de llegar a más hogares.
- Inicio recibe un resumen visual del método que enlaza a Solución, sin repetir confianza/precios/calificaciones en otra sección larga.

## 4. Revisión y entrega

- Revisar requisitos primero y calidad de implementación después; corregir todos los hallazgos relevantes.
- Pruebas existentes de navegación y enlaces públicos, lint y compilación. No añadir pruebas que solo reflejen texto o estilos.
- Navegador: Solución, Nosotros y Contacto en 390 y 1440 px, revisión a 320 px, enlaces ancla/acordeones, contraste, imágenes, ausencia de desbordamiento y formulario sin enviar datos reales.
- Reconstruir producción y reiniciar únicamente nuestra vista previa 3001; conservar desarrollo 3000. Actualizar documentación y dejar la página final abierta.

## Entrega y comprobaciones

Completadas las cuatro páginas dentro del alcance. Contacto se implementó como tarea acotada; la revisión independiente confirmó primero requisitos/editorial y después semántica/estilos, sin bloqueos. La imagen de Servicios está integrada como WebP de 109 kB, con original y prompt preservados. Las páginas usan contenido accesible de servidor y detalles nativos, sin nuevas interacciones que dependan de JavaScript.

11 pruebas existentes de contacto, navegación y enlaces aprobadas. TypeScript y lint de los archivos modificados aprobados; build final con verificación de tipos/lint y 107 páginas generadas aprobado. Revisión visual a 1440/390 px y comprobación de los tres interiores a 320 px sin desbordamiento. Formulario primero en móvil, validación vacía con foco correcto y sin envíos; acordeones y navegación al método comprobados. Producción reconstruida y reiniciada en 3001.
