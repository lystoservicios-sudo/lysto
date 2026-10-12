# Reestructuración de la navegación cliente

## Objetivo

Actualizar únicamente la navegación inferior del área cliente para que represente mejor las tareas principales del usuario, sin rediseñar todavía las pantallas ni modificar su lógica.

La nueva navegación será:

1. Inicio
2. Servicios
3. Pedir
4. Hogar
5. Más

## Alcance

Incluido:

- Cambio de etiquetas, iconos y destinos del menú inferior.
- Agrupación semántica de rutas existentes para determinar el estado activo.
- Conservación de Pedir como acción central destacada.
- Nueva ruta `/app/mas` con un placeholder mínimo.
- Registro de `/app/mas` en el contrato de pantallas cliente.
- Conservación de todas las rutas y funciones existentes.

Fuera de alcance:

- Rediseño de Inicio, Servicios, Hogar o Más.
- Unión real de datos de Hogar y Equipos.
- Construcción del centro definitivo de Más.
- Migración o eliminación de rutas existentes.
- Cambios en APIs, autenticación, pagos, base de datos o lógica de negocio.

## Modelo de navegación

| Posición | Etiqueta | Ruta principal | Significado |
| --- | --- | --- | --- |
| 1 | Inicio | `/app` | Resumen y próximos pasos |
| 2 | Servicios | `/app/trabajos` | Servicios programados, activos y completados |
| 3 | Pedir | `/app/solicitar/aire-acondicionado` | Inicio de una nueva solicitud |
| 4 | Hogar | `/app/hogar` | Lugares y equipos del cliente |
| 5 | Más | `/app/mas` | Accesos secundarios y configuración |

## Familias de rutas activas

El estado activo no dependerá solamente de que la URL comience con el destino principal. Cada sección tendrá una familia explícita de rutas.

### Inicio

Activo únicamente en:

- `/app`

### Servicios

Activo en:

- `/app/trabajos`
- `/app/trabajos/*`
- `/app/solicitudes`
- `/app/solicitudes/*`
- `/app/presupuestos`

Estas rutas representan distintas etapas del mismo recorrido de servicio. No se moverán ni renombrarán en esta etapa.

### Pedir

Destino:

- `/app/solicitar/aire-acondicionado`

Mantiene su botón circular azul y su tratamiento protagonista. El flujo de solicitud continuará pudiendo ocultar la navegación inferior.

### Hogar

Activo en:

- `/app/hogar`
- `/app/equipos`
- `/app/equipos/*`

La ruta `/app/hogar` seguirá siendo temporal hasta que se diseñe la pantalla que combinará lugares y equipos. `/app/equipos` permanecerá disponible como subpantalla especializada.

### Más

Activo en:

- `/app/mas`
- `/app/perfil`
- `/app/pagos`
- `/app/pagos/*`
- `/app/garantias`
- `/app/direcciones`
- `/app/mantenimientos`

`/app/mas` será la futura puerta de entrada a funciones secundarias. Las pantallas existentes continuarán en sus rutas actuales.

## Iconografía

- Inicio: grilla o tablero simple.
- Servicios: herramienta, historial de servicio o portapapeles técnico; debe comunicar servicios realizados y en curso, no administración.
- Pedir: signo `+` dentro del botón circular azul existente.
- Hogar: casa.
- Más: tres puntos horizontales; no utilizar perfil o usuario, porque la sección será más amplia que la cuenta personal.

Se utilizará el mismo conjunto Lucide ya instalado.

## Estado activo

- Icono y etiqueta en azul Lysto.
- Icono y etiqueta en gris azulado cuando están inactivos.
- `aria-current="page"` en el destino semánticamente activo.
- Sin fondos grandes ni animaciones adicionales.
- Pedir conserva siempre su estilo destacado, independientemente de la ruta activa.

Cuando una ruta pertenece a una familia, solo una pestaña debe quedar activa.

## Ruta Más

Se creará `/app/mas` como placeholder mínimo. Solo debe indicar el nombre de la sección y que allí se reunirán los accesos secundarios. No debe anticipar tarjetas, opciones, datos o funciones todavía no diseñadas.

## Componentes afectados

- `components/app-shell/client-navigation.ts`: definición de los cinco destinos y familias activas.
- `components/app-shell/client-nav-item.tsx`: soporte de la nueva iconografía si fuera necesario.
- `components/app-shell/client-bottom-navigation.tsx`: debe continuar renderizando cinco posiciones sin cambios estructurales.
- `app/(customer)/app/mas/page.tsx`: placeholder mínimo.
- `features/customer/screen-contract.ts`: registro de la nueva ruta.

No se modificará el App Shell general, la top bar ni el contenido de las páginas existentes.

## Verificación

- El menú muestra exactamente Inicio, Servicios, Pedir, Hogar y Más, en ese orden.
- Cada destino apunta a la ruta acordada.
- Servicios queda activo en trabajos, solicitudes y presupuestos.
- Hogar queda activo en hogar y equipos.
- Más queda activo en su ruta y en las rutas secundarias indicadas.
- Inicio no queda activo en todas las rutas `/app/*`.
- Pedir mantiene su apariencia y el flujo enfocado sigue ocultando la barra.
- `/app/mas` renderiza correctamente dentro del Client App Shell.
- No se modifican contenidos ni comportamientos de las pantallas existentes.
- La navegación conserva teclado, foco visible, áreas táctiles y comportamiento responsive.

## Criterio de finalización

La etapa estará completa cuando el menú inferior refleje la nueva arquitectura, las familias de rutas marquen correctamente la pestaña activa, `/app/mas` exista como placeholder y todos los tests de navegación y límites de páginas cliente pasen sin cambios funcionales en el resto del sistema.
