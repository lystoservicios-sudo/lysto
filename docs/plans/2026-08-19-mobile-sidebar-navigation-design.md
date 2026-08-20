# Navegación lateral móvil de Lysto

## Problema

La navegación autenticada muestra todas las secciones como una fila horizontal de etiquetas. En un celular las opciones quedan cortadas, no existe una señal clara de que la fila se desplaza y la pantalla pierde espacio vertical sin ofrecer una navegación cómoda.

## Diseño aprobado

En pantallas menores a `lg`, Lysto reemplaza la fila horizontal por un botón `Menú` en la barra superior. El botón abre un panel lateral desde la izquierda. El panel ocupa casi todo el alto y un ancho máximo cómodo, mientras un fondo atenuado separa la navegación del contenido.

El panel contiene:

- identidad Lysto y rol activo;
- botón visible para cerrar;
- todas las secciones disponibles para el rol;
- iconos consistentes y áreas táctiles de al menos 44 px;
- indicador completo de la sección activa mediante fondo, color e `aria-current`;
- cierre al elegir una opción, pulsar el fondo o presionar `Escape`.

Al cerrar, el foco vuelve al botón que abrió el menú. Mientras está abierto se bloquea el scroll del documento. El panel respeta `safe-area-inset-*` y no crea desbordamiento horizontal.

En escritorio se conserva la navegación horizontal, incorporando el mismo estado activo para mantener consistencia.

## Dirección visual

Lysto opera solicitudes, recorridos, técnicos, trabajos y pagos. La navegación toma referencias de un tablero de despacho: azul de uniforme para acción y selección; tinta azul marino para lectura; blanco de formularios de trabajo; gris asfalto para estructura; verde verificación y ámbar únicamente para estados.

La firma del componente es una lista de rutas operativas con iconos específicos y un estado activo azul de superficie completa. Se evitan las etiquetas horizontales recortadas, el menú hamburguesa sin contexto y una barra inferior con capacidad insuficiente para los ocho destinos administrativos.

## Componentes y responsabilidades

- `app-navigation-config.ts`: única fuente de etiquetas, rutas e iconos por rol.
- `app-navigation.tsx`: navegación de escritorio, disparador móvil, panel lateral y comportamiento accesible.
- `page-shell.tsx`: estructura general y montaje de la navegación.

## Verificación

- prueba unitaria del ciclo abrir/cerrar, `Escape`, rutas por rol y estado activo;
- lint, tipos, pruebas unitarias y build;
- prueba visual a 390 × 844 px, con menú cerrado y abierto;
- comprobación de que la página no tenga desbordamiento horizontal.
