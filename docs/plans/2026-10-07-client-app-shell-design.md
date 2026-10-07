# Client App Shell para el área cliente

## Objetivo

Reemplazar el shell actual del área autenticada del cliente —basado en sidebar y topbar de dashboard— por una estructura mobile-first con comportamiento de aplicación nativa. Esta primera etapa cambia únicamente la infraestructura visual y de navegación. No modifica el contenido interno, la lógica de negocio ni las rutas existentes.

## Alcance

Incluido:

- Nuevo shell exclusivo para el rol Cliente.
- Top bar compacta.
- Navegación inferior con cinco posiciones.
- Acción central destacada para pedir un servicio.
- Capacidad de ocultar temporalmente la navegación inferior en flujos enfocados.
- Adaptación coherente a móvil, tablet y escritorio sin volver al sidebar.
- Nueva ruta `/app/hogar` con una pantalla placeholder mínima.
- Estados activos, interacción táctil, teclado, foco visible y safe areas.
- Conservación de todas las rutas y funciones actuales.

Fuera de alcance:

- Rediseño del contenido interno de las páginas.
- Reorganización definitiva de Presupuestos, Solicitudes, Trabajos, Pagos, Garantías o Mantenimientos.
- Implementación real de notificaciones.
- Creación del futuro centro de Cuenta.
- Cambios de negocio, datos, APIs, permisos o autenticación.

## Intención de diseño

La persona cliente normalmente abre Lysto con una necesidad concreta: pedir ayuda, conocer el estado de una visita o consultar el historial de su hogar. La interfaz debe sentirse tranquila, directa y confiable, incluso cuando existe una falla doméstica o una decisión pendiente.

Conceptos del dominio:

- hogar;
- visita técnica;
- equipo;
- solicitud;
- seguimiento;
- respaldo;
- confianza.

Mundo cromático:

- blanco y superficies casi blancas, como un hogar luminoso y cuidado;
- azul Lysto para identidad y acciones principales;
- navy para texto y confianza;
- grises azulados para navegación secundaria;
- colores semánticos reservados para estados reales.

El elemento distintivo será el botón elevado **Pedir**: una acción central, constante y reconocible que representa el inicio del servicio. Reemplaza el patrón genérico de sidebar y evita que la acción principal se pierda entre módulos administrativos.

## Arquitectura del shell

El área cliente utilizará tres zonas:

1. Top bar fija.
2. Área central con scroll independiente.
3. Bottom navigation fija cuando el contexto de la pantalla lo permita.

La estructura conceptual será:

```tsx
<ClientAppShell navigation="visible | hidden">
  {children}
</ClientAppShell>
```

El shell ocupará `100dvh`. La top bar y la navegación inferior respetarán `env(safe-area-inset-top)` y `env(safe-area-inset-bottom)`. El contenido central recibirá el espacio restante y no quedará cubierto por ninguna barra.

El control de visibilidad de la navegación inferior será parte de la arquitectura, no una excepción CSS. Las páginas principales la mostrarán. Flujos enfocados como solicitud, pago, confirmación o decisiones críticas podrán ocultarla de forma explícita sin duplicar el shell.

En esta etapa se definirá el mecanismo y se aplicará al flujo de solicitud como primer caso. Las demás decisiones de ocultamiento se podrán incorporar gradualmente durante el rediseño de cada flujo.

## Top bar

La top bar será compacta y tendrá:

- Logo de Lysto a la izquierda.
- Campana de notificaciones a la derecha, preparada para un badge futuro.
- Avatar a la derecha, enlazado inicialmente a `/app/perfil`.

No mostrará:

- nombre de usuario;
- texto “Espacio cliente”;
- cierre de sesión;
- breadcrumb;
- nombre de pantalla;
- eslogan.

La campana no inventará notificaciones ni abrirá una pantalla inexistente. Quedará como control preparado para integración futura, con semántica accesible coherente con su estado todavía no disponible.

## Navegación inferior

Tendrá cinco posiciones:

| Posición | Etiqueta | Ruta inicial | Función conceptual |
| --- | --- | --- | --- |
| 1 | Inicio | `/app` | Resumen y siguiente acción |
| 2 | Hogar | `/app/hogar` | Lugares, direcciones y contexto del hogar |
| 3 | Pedir | `/app/solicitar/aire-acondicionado` | Inicio de una solicitud de servicio |
| 4 | Equipos | `/app/equipos` | Equipos y electrodomésticos registrados |
| 5 | Cuenta | `/app/perfil` | Entrada futura a opciones secundarias |

Inicio usará un icono de grilla o tablero, no una casa. Hogar usará una casa. Equipos usará un símbolo de equipamiento doméstico. Cuenta usará un perfil.

