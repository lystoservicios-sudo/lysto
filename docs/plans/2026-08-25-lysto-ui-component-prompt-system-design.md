# Sistema de prompts para componentes UI de Lysto

**Fecha:** 2026-08-25  
**Estado:** aprobado por el usuario

## Objetivo

Crear un prompt maestro y un catálogo exhaustivo de prompts para generar componentes reales de Lysto con React, Next.js, TypeScript y Tailwind. El catálogo debe cubrir todos los patrones visibles en las 19 referencias entregadas, sin generar ni modificar barras superiores, sidebars o navegación global.

## Enfoque aprobado

El sistema se divide en tres capas:

1. **Contrato maestro:** fija stack, identidad visual, accesibilidad, responsive, reutilización, formato de entrega y prohibiciones.
2. **Prompts de componentes:** generan piezas base y componentes funcionales tipados, reutilizables y probados.
3. **Prompts de composición:** uno por referencia, describen cómo ensamblar componentes existentes para construir la pantalla sin duplicar código.

Esta estructura reemplaza dos alternativas descartadas:

- un megaprompt monolítico, difícil de mantener y propenso a inconsistencias;
- prompts que generan pantallas completas sin registro previo de componentes, que duplican estructuras.

## Intención de diseño

### Persona y contexto

Lysto atiende tres actores: clientes que necesitan tranquilidad y claridad, profesionales que operan servicios desde el teléfono o escritorio, y administradores que supervisan la operación. Las interfaces deben priorizar el próximo paso, el estado actual y la confianza.

### Dominio

- cuidado del hogar;
- climatización y mantenimiento;
- diagnóstico y evidencia técnica;
- técnicos verificados;
- agenda y disponibilidad;
- seguimiento del servicio;
- pago protegido;
- garantía y respaldo;
- capacitación y crecimiento profesional.

### Mundo de color

- azul Lysto para acciones y continuidad;
- azul hielo para información y contexto;
- tinta azul oscuro para jerarquía;
- verde servicio para éxito, verificación y resolución;
- ámbar mantenimiento para atención y próximos pasos;
- violeta beneficio para recompensas y desarrollo;
- blancos y grises azulados para superficies silenciosas.

### Firma del producto

La firma es el patrón **Estado → contexto → próximo paso → acción → respaldo Lysto**. Debe aparecer en tarjetas de trabajo, solicitudes, pagos, garantías, agenda y seguimiento. El producto no usa color como decoración: el color indica acción, estado, confianza o advertencia.

### Defaults rechazados

- tarjetas KPI genéricas → métricas con significado operativo y acción;
- dashboards basados solo en grillas → composiciones derivadas del flujo del actor;
- iconos decorativos → iconos que explican estado o acción;
- componentes con datos fijos → APIs tipadas y ejemplos separados;
- duplicación mobile/desktop → un componente responsive con variantes.

## Arquitectura del catálogo

### Capa 1: componentes base

El catálogo incluye prompts para primitives como `IconHalo`, `StatusBadge`, `TrustBadge`, `MetricValue`, `MoneyValue`, `ProgressBar`, `WizardProgress`, `SegmentedTabs`, `CountTabs`, `DateFilter`, `UserAvatar`, `EquipmentThumbnail`, `MediaGallery`, `ActionGroup`, `InfoNotice`, `EmptyState`, `LoadingSkeleton` y `ErrorState`.

### Capa 2: componentes funcionales

Incluye encabezados y ayudas; agenda; solicitudes y trabajos; operación profesional; experiencia del cliente; pagos; garantías; equipos; capacitación; soporte; y pasos del wizard. Se espera un catálogo de aproximadamente 55 componentes totales entre las capas 1 y 2.

### Capa 3: composiciones

Se incluye un prompt de composición para cada referencia:

1. agenda profesional;
2. centro de soporte;
3. pagos profesionales;
4. capacitación;
5. solicitudes asignadas;
6. trabajos profesionales;
7. mantenimientos recomendados;
8. dashboard profesional;
9. dashboard cliente;
10. seguimiento detallado;
11. equipos e historial;
12. pagos y movimientos;
13. garantías y calidad;
14. técnico confirmado;
15. inicio móvil y selección de servicio;
16. matching;
17. presupuesto preliminar;
18. diagnóstico y multimedia;
19. selección del problema.

Cada composición debe enumerar los componentes que utiliza. Si falta una pieza, debe detenerse y proponerla para el registro antes de crearla.

## Contrato técnico de los prompts

Cada prompt de componente debe ordenar:

- inspeccionar y reutilizar los componentes existentes antes de crear uno;
- usar React, Next.js App Router, TypeScript estricto y Tailwind;
- usar `@/components/ui`, `cn` y Lucide cuando corresponda;
- declarar props, callbacks, variantes y tipos exportados;
- evitar mocks o registros comerciales dentro del componente productivo;
- separar el ejemplo de uso de la implementación;
- cubrir default, hover, active, focus-visible, disabled y estados de datos relevantes;
- ser mobile-first y adaptar densidad, grilla y acciones a escritorio;
- mantener objetivos táctiles de al menos 44 px;
- incluir semántica, teclado, ARIA y contraste;
- agregar pruebas con Vitest y Testing Library;
- no consultar Supabase ni proveedores externos desde componentes presentacionales;
- no crear ni modificar navegación superior, sidebar, `AppShell` o configuración de rutas.

## Flujo de uso

1. Ejecutar el prompt maestro con contexto del repositorio.
2. Elegir un prompt de componente del catálogo.
3. Generar implementación, prueba y ejemplo.
4. Registrar el componente creado para que las composiciones lo reutilicen.
5. Ejecutar el prompt de composición de una pantalla.
6. Validar cobertura contra la matriz de la referencia.

## Errores y prevención de duplicados

El agente debe detenerse si encuentra:

- un componente equivalente con nombre diferente;
- una dependencia visual no registrada;
- props insuficientes para representar estados reales;
- una solicitud que implicaría modificar la navegación global;
- valores de negocio hardcodeados que deberían llegar por props;
- una composición sin estados loading, vacío o error cuando maneja datos.

En esos casos debe informar la colisión o ausencia, proponer una API única y esperar confirmación antes de ampliar el catálogo.

## Verificación

El entregable final debe poder validarse mediante:

- conteo de las 19 composiciones;
- matriz referencia → secciones → componentes;
- presencia de contrato técnico en todos los prompts;
- ausencia de instrucciones para generar navegación;
- revisión de que cada patrón visible tenga un componente asignado;
- enlaces o nombres exactos de componentes existentes que deben reutilizarse.

## Entregables

- `prompts/03-ui-component-generator.md`: prompt maestro, catálogo y composiciones.
- `docs/plans/2026-08-25-lysto-ui-component-prompt-system.md`: plan de implementación y verificación.

