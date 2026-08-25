# Diseño del App Shell inspirado en KazeCommerce

**Fecha:** 2026-08-25  
**Estado:** Aprobado

## Objetivo

Reemplazar únicamente la base visual y estructural de las áreas autenticadas de Lysto por un App Shell inspirado en KazeCommerce. El resultado debe ofrecer sidebar, topbar, contenido, navegación y comportamiento responsive sólidos sin construir ni rediseñar todavía las pantallas de Administrador, Cliente o Profesional.

## Auditoría de Lysto

Lysto usa Next.js 15 con App Router, React 19, TypeScript, Tailwind CSS 3 y Lucide. Las tres áreas autenticadas ya comparten `components/layout/page-shell.tsx` mediante sus respectivos layouts:

- `app/(admin)/admin/layout.tsx`
- `app/(customer)/app/layout.tsx`
- `app/(professional)/pro/layout.tsx`

La navegación por rol está centralizada en `components/layout/app-navigation-config.ts`. Esta información seguirá funcionando como navegación temporal y no se considerará todavía la arquitectura definitiva del producto.

La lógica de dominio, rutas, Supabase, casos de uso y pantallas está separada del shell. No debe eliminarse. Existen además cambios locales sin confirmar en varias pantallas, estilos y componentes de layout; deben preservarse y no incluirse accidentalmente en commits de esta migración.

La implementación local de navegación fue modificada mientras sus tests siguen describiendo capacidades de accesibilidad de la versión anterior. El nuevo shell deberá recuperar y ampliar esas garantías en vez de adaptar los tests a un comportamiento inferior.

## Auditoría de KazeCommerce

La estructura reutilizable de KazeCommerce se compone de:

- `src/app/dashboard/layout.tsx`: une provider, sidebar, topbar y contenido principal.
- `src/components/ui/sidebar.tsx`: administra estado expandido/colapsado, cookie, atajo de teclado, sidebar mobile y primitivas estructurales.
- `src/components/ui/app-sidebar/*`: separa marca, navegación, grupos y pie.
- `src/components/ui/app-topbar.tsx`: implementa la barra superior responsive.

No deben copiarse los acoplamientos de KazeCommerce: autenticación Clerk, tenant activo, perfil comercial, selector y enlace de tienda, conteos de pedidos, rutas ecommerce, acciones de usuario ni logos propios.

Tampoco se trasladará literalmente su primitiva de sidebar. Depende de Tailwind CSS 4, shadcn, varias primitivas Radix, `class-variance-authority`, tooltips, sheets y componentes auxiliares ausentes en Lysto. Incorporar toda esa infraestructura sería desproporcionado para el alcance actual.

## Enfoque elegido

Implementar una versión pequeña y nativa de Lysto que reproduzca la arquitectura y la experiencia relevante de KazeCommerce con las dependencias existentes: React, Next.js, Tailwind CSS 3 y Lucide.

No habrá imports cruzados ni dependencias en tiempo de ejecución respecto de KazeCommerce. Ese repositorio permanecerá estrictamente de solo lectura.

## Arquitectura

`AppShell` seguirá siendo la única entrada de los tres layouts autenticados. Internamente compondrá:

1. Un provider cliente responsable del estado del sidebar.
2. Un sidebar estructural con cabecera, navegación por rol y pie neutro.
3. Una topbar con disparador del sidebar y contexto del rol actual.
4. Un área principal flexible y sin desbordes, con espaciado uniforme y un contenedor preparado para futuras pantallas.

La configuración de navegación conservará las rutas actuales de cada rol. Los componentes visuales consumirán datos normalizados y no contendrán decisiones de negocio específicas de cada experiencia.

## Comportamiento del sidebar

En escritorio, el sidebar tendrá aproximadamente 16 rem expandido y se reducirá a una columna de iconos. El estado se conservará en la cookie `sidebar_state`. El disparador estará disponible en la topbar y se ofrecerá el atajo `Ctrl/Cmd + B`.

En mobile, el mismo disparador abrirá un drawer modal. El drawer:

- bloqueará el scroll del documento;
- se cerrará con Escape, backdrop, control explícito o selección de destino;
- moverá el foco a su control de cierre;
- restaurará el foco al disparador;
- expondrá nombre, estado abierto y semántica de diálogo a tecnologías de asistencia;
- respetará áreas seguras y preferencia de movimiento reducido.

## Topbar y contenido

La topbar será sticky, medirá aproximadamente 64 px y mostrará únicamente información estructural real: control del sidebar, identidad de Lysto y contexto del rol. No se agregarán notificaciones, logout, avatar o acciones comerciales ficticias.

El contenido usará `min-width: 0`, separación horizontal responsive y un ancho máximo amplio y consistente. Las pantallas actuales seguirán renderizándose sin cambios funcionales dentro de esta nueva superficie.

## Estilos

Se introducirán tokens CSS mínimos para fondo, superficie, texto, borde, acento y sidebar, integrados con la configuración actual de Tailwind 3. La base será neutra, con azul reservado para estado activo y acciones principales.

La limpieza eliminará únicamente reglas y estructuras del shell anterior que hayan quedado sin consumidores. Los estilos públicos y los componentes funcionales existentes se conservarán.

## Errores y degradación

El shell no dependerá de red ni de datos asíncronos. Un rol no reconocido quedará impedido por TypeScript. La navegación usará rutas configuradas y mantendrá estados activos para rutas descendientes. El estado persistido inválido se tratará con valores por defecto seguros.

## Verificación

La implementación seguirá TDD. Se cubrirán:

- navegación según rol y ruta activa;
- colapso y expansión de escritorio;
- persistencia del estado;
- apertura y cierre mobile;
- Escape, backdrop, bloqueo de scroll y restauración de foco;
- etiquetas y atributos accesibles;
- ausencia de navegación ecommerce;
- geometría responsive básica en navegador.

El cierre incluirá lint, typecheck, tests unitarios, build de producción y pruebas visuales en desktop y mobile. Finalmente se comparará el estado de Git de KazeCommerce con la línea base auditada para demostrar que no se modificó ningún archivo rastreado.

## Fuera de alcance

- Rediseñar o completar dashboards de negocio.
- Crear pantallas, formularios, tablas, métricas o flujos por rol.
- Definir la navegación definitiva.
- Implementar autenticación, notificaciones, logout o perfiles nuevos.
- Incorporar dark mode o el sistema completo de componentes de KazeCommerce.
- Cambiar lógica de dominio, Supabase, APIs o rutas funcionales.