La pestaña Cuenta enlazará inicialmente a `/app/perfil`, pero su componente, etiqueta y significado no quedarán acoplados a “Perfil”. Será la futura puerta de entrada a:

- datos personales;
- preferencias;
- pagos generales;
- garantías y reclamos;
- ayuda;
- direcciones;
- cierre de sesión;
- otras opciones secundarias.

### Acción Pedir

Pedir será un botón circular azul, elevado sobre la barra y con icono `+`. La etiqueta aparecerá debajo. Mantendrá su tratamiento protagonista aunque otra pestaña esté activa y no se presentará como una pestaña convencional.

### Estado activo

La ruta activa se indicará mediante icono y etiqueta azules. Los elementos inactivos usarán gris azulado oscuro. No habrá fondos grandes, indicadores decorativos excesivos ni animaciones llamativas.

Las rutas hijas activarán su sección cuando corresponda. Por ejemplo, `/app/equipos/:id` mantendrá activa la sección Equipos. La acción Pedir conservará su estilo constante; su estado actual podrá reforzarse accesiblemente sin cambiar la forma general del botón.

## Adaptación por tamaño

La experiencia se diseñará primero para 360, 390 y 430 píxeles de ancho.

- Móvil: shell a ancho completo y navegación inferior fija.
- Tablet: misma arquitectura, con contenido centrado y márgenes más amplios.
- Escritorio: misma navegación de app, sin sidebar; el contenido tendrá un ancho máximo cómodo y la barra inferior no se estirará indefinidamente.

No se simularán elementos del sistema operativo como hora, batería, señal o Wi-Fi.

## Superficies y profundidad

Se utilizará una estrategia de separación por bordes suaves y cambios mínimos de superficie. Las sombras serán muy discretas y estarán limitadas al botón elevado Pedir o a la separación necesaria de las barras fijas.

- Canvas: blanco o gris extremadamente claro.
- Top bar y bottom navigation: misma familia cromática que el canvas.
- Bordes: baja opacidad.
- Controles: estados de hover, active, focus-visible y disabled.
- Radio: moderado y consistente; el círculo de Pedir es la única forma completamente circular protagonista.

## Accesibilidad e interacción

- Objetivos táctiles mínimos de 44–48 px.
- Navegación completa por teclado.
- Foco visible con contraste suficiente.
- `aria-current="page"` para navegación activa.
- Nombres accesibles para campana, avatar y botón Pedir.
- Contraste WCAG AA.
- Respeto de `prefers-reduced-motion`.
- El contenido no dependerá de hover.
- Safe areas en dispositivos compatibles.

## Componentes previstos

La estructura preferida será:

```text
components/app-shell/
├── client-app-shell.tsx
├── client-top-bar.tsx
├── client-bottom-navigation.tsx
└── client-nav-item.tsx
```

Se reutilizarán componentes, iconos y utilidades existentes cuando encajen. El shell profesional y administrativo no se modificarán. El layout del grupo cliente será el punto de integración del nuevo shell.

## Página Hogar

Se creará `/app/hogar` como placeholder mínimo y funcional. Tendrá título y una explicación breve de que allí se reunirán los lugares y direcciones del cliente. No incorporará todavía tarjetas, datos ficticios ni nuevas funciones.

## Datos y errores

El shell no agregará solicitudes de datos. Continuará utilizando la identidad de sesión disponible para el avatar cuando corresponda. La navegación debe renderizar aunque la identidad no tenga foto; en ese caso mostrará un fallback neutral.

Los errores de las páginas seguirán siendo responsabilidad de sus límites actuales. El shell no ocultará errores ni alterará los estados de carga existentes.

## Verificación

La implementación deberá comprobar:

- renderizado del shell en todas las rutas cliente existentes;
- ausencia del sidebar y del menú hamburguesa para Cliente;
- conservación de los shells Profesional y Admin;
- rutas y estados activos de las cinco posiciones;
- ocultamiento explícito de la bottom navigation en el flujo de solicitud;
- funcionamiento de `/app/hogar`;
- contenido no cubierto por top bar o bottom navigation;
- viewports de 360, 390 y 430 px;
- adaptación de escritorio sin sidebar;
- navegación por teclado, foco visible y áreas táctiles;
- ausencia de desbordamiento horizontal;
- pruebas existentes relacionadas con sesión, layouts y navegación.

## Criterio de finalización de esta etapa

La etapa estará terminada cuando todas las páginas cliente existentes funcionen dentro del nuevo Client App Shell, la navegación inferior sea usable y accesible, `/app/hogar` exista, el flujo de solicitud pueda ocultar la barra inferior y no se haya modificado el contenido ni la lógica de negocio de las pantallas actuales.
