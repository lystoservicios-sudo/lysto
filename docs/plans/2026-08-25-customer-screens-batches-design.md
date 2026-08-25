# Diseño de implementación por tandas de las pantallas Cliente

**Fecha:** 2026-08-25  
**Estado:** aprobado por el usuario

## Objetivo

Crear un prompt ejecutable que guíe la implementación real de las 14 pantallas del área Cliente usando el catálogo CMP existente. Todo el trabajo debe ocurrir dentro del área de contenido de `AppShell`, a la derecha del sidebar y debajo de `AppTopbar`, sin modificar la navegación global.

## Contexto de layout

El layout existente ya proporciona:

- `AppSidebar` a la izquierda;
- `AppTopbar` arriba;
- `<main id="main-content">` como área utilizable;
- un contenedor centrado de hasta `90rem`;
- padding responsive y fondo mediante tokens Lysto.

Las pantallas deben renderizar únicamente el contenido hijo de ese `main`. Queda prohibido recrear logos, menús, headers globales, sidebars o wrappers de viewport.

## Estrategia elegida

La implementación se divide en tandas secuenciales. Cada tanda reutiliza componentes del catálogo `prompts/03-ui-component-generator.md`, incorpora estados de carga/vacío/error y debe cerrar con pruebas, typecheck y revisión visual antes de continuar.

Se descartó una ejecución única porque las 14 rutas y sus estados producirían un cambio demasiado grande para revisar. También se descartó implementar ruta por ruta sin base compartida porque duplicaría tarjetas, banners y estados.

## Tandas

### Tanda 0: base compartida

- auditar componentes existentes;
- consolidar primitives y componentes Cliente necesarios;
- definir view models y fixtures separados;
- crear estados loading, empty y error;
- asegurar que ninguna pantalla modifique `AppShell`.

### Tanda 1: panel, perfil y direcciones

- `/app`;
- `/app/perfil`;
- `/app/direcciones`.

Prioriza el resumen del cliente, servicio activo, equipos, accesos rápidos y formularios. Las acciones sin persistencia real deben informar el estado y no fingir éxito.

### Tanda 2: solicitud y solicitudes

- `/app/solicitar/aire-acondicionado`;
- `/app/solicitudes`;
- `/app/solicitudes/[id]`.

Reutiliza el wizard actual, componentes de diagnóstico, multimedia, presupuesto y matching. Las etapas visuales pueden funcionar localmente, pero no deben simular que una solicitud fue guardada o pagada.

### Tanda 3: trabajos y calificación

- `/app/trabajos`;
- `/app/trabajos/[id]`;
- `/app/trabajos/[id]/review`.

Incluye listados, seguimiento, técnico asignado, etapas, comparación de diagnóstico, aprobación y review. Los botones deben emitir callbacks o mostrar estados pendientes, nunca confirmar mutaciones inexistentes.

### Tanda 4: equipos y mantenimiento

- `/app/equipos`;
- `/app/equipos/[id]`;
- `/app/mantenimientos`.

Incluye inventario, ficha técnica, historial, próximos mantenimientos y estados sin datos.

### Tanda 5: garantías

- `/app/garantias`.

Incluye garantía, reclamos, seguimiento de calidad y estados sin casos. Un reclamo nuevo no debe registrarse si el backend todavía no existe.

### Tanda 6: pagos diferidos

- `/app/pagos`;
- paso de pago del wizard;
- CTAs de comprobante, devolución o reserva presentes en otras pantallas.

La pantalla y los espacios de pago permanecen visibles para no perder el alcance, pero usan un componente central `PaymentDeferredPanel` o equivalente. Debe explicar que Mercado Pago se conectará en la etapa final, mostrar acciones deshabilitadas y no generar IDs, pagos aprobados, preferencias, webhooks o movimientos falsos.

## Política de Mercado Pago diferido

1. No eliminar rutas ni secciones financieras.
2. No usar botones que aparenten cobrar.
3. No mostrar confirmaciones de pago real con datos mock sin una etiqueta explícita de demo.
4. Centralizar el placeholder para reemplazarlo una sola vez.
5. Documentar todos los puntos de integración pendientes.
6. Mantener intactos contratos y lógica existente de pagos salvo correcciones necesarias para compilar.
7. No importar todavía la pasarela del otro proyecto.

## Componentes CMP prioritarios

- Base: CMP-001 a CMP-018.
- Secciones: CMP-019 a CMP-028.
- Seguimiento: CMP-040 a CMP-045.
- Cliente: CMP-054 a CMP-062.
- Wizard: CMP-063 a CMP-072.
- Confianza/soporte: CMP-073 a CMP-080.

Los componentes ya existentes deben extenderse antes de crear duplicados.

## Datos y estados

Las pantallas pueden usar fixtures de demostración únicamente si están aislados y etiquetados. Los componentes productivos reciben props tipadas. No se deben convertir mocks en supuesta persistencia.

Cada ruta con datos debe contemplar:

- loading;
- empty;
- error recuperable;
- datos disponibles;
- permisos o feature diferida cuando corresponda.

## Verificación por tanda

Cada tanda debe:

1. ejecutar pruebas relevantes;
2. ejecutar typecheck;
3. ejecutar lint sobre archivos tocados;
4. revisar 320 px, 768 px y desktop;
5. comprobar teclado y focus-visible;
6. informar archivos, resultados y pendientes;
7. detenerse para revisión antes de comenzar la siguiente.

## Criterio de finalización

Las 14 rutas quedan visualmente completas, responsive y construidas con componentes reutilizables dentro del contenido de `AppShell`. Las funciones no conectadas se presentan honestamente como pendientes. Pagos conserva su lugar visual y documental, pero queda inactivo hasta integrar Mercado Pago al final.

