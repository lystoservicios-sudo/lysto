# Auditoría UI Cliente — Tanda 1

**Fecha:** 2026-08-25

**Alcance:** panel, perfil, direcciones y corrección del shell Cliente

**Rama:** `codex/customer-screens-batch-0`

## Rutas completadas

- CUS-01 `/app`
- CUS-13 `/app/perfil`
- CUS-14 `/app/direcciones`

## Decisiones de interfaz

- El panel prioriza saludo, acciones primarias, métricas, servicio activo, equipos, accesos rápidos y soporte.
- Perfil y direcciones usan formularios tipados con estados pristine, dirty e invalid.
- Guardar permanece deshabilitado mientras no exista persistencia real; no se muestran confirmaciones falsas.
- Los datos de ejemplo están rotulados como demostración y aislados de `lib/mock`.
- El chat se presenta únicamente como integración no disponible.

## Corrección del layout global

Durante la validación visual se detectó que `PageShell` todavía montaba el encabezado horizontal legado. Por instrucción explícita del usuario se reemplazó esa conexión por el shell clonado:

- `AppSidebar` es la única navegación de escritorio.
- `AppTopbar` queda como franja mínima de control para contraer el sidebar y abrir el drawer móvil; no contiene enlaces de navegación.
- Se eliminó `AppNavigation` de `PageShell`.
- Se agregó un guardrail que exige `AppShellProvider`, `AppSidebar` y `AppTopbar`, y rechaza el menú horizontal legado.

Esta corrección constituye una excepción aprobada al congelamiento de `AppSidebar`/`AppTopbar` indicado por el prompt original. No cambia rutas ni etiquetas; conecta la implementación previamente clonada que había quedado fuera del layout versionado.

## Componentes

### Creados

- `GreetingHero`
- `QuickActionGrid`
- `ActiveServiceCard`
- `EquipmentHistoryCard`
- `SupportBanner`
- `CustomerDashboard`
- `CustomerProfileForm`
- `CustomerAddressForm`
- `AddressSummaryCard`

### Extendidos o conectados

- `MetricStrip`
- view models y fixtures Cliente
- `AppShell`, `AppSidebar` y estilos de drawer

## Estados y honestidad funcional

- Dashboard con datos, cliente nuevo, error y chat diferido.
- Formularios con validación visible y detección de cambios.
- Guardado y mensajería no simulan operaciones exitosas.
- No se agregaron cobros, movimientos financieros ni integración de Mercado Pago.

## Validación responsive y accesibilidad

- Rutas verificadas en 320, 375, 768, 1024 y 1440 px.
- `body.scrollWidth` coincide con `body.clientWidth` en las 15 combinaciones.
- En escritorio existe un único `nav` dentro de un único `aside`.
- En móvil la navegación está cerrada por defecto, abre como `dialog`, recibe foco, cierra con Escape y restaura el foco al disparador.
- Los controles principales tienen objetivos táctiles de al menos 44 px y estados de foco visibles.

## Riesgos y pendientes

- Perfil y direcciones todavía no persisten datos.
- El chat permanece diferido.
- La navegación usa el catálogo temporal por rol hasta que se implemente el destino final de todas las rutas.
- Mercado Pago continúa completamente diferido.
