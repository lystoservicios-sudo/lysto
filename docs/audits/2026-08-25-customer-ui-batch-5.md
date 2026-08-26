# Auditoría UI Cliente — Tanda 5

**Fecha:** 2026-08-25

**Alcance:** CUS-11

**Estado:** checkpoint listo para revisión

## Ruta implementada

| ID | Ruta | Resultado |
|---|---|---|
| CUS-11 | `/app/garantias` | Centro de respaldo con beneficios, coberturas, reclamos, seguimiento de calidad y reconocimiento profesional. |

La ruta permanece dentro del área de contenido de `AppShell`. El sidebar es la única navegación de rutas; no se modificaron el shell, la barra superior ni la configuración de navegación.

## Decisiones de producto

- La pantalla se organiza como una cadena de respaldo: servicio, cobertura, caso, seguimiento y resolución.
- Coberturas, reclamos y calidad se separan mediante tabs con conteos para no mezclar conceptos distintos.
- La garantía activa se vincula por IDs estables al equipo y al trabajo finalizado.
- Cada cobertura o reclamo ofrece acceso al detalle del servicio finalizado que lo respalda.
- El reclamo muestra únicamente descripción segura, estado, próximo paso y una cronología comprensible.
- El timeline combina icono, texto y posición; no depende solamente del color.
- El seguimiento de calidad no expone notas administrativas privadas.
- El reconocimiento profesional se identifica como demostración y no inventa una verificación.
- El reconocimiento etiqueta calificación, aceptación y cantidad de servicios.
- “Informar un problema” permanece deshabilitado hasta que exista persistencia real. No se abre un modal ni se confirma un reclamo ficticio.
- “Contactar a calidad” refleja el estado diferido y permanece deshabilitado sin un canal conectado.

## Accesibilidad

- Tabs con `tablist`, `tab`, `tabpanel`, `aria-selected`, foco roving y navegación con flechas/Home/End.
- Timeline como lista ordenada, con `aria-current="step"` en la etapa en curso.
- Estados de etapa visibles como texto además de icono y color.
- Fechas con elemento `time` cuando corresponden a eventos reales.
- CTA diferido usa el estado nativo `disabled` y explicación visible.
- Loading, empty y error recuperable tienen mensajes específicos.
- El drawer móvil del shell continúa siendo la única navegación de rutas.

## Verificación visual

Se probaron los tabs Coberturas, Reclamos y Calidad en 320, 375, 768, 1024 y 1440 px: 15 combinaciones. En todas, el ancho visible y el ancho desplazable coinciden; no existe desborde horizontal.

También se verificó en navegador real:

- cambio de tabs con mouse y flecha de teclado;
- cobertura activa vinculada a un servicio finalizado;
- reclamo abierto con tres etapas legibles;
- seguimiento de calidad y reconocimiento de demostración;
- CTA de nuevo reclamo realmente deshabilitado;
- sidebar de escritorio y barra móvil sin navegación horizontal duplicada.

La consola de la aplicación no mostró errores de React. El entorno de desarrollo sólo solicitó un `favicon.ico` inexistente; queda fuera del alcance funcional de esta tanda.

## Datos y límites

- La vista consume `customerDemoFixtures`, identificadas explícitamente como demostración.
- La ruta ya no importa `@/lib/mock/lysto-data`.
- Los componentes productivos reciben props tipadas y no consultan APIs ni Supabase.
- No se registran reclamos, cambios de estado, contactos ni reconocimientos desde la interfaz.
- No se muestran notas privadas, decisiones administrativas ni datos sensibles.
- Esta tanda no agrega puntos financieros ni modifica la política de Mercado Pago diferido.

## Pendiente de integración

1. Consulta autenticada de garantías, reclamos y seguimientos por cliente.
2. Alta idempotente de reclamo, validada contra equipo, trabajo y vigencia.
3. Timeline alimentado por eventos persistidos de calidad.
4. Canal seguro para contacto y solicitud de evidencia adicional.
5. Reconocimientos y métricas provenientes de datos confirmados.
6. Estados loading, empty y error conectados a la capa de datos real.
