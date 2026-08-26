# Auditoría UI Cliente — Tanda 0

**Fecha:** 2026-08-25

**Alcance:** base compartida y contratos, sin rediseño de rutas

**Rama:** `codex/customer-screens-batch-0`

## Dirección de interfaz

- **Intención:** ayudar a una persona que acaba de detectar un problema en su hogar a entender el estado, el contexto y el próximo paso sin falsas confirmaciones.
- **Paleta:** azul Lysto para continuidad, azul hielo para contexto, verde para resolución, ámbar para atención, violeta para respaldo y grafito para jerarquía.
- **Profundidad:** bordes suaves y cambios de superficie; sombras reservadas para overlays.
- **Superficies:** canvas gris azulado, contenido blanco y controles con apariencia inset.
- **Tipografía:** Inter existente, jerarquía por peso y tracking; cifras con `tabular-nums`.
- **Espaciado:** escala base de 4 px y objetivos táctiles mínimos de 44 px.
- **Firma:** estado → contexto → próximo paso → acción → respaldo Lysto.

## Inventario CMP prioritario

| CMP | Equivalente encontrado | Decisión de Tanda 0 |
|---|---|---|
| CMP-001 IconHalo | No hay primitive genérica | Pendiente hasta que un consumidor real defina su API final. |
| CMP-002 StatusBadge | `Badge`, `StatusPill`; `components/pro/ui/status-badge.tsx` local no versionado | Reutilizar `Badge`; normalizar configuración de estados en tandas de dominio. |
| CMP-003 TrustBadge | `Badge`, nuevo `InfoNotice` security | No crear badge duplicado todavía; `InfoNotice` cubre mensajes extensos. |
| CMP-004 MetricValue | Dos `MetricCard` versionadas y una profesional local | Se crea `MetricValue` desacoplado de mocks. |
| CMP-005 MoneyValue | Funciones `money` repetidas | Pendiente; debe usar `Intl.NumberFormat` cuando aparezca el primer consumidor migrado. |
| CMP-006 ProgressBar | Progreso embebido en wizard y módulos | Pendiente de consolidación con pruebas específicas. |
| CMP-007 WizardProgress | `ProgressStepper` | Extender en Tanda 2; no duplicar ahora. |
| CMP-008 SegmentedTabs | No existe | Pendiente de la primera pantalla con tabs. |
| CMP-009 CountTabs | No existe | Pendiente de Tanda 3. |
| CMP-010 DateFilter | No existe; se agrega `Popover` | El primitive de overlay queda listo; calendario se define con su consumidor. |
| CMP-011 UserAvatar | Iniciales embebidas en tarjetas | Pendiente; no copiar lógica de una tarjeta profesional. |
| CMP-012 EquipmentThumbnail | Fallbacks embebidos y emojis | Pendiente de Tanda 4 con Lucide/asset local. |
| CMP-013 MediaGallery | No existe | Pendiente de Tanda 2; usará `Dialog`. |
| CMP-014 ActionGroup | `Button`, `ButtonLink`, `ActionPanel` | Se crea `ActionGroup` tipado con pending/disabled. |
| CMP-015 InfoNotice | `ActionPanel`; `InfoBanner` profesional local | Se crea `InfoNotice` canónico con live regions opcionales. |
| CMP-016 EmptyState | No existe | Se crea `EmptyState`. |
| CMP-017 LoadingSkeleton | No existe | Se crea `LoadingSkeleton` con reduced motion. |
| CMP-018 ErrorState | No existe | Se crea `ErrorState` recuperable. |
| CMP-019 PageIntro | `PageScaffold`; `SectionHeader` profesional local | Se extrae `PageIntro` y `PageScaffold` lo reutiliza. |
| CMP-020 GreetingHero | Saludo hardcodeado en dashboard Cliente | Pendiente de Tanda 1. |
| CMP-021 IllustratedHero | No existe | Crear solo si una composición necesita ilustración real. |
| CMP-022 MetricStrip | Dos grids de métricas versionadas | Se crea `MetricStrip` canónico sin import de fixtures. |
| CMP-023 BenefitStrip | Grillas hardcodeadas en páginas | Pendiente del primer consumidor. |
| CMP-024 SupportBanner | `ActionPanel`; `InfoBanner` profesional local | Reutilizar `InfoNotice` como base y componer el banner por rol. |
| CMP-025 QuickActionGrid | Enlaces hardcodeados en dashboards | Pendiente de Tanda 1; reutilizará `ActionGroup`/tiles. |
| CMP-026 FilterToolbar | No existe | Pendiente de Tanda 2. |
| CMP-027 ResourceTile | `SupportItem` profesional local | No promover el componente local; definir API neutral con consumidor real. |
| CMP-028 ActionRow | `RecordRow` y `DataRow` duplicadas | Consolidación programada al migrar las listas Cliente. |
| CMP-073 TrustHeroPanel | No existe | Pendiente de Garantías/Pagos. |
| CMP-074 ServiceCategoryCard | `SelectableCard` | Extender `SelectableCard` solo si la semántica selección/navegación coincide. |
| CMP-075 ServiceProcessStrip | `StatusTimeline` | Reutilizar lista ordenada y mejorar semántica en Tanda 6. |
| CMP-076 EducationBenefitPanel | No existe | Pendiente de Tanda 4. |
| CMP-077 HelpCallout | `ActionPanel` | Componer a partir de `InfoNotice` y `ActionGroup`. |
| CMP-078 AssurancePanel | No existe | Componer a partir de `InfoNotice` cuando haya claims reales. |
| CMP-079 LiveTrackingCard | `JobTracker` y `StatusTimeline` | Reutilizar trackers; mapa/fallback queda para Tanda 3. |
| CMP-080 ChatSupportBanner | No existe | Superficie visual futura; no implementar chat. |

