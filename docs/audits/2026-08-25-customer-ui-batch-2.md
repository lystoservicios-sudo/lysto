# Auditoría UI Cliente — Tanda 2

**Fecha:** 2026-08-25

**Alcance:** solicitud de servicio, listado y detalle de solicitudes

**Rama:** `codex/customer-screens-batch-0`

## Rutas completadas

- CUS-02 `/app/solicitar/aire-acondicionado`
- CUS-03 `/app/solicitudes`
- CUS-04 `/app/solicitudes/[id]`

## Dirección de interfaz

- **Intención:** ayudar a una persona con un problema doméstico a preparar un parte técnico claro, entender la orientación preliminar y reconocer qué falta antes de una visita.
- **Paleta:** azul de servicio para selección y progreso, grafito para jerarquía, blanco/gris azulado para superficies, ámbar para pendientes y verde solo para garantías o confirmaciones reales.
- **Profundidad:** bordes suaves y cambios de superficie; sin sombras decorativas en el flujo principal.
- **Tipografía:** jerarquía existente de Lysto, con cifras tabulares para importes.
- **Espaciado:** base de 4 px y controles táctiles de al menos 44 px.
- **Firma:** “parte en preparación” que acumula problema, dirección, horario, evidencia y presupuesto sin fingir envío o cobro.

## Correcciones funcionales

- El wizard pasó de diez etapas —incluyendo estados futuros simulados— a siete etapas reales: problema, detalles, diagnóstico, dirección, horario, presupuesto y pago.
- El flujo se detiene en `PaymentDeferredPanel`; no permite avanzar a matching, técnico confirmado ni trabajo creado.
- El CTA de Mercado Pago permanece visible y deshabilitado.
- Los archivos se seleccionan y previsualizan localmente, validan tipo/tamaño, pueden eliminarse y no muestran una subida completada.
- El listado usa filtros controlados para todas, borradores y solicitudes que requieren atención.
- El detalle resuelve el ID real de la ruta y devuelve un estado not-found cuando no existe.
- Las tres rutas dejaron de importar `lib/mock/lysto-data` y usan fixtures Cliente aislados y rotulados como demostración.

## Componentes creados

- `PaymentDeferredPanel`
- `MediaUploader` y previews locales
- `PreliminaryDiagnosisPanel`
- `CustomerRequestSummaryCard`
- `CustomerRequestList`
- `CustomerRequestDetail`

## Componentes extendidos

- `AirConditioningWizard`
- `ProgressStepper`, ahora con semántica `progressbar`, valores ARIA y reduced motion.
- Fixtures Cliente con un borrador demo adicional, sin movimientos financieros.

## Estados y accesibilidad

- Listado: loading, ready, empty y error recuperable.
- Detalle: loading/error heredados del segmento y not-found específico.
- Opciones tipo radio con selección controlada y navegación por flechas, Home y End.
- Progreso con nombre accesible, valor actual y texto del paso.
- Carga de archivos con label, error anunciado, botones de eliminación específicos y revocación de object URLs.
- Pago diferido con explicación textual independiente del color.

## Validación visual

- Las tres rutas se revisaron en 320, 375, 768, 1024 y 1440 px.
- `body.scrollWidth` coincide con `body.clientWidth` en las 15 combinaciones.
- Filtros móviles usan desplazamiento horizontal contenido; no generan scroll del documento.
- Se recorrió el wizard completo y el paso final reportó `Paso 7 de 7: Pago`.
- Se verificó una selección real de archivo local con preview y sin claim de subida.
- No se encontraron errores de consola de aplicación.

## Mercado Pago diferido

- No se crearon preferencias, IDs, webhooks, cobros, aprobaciones ni movimientos.
- El importe se presenta únicamente como presupuesto preliminar.
- `docs/integrations/mercadopago-ui-touchpoints.md` registra los consumidores actuales y contratos futuros.

## Pendientes

- Persistencia real de la solicitud y archivos.
- Disponibilidad real de agenda.
- Integración final de Mercado Pago.
- Matching, asignación y creación de trabajo basados en confirmaciones persistidas.