## Duplicados detectados

| Grupo | Archivos | Resolución |
|---|---|---|
| Métricas | `components/business/metric-card.tsx`, `components/dashboard/metric-card.tsx`, `components/pro/ui/metric-card.tsx` local | `MetricValue`/`MetricStrip` son el destino canónico; migración gradual por tanda. |
| Encabezados | `PageScaffold` y `components/pro/ui/section-header.tsx` local | `PageIntro` es la primitive canónica y ya compone `PageScaffold`. |
| Listas | `RecordList`/`RecordRow` y `DataList`/`DataRow` | Mantener hasta migrar consumidores; no crear una tercera lista. |
| Estados | `StatusPill` y `components/pro/ui/status-badge.tsx` local | Separar configuración de dominio de la primitive visual en la tanda correspondiente. |
| Tarjetas de trabajo | `components/business/job-card.tsx` y variante profesional local | No fusionar tarjetas de actores distintos; compartir status, métricas, hechos y acciones. |
| Banners | `ActionPanel`, `InfoBanner` profesional local | `InfoNotice` queda como base neutral; banners son composiciones. |
| Formularios | `components/business/forms.tsx` exporta componentes terminados en `Mock` | No usar en pantallas finales; reemplazar por formularios Cliente tipados por tanda. |

Los componentes bajo `components/pro/ui` están sin versionar en el workspace principal y no se modifican desde esta rama. Se inspeccionaron únicamente para evitar crear equivalentes incompatibles.

## Gaps funcionales auditados

| Gap | Estado actual | Tanda responsable |
|---|---|---|
| `CustomerProfileForm` | No existe componente productivo | Tanda 1 |
| `CustomerAddressForm` | No existe componente productivo | Tanda 1 |
| `CustomerReviewForm` | Solo existe `ReviewFormMock` | Tanda 3 |
| `CustomerRequestSummaryCard` | `RequestCard` depende de mocks y tiene destino admin por defecto | Tanda 2 |
| `CustomerRequestDetail` | Composición embebida en la página | Tanda 2 |
| `PaymentDeferredPanel` | No existe; fixture financiero queda vacío y diferido | Tanda 2/6 |
| `FormFeedback` | No existía | Creado en Tanda 0 |

## Base compartida creada

- View models tipados para solicitudes, trabajos, equipos, mantenimiento, garantías, pagos y direcciones.
- Fixtures Cliente aislados y rotulados como demostración; movimientos financieros vacíos.
- Helper de búsqueda por ID que devuelve `null` y evita usar siempre el primer registro.
- Manifiesto de las 14 rutas Cliente.
- `PageIntro`, `MetricValue`, `MetricStrip`, `ActionGroup`, `InfoNotice`, `EmptyState`, `LoadingSkeleton`, `ErrorState` y `FormFeedback`.
- `Dialog` modal con foco inicial, focus trap, Escape, backdrop, restauración de foco y bloqueo de scroll.
- `Popover` con estado expandido, Escape, click exterior y restauración de foco.

## Guardrail de layout

Las 14 páginas Cliente se verifican estáticamente para impedir imports de `AppSidebar`, `AppTopbar` o `AppShellProvider`, además de `nav`, `aside` y wrappers `min-h-screen`. El layout global permanece fuera del alcance de las tandas.
