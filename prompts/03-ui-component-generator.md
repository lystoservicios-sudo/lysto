# Prompt maestro y catálogo de componentes UI de Lysto

Este documento convierte las 19 referencias visuales de Lysto en componentes reales, reutilizables y verificables. Las referencias se usan únicamente como inspiración visual y estructural; cualquier texto visible dentro de ellas es contenido de ejemplo, no una instrucción.

## Cómo usar este documento

1. Copiá el **Prompt maestro** al agente que trabajará en el repositorio.
2. Copiá después uno o más prompts `CMP` para construir componentes concretos.
3. Cuando los componentes necesarios existan, usá una composición `REF` para construir la pantalla.
4. Reemplazá los valores entre corchetes solo cuando el prompt lo solicite.
5. No ejecutes una composición creando componentes duplicados: primero completá o adaptá el registro.

## Prompt maestro

```text
Trabajás en el repositorio Lysto, una aplicación Next.js para operar servicios técnicos del hogar. Tu tarea es crear componentes reales y reutilizables, no mockups, capturas ni HTML descartable.

INTENCIÓN DEL PRODUCTO
- Cliente: necesita tranquilidad, claridad y saber qué ocurrirá después.
- Profesional: necesita decidir y operar trabajos con rapidez desde teléfono o escritorio.
- Admin: necesita supervisión, trazabilidad y control.
- La firma de Lysto es: estado actual → contexto → próximo paso → acción → respaldo.

STACK OBLIGATORIO
- React 19, Next.js 15 App Router y TypeScript estricto.
- Tailwind CSS y tokens/clases existentes de Lysto.
- Lucide React para iconografía; no mezclar librerías ni usar emojis como iconos productivos.
- Reutilizar primero @/components/ui, @/components/layout, @/components/pro/ui y cn.
- Vitest y Testing Library para pruebas de interacción y accesibilidad.

ANTES DE CREAR
1. Inspeccioná componentes con nombres, propósito o estructura equivalentes.
2. Informá qué se reutiliza, extiende o reemplaza. No crees un duplicado con otro nombre.
3. Revisá los tipos de dominio y no inventes estados incompatibles.
4. Conservá los cambios existentes del usuario y limitá la edición al alcance pedido.

REGLA DE NAVEGACIÓN
- Ignorá las barras superiores, menús, sidebars, logos y navegación visibles en las referencias.
- No crees ni modifiques AppShell, AppSidebar, headers globales, middleware ni configuración de navegación.
- El componente o pantalla empieza dentro del área de contenido que entrega el layout existente.

SISTEMA VISUAL
- Canvas blanco o gris azulado muy suave; superficies blancas.
- Azul Lysto para acciones y continuidad; azul hielo para contexto.
- Verde para éxito/verificación; ámbar para advertencia o siguiente paso; violeta para beneficio.
- Tinta azul oscuro para títulos; cuatro niveles de texto para jerarquía.
- Profundidad mediante bordes suaves y sombras mínimas. Evitá bordes duros y sombras dramáticas.
- Radio coherente: controles 12 px, tarjetas 16–24 px, paneles principales hasta 28 px.
- Escala de espaciado basada en 4 px. Objetivos táctiles de al menos 44×44 px.
- Los números monetarios usan formato es-AR y cifras tabulares.

RESPONSIVE
- Diseñá mobile-first desde 320 px.
- En móvil apilá datos, mantené visible la acción principal y evitá scroll horizontal.
- En tablet y desktop aumentá densidad con grillas, no agrandando innecesariamente texto o tarjetas.
- Acciones múltiples pueden apilarse en móvil y alinearse en fila en desktop.
- Tablas densas deben transformarse en filas o tarjetas legibles en móvil.

ACCESIBILIDAD
- HTML semántico, labels, roles y nombres accesibles.
- Navegación completa por teclado, focus-visible claro y orden lógico.
- No comuniques estados solamente con color: agregá texto o icono.
- aria-live para cambios asíncronos; aria-current/aria-selected/aria-expanded cuando corresponda.
- Respetá prefers-reduced-motion.

DATOS Y ARQUITECTURA
- El componente productivo recibe datos por props tipadas y emite callbacks/eventos.
- No hardcodees clientes, precios, fechas, direcciones o registros de negocio.
- No consultes Supabase, Mercado Pago o fetch directamente desde un componente presentacional.
- Separá ejemplo/fixture de la implementación productiva.
- Variantes por props y composición; no copies el componente para cada rol o breakpoint.

ESTADOS OBLIGATORIOS
- Elementos interactivos: default, hover, active, focus-visible y disabled.
- Componentes de datos: loading, empty y error cuando aplique.
- Operaciones asíncronas: pending, success y failure sin doble envío.

ENTREGA OBLIGATORIA
1. Resumen de reutilización y decisiones.
2. API pública de props y variantes.
3. Archivos creados o modificados.
4. Implementación completa, sin pseudocódigo.
5. Pruebas enfocadas en comportamiento, teclado y estados.
6. Ejemplo de uso separado con datos ficticios evidentes.
7. Comandos ejecutados y resultado real.

Si el pedido contradice estas reglas, requiere navegación nueva o duplica un componente existente, detenete y explicá la colisión antes de escribir código.
```

## Variables opcionales para los subprompts

- `[RUTA_DESTINO]`: carpeta o archivo preferido; si falta, proponé el lugar más coherente.
- `[TIPOS_REALES]`: tipos de dominio que el componente debe aceptar.
- `[ACCIONES]`: callbacks o enlaces que debe exponer.
- `[VARIANTES]`: variantes adicionales requeridas por la pantalla.
- `[DATOS]`: forma de los datos, nunca valores comerciales hardcodeados.

## Registro de componentes

| ID | Componente | Capa | Propósito | Referencias principales |
|---|---|---|---|---|
| CMP-001 | IconHalo | Base | Contenedor semántico de icono | Todas |
| CMP-002 | StatusBadge | Base | Estado con texto, icono o punto | 1, 4–6, 10–13 |
| CMP-003 | TrustBadge | Base | Garantía, seguridad o verificación | 5, 9, 14–18 |
| CMP-004 | MetricValue | Base | Métrica con contexto y tendencia | 1, 5, 8, 9, 11 |
| CMP-005 | MoneyValue | Base | Importe es-AR con jerarquía | 3, 5, 6, 8, 10, 12, 17 |
| CMP-006 | ProgressBar | Base | Progreso lineal accesible | 4, 8 |
| CMP-007 | WizardProgress | Base | Paso actual y progreso total | 14, 16–19 |
| CMP-008 | SegmentedTabs | Base | Cambio de vista o sección | 1, 13 |
| CMP-009 | CountTabs | Base | Filtros con cantidades | 6 |
| CMP-010 | DateFilter | Base | Rango temporal o fecha | 1, 12 |
| CMP-011 | UserAvatar | Base | Foto, iniciales y verificación | 6, 8–10, 13, 14 |
| CMP-012 | EquipmentThumbnail | Base | Imagen o fallback de equipo | 7, 9–13, 18 |
| CMP-013 | MediaGallery | Base | Galería compacta con contador | 5, 18 |
| CMP-014 | ActionGroup | Base | Acciones principal/secundaria/destructiva | 5, 14–19 |
| CMP-015 | InfoNotice | Base | Información, advertencia o protección | 10, 13, 17–19 |
| CMP-016 | EmptyState | Base | Estado sin datos accionable | Todas con datos |
| CMP-017 | LoadingSkeleton | Base | Carga sin salto de layout | Todas con datos |
| CMP-018 | ErrorState | Base | Error recuperable | Todas con datos |
| CMP-019 | PageIntro | Sección | Eyebrow, título, subtítulo y acción | 1–7, 10–13 |
| CMP-020 | GreetingHero | Sección | Saludo con CTA y contexto | 8, 9 |
| CMP-021 | IllustratedHero | Sección | Hero con ilustración opcional | 2, 3, 9, 15 |
| CMP-022 | MetricStrip | Sección | Grupo responsive de métricas | 1, 5, 8, 9, 11 |
| CMP-023 | BenefitStrip | Sección | Beneficios o promesas compactas | 2–4, 10, 13, 15 |
| CMP-024 | SupportBanner | Sección | Respaldo y acceso a soporte | 1, 2, 5, 6, 8–12 |
| CMP-025 | QuickActionGrid | Sección | Accesos rápidos responsive | 2, 8, 9 |
| CMP-026 | FilterToolbar | Sección | Filtros, orden y resultados | 5, 12 |
| CMP-027 | ResourceTile | Sección | Recurso, beneficio o herramienta | 2, 8 |
| CMP-028 | ActionRow | Sección | Fila navegable con icono y descripción | 1, 2, 7 |
| CMP-029 | DateNavigator | Agenda | Día anterior/siguiente y fecha actual | 1 |
| CMP-030 | AgendaSummary | Agenda | Trabajos, finalizados, próximos y horas | 1 |
| CMP-031 | AgendaTimeline | Agenda | Eje horario y eventos | 1, 8 |
| CMP-032 | AgendaEventCard | Agenda | Evento temporal con estado y CTA | 1, 8 |
| CMP-033 | AvailabilitySlot | Agenda | Franja disponible accionable | 1 |
| CMP-034 | OpportunityCard | Operación | Solicitud asignada con decisión | 5 |
| CMP-035 | OpportunityCompactRow | Operación | Oportunidad resumida | 8 |
| CMP-036 | PreliminaryDiagnosisPanel | Operación | Diagnóstico preliminar y evidencia | 5 |
| CMP-037 | JobCard | Operación | Trabajo activo y próximo paso | 6, 8 |
| CMP-038 | JobFactsGrid | Operación | Equipo, valor, distancia y horario | 6 |
| CMP-039 | NextStepPanel | Operación | Próxima tarea y CTA contextual | 6, 10 |
| CMP-040 | ServiceSummary | Seguimiento | Resumen de trabajo y equipo | 10 |
| CMP-041 | ServiceStageTracker | Seguimiento | Progreso de etapas del servicio | 10 |
| CMP-042 | StageAccordion | Seguimiento | Etapas desplegables y estados | 10 |
| CMP-043 | DiagnosisComparison | Seguimiento | Comparación IA/profesional | 10 |
| CMP-044 | PriceChangeAlert | Seguimiento | Diferencia de presupuesto | 10 |
| CMP-045 | CustomerApprovalPanel | Seguimiento | Aprobación o rechazo de cambio | 10 |
| CMP-046 | ProfessionalProgress | Profesional | Nivel, progreso y próximo requisito | 4, 8 |
| CMP-047 | PerformanceSummary | Profesional | Aceptación, rating y resultados | 8 |
| CMP-048 | EarningsSummary | Profesional | Saldo disponible y CTA | 3 |
| CMP-049 | CommissionBreakdown | Profesional | Total, comisión y explicación | 3 |
| CMP-050 | LiquidationRow | Profesional | Liquidación con estado y fecha | 3 |
| CMP-051 | TrainingModuleCard | Profesional | Módulo y progreso de formación | 4 |
| CMP-052 | SupportTopicCard | Profesional | Categoría de ayuda | 2 |
| CMP-053 | ProfessionalRecognitionCard | Profesional | Reconocimiento y calidad | 13 |
| CMP-054 | ActiveServiceCard | Cliente | Servicio activo con estado | 9 |
| CMP-055 | TechnicianProfileCard | Cliente | Técnico, confianza y datos | 9, 10, 14 |
| CMP-056 | TechnicianEtaCard | Cliente | Llegada estimada | 9, 10, 14 |
| CMP-057 | EquipmentHistoryCard | Cliente | Equipo, mantenimiento e historial | 9, 11 |
| CMP-058 | MaintenanceReminderCard | Cliente | Próximo mantenimiento | 7, 9, 11 |
| CMP-059 | PaymentMovementCard | Cliente | Pago, devolución o movimiento | 12 |
| CMP-060 | WarrantyCaseCard | Cliente | Reclamo y avance de resolución | 13 |
| CMP-061 | QualityFollowupCard | Cliente | Seguimiento de calidad | 13 |
| CMP-062 | ServiceHistoryList | Cliente | Servicios técnicos del equipo | 11 |
| CMP-063 | IssueOptionCard | Wizard | Problema seleccionable | 19 |
| CMP-064 | DiagnosticQuestionCard | Wizard | Pregunta con opciones | 18 |
| CMP-065 | MediaUploader | Wizard | Subida de fotos o video | 18 |
| CMP-066 | MediaPreviewGrid | Wizard | Previsualización y eliminación | 18 |
| CMP-067 | PriceOptionCard | Wizard | Plan/precio seleccionable | 17 |
| CMP-068 | IncludedServicesChecklist | Wizard | Alcance incluido y garantía | 17 |
| CMP-069 | MatchingVisualization | Wizard | Visualización de matching | 16 |
| CMP-070 | MatchingSteps | Wizard | Pasos del matching | 16 |
| CMP-071 | TechnicianConfirmation | Wizard | Confirmación del profesional | 14 |
| CMP-072 | WhatHappensNextTimeline | Wizard | Próximos pasos explicados | 14 |
| CMP-073 | TrustHeroPanel | Confianza | Panel principal de respaldo | 12, 13 |
| CMP-074 | ServiceCategoryCard | Descubrimiento | Categoría de servicio seleccionable | 15 |
| CMP-075 | ServiceProcessStrip | Confianza | Pago, servicio, certificado, garantía | 12 |
| CMP-076 | EducationBenefitPanel | Mantenimiento | Beneficios educativos con iconos | 7 |
| CMP-077 | HelpCallout | Soporte | Pregunta y CTA de ayuda | 3, 12 |
| CMP-078 | AssurancePanel | Confianza | Garantía extensa con promesas | 13, 15 |
| CMP-079 | LiveTrackingCard | Seguimiento | Mapa/posición/ETA con fallback | 14 |
| CMP-080 | ChatSupportBanner | Soporte | Chat con técnico o Lysto | 9, 10, 12, 14 |

## Matriz de cobertura de referencias

| ID | Pantalla | Componentes obligatorios |
|---|---|---|
| REF-01 | Agenda profesional | CMP-019, CMP-029, CMP-008, CMP-030, CMP-031, CMP-032, CMP-033, CMP-024, CMP-028 |
| REF-02 | Centro de soporte | CMP-021, CMP-052, CMP-024, CMP-025, CMP-027, CMP-028 |
| REF-03 | Pagos profesionales | CMP-021, CMP-048, CMP-049, CMP-050, CMP-023, CMP-077 |
| REF-04 | Capacitación | CMP-019, CMP-046, CMP-051, CMP-023 |
| REF-05 | Solicitudes asignadas | CMP-019, CMP-022, CMP-026, CMP-034, CMP-036, CMP-013, CMP-014, CMP-024 |
| REF-06 | Trabajos profesionales | CMP-019, CMP-009, CMP-024, CMP-037, CMP-038, CMP-039, CMP-002 |
| REF-07 | Mantenimientos recomendados | CMP-019, CMP-076, CMP-058, CMP-028 |
| REF-08 | Dashboard profesional | CMP-020, CMP-046, CMP-022, CMP-037, CMP-035, CMP-031, CMP-047, CMP-025, CMP-024, CMP-028 |
| REF-09 | Dashboard cliente | CMP-020, CMP-022, CMP-054, CMP-055, CMP-056, CMP-057, CMP-024, CMP-025, CMP-080 |
| REF-10 | Seguimiento detallado | CMP-040, CMP-041, CMP-015, CMP-055, CMP-056, CMP-042, CMP-043, CMP-044, CMP-045, CMP-023, CMP-080 |
| REF-11 | Equipos e historial | CMP-019, CMP-022, CMP-057, CMP-058, CMP-062, CMP-024 |
| REF-12 | Pagos y movimientos | CMP-019, CMP-073, CMP-010, CMP-059, CMP-075, CMP-077, CMP-080 |
| REF-13 | Garantías y calidad | CMP-019, CMP-078, CMP-023, CMP-008, CMP-060, CMP-061, CMP-053, CMP-015 |
| REF-14 | Técnico confirmado | CMP-007, CMP-071, CMP-003, CMP-055, CMP-056, CMP-072, CMP-079, CMP-080, CMP-014 |
| REF-15 | Inicio y selección de servicio | CMP-021, CMP-023, CMP-074, CMP-014, CMP-003 |
| REF-16 | Matching en proceso | CMP-007, CMP-069, CMP-070, CMP-003, CMP-014 |
| REF-17 | Presupuesto preliminar | CMP-007, CMP-003, CMP-067, CMP-068, CMP-015, CMP-014 |
| REF-18 | Diagnóstico y multimedia | CMP-007, CMP-015, CMP-064, CMP-065, CMP-066, CMP-003, CMP-014 |
| REF-19 | Selección del problema | CMP-007, CMP-063, CMP-015, CMP-014 |

## Contrato común de los prompts CMP

Cada prompt siguiente hereda el Prompt maestro. Implementá el componente indicado, reutilizá equivalentes existentes y entregá su prueba. Como mínimo, la API debe evitar datos hardcodeados, permitir `className`, aceptar estados relevantes y exponer callbacks sin acoplarse a persistencia.

### Prompt CMP-001 — IconHalo
Implementá `IconHalo`: contenedor de icono con tonos `brand`, `success`, `warning`, `benefit` y `neutral`; tamaños `sm/md/lg`; icono por `ReactNode`; `aria-hidden` cuando sea decorativo y label cuando comunique significado. No uses color sin texto asociado en el componente consumidor.

### Prompt CMP-002 — StatusBadge
Implementá o extendé `StatusBadge` con `label`, `tone`, `icon`, `dot`, `pulse` y tamaño. Debe mapear estados desde configuración externa, no conocer todos los estados del dominio internamente, y conservar contraste y texto legible.

### Prompt CMP-003 — TrustBadge
Implementá `TrustBadge` para pago protegido, técnico verificado, garantía o confidencialidad. API: `icon`, `label`, `description?`, `tone`, `compact?`; usar semántica informativa, no botón salvo que reciba acción explícita.

### Prompt CMP-004 — MetricValue
Implementá `MetricValue` con `label`, `value`, `description?`, `trend?`, `icon?` y `tone`. Los números deben usar cifras tabulares; ofrecer versión inline y stacked sin convertirlo automáticamente en tarjeta.

### Prompt CMP-005 — MoneyValue
Implementá `MoneyValue` con valor numérico, moneda, locale, signo, tamaño, estado y descripción. Formateá con `Intl.NumberFormat`, contemplá devolución/negativo y evitá concatenar símbolos manualmente.

### Prompt CMP-006 — ProgressBar
Implementá `ProgressBar` accesible con `value`, `max`, label visible u oculto, tonos y estado indeterminado. Incluir `role=progressbar`, valores ARIA y reducción de movimiento.

### Prompt CMP-007 — WizardProgress
Implementá `WizardProgress` con paso actual, total, label y progreso. Debe funcionar para flujos de cuatro o cinco pasos, anunciar cambios y no incluir header, logo, volver o ayuda.

### Prompt CMP-008 — SegmentedTabs
Implementá `SegmentedTabs` controlado con items tipados, selección, teclado con flechas y variantes compact/comfortable. Usá roles tablist/tab y paneles correctamente relacionados.

### Prompt CMP-009 — CountTabs
Implementá `CountTabs` para estados como activos, por cerrar y finalizados, con badge numérico y scroll seguro en móvil. Exponer selección controlada y foco por teclado.

### Prompt CMP-010 — DateFilter
Implementá `DateFilter` como trigger y popover accesible, no como `input[type=date]` sin estilo. Aceptar preset, rango y callback; proveer fallback simple si aún no existe calendario del proyecto.

### Prompt CMP-011 — UserAvatar
Implementá `UserAvatar` con imagen optimizada, iniciales, fallback, tamaño, badge de verificación y alt correcto. Nunca uses nombres fijos ni imágenes externas sin configurar.

### Prompt CMP-012 — EquipmentThumbnail
Implementá `EquipmentThumbnail` con imagen Next, fallback por tipo de equipo, badge opcional y tamaños. Mantener proporción, `object-contain` y alt descriptivo.

### Prompt CMP-013 — MediaGallery
Implementá `MediaGallery` compacta con thumbnails, contador restante, modal opcional y navegación por teclado. Aceptar fotos/videos tipados y no asumir URLs públicas permanentes.

### Prompt CMP-014 — ActionGroup
Implementá `ActionGroup` para acción primaria, secundaria y terciaria/destructiva. En móvil apilar cuando no entren; controlar pending/disabled y prevenir doble activación.

### Prompt CMP-015 — InfoNotice
Implementá `InfoNotice` con tonos info/success/warning/security, título, descripción, icono y acción opcional. Usar `role=status` o `alert` solo cuando corresponda.

### Prompt CMP-016 — EmptyState
Implementá `EmptyState` compacto o completo con título, explicación, icono y CTA opcional. El mensaje debe orientar al próximo paso sin inventar datos.

### Prompt CMP-017 — LoadingSkeleton
Implementá skeletons configurables que preserven la geometría del componente final. Incluir etiqueta accesible de carga y respetar reduced motion.

### Prompt CMP-018 — ErrorState
Implementá `ErrorState` recuperable con mensaje seguro, acción de reintento y código opcional no sensible. Usar `role=alert` y nunca mostrar stacks o secretos.

### Prompt CMP-019 — PageIntro
Implementá o extendé `PageIntro/SectionHeader` con eyebrow, título, subtítulo, acción y slot visual opcional. Debe iniciar dentro del contenido y no renderizar navegación.

### Prompt CMP-020 — GreetingHero
Implementá `GreetingHero` con saludo, texto contextual, acciones y visual opcional. Adaptar composición cliente/profesional y ocultar decoración no esencial en pantallas estrechas.

### Prompt CMP-021 — IllustratedHero
Implementá `IllustratedHero` con eyebrow, título con énfasis, descripción, acciones, ilustración local opcional y panel flotante opcional. El contenido debe seguir legible sin imagen.

### Prompt CMP-022 — MetricStrip
Implementá `MetricStrip` que componga `MetricValue` en lista/grilla responsive. Permitir divisores en desktop y tarjetas compactas en móvil; soportar loading y empty.

### Prompt CMP-023 — BenefitStrip
Implementá `BenefitStrip` con entre dos y cinco beneficios tipados, iconos semánticos y texto breve. Debe reordenarse sin perder lectura y evitar iconos puramente decorativos.

### Prompt CMP-024 — SupportBanner
Implementá `SupportBanner` con promesa de respaldo, descripción y CTA. Variantes cliente/profesional/neutra, layout compacto móvil y acción accesible.

### Prompt CMP-025 — QuickActionGrid
Implementá `QuickActionGrid` de enlaces o botones tipados con `ResourceTile`. Resolver columnas según ancho y asegurar que todo el tile sea activable sin anidar controles.

### Prompt CMP-026 — FilterToolbar
Implementá `FilterToolbar` con conteo, orden, filtros y limpiar. En móvil usar controles colapsables; mantener estado controlado y labels visibles.

### Prompt CMP-027 — ResourceTile
Implementá `ResourceTile` para capacitación, herramientas, beneficios o estadísticas, con icono, título, descripción y enlace. Variantes horizontal/vertical sin estilos por texto hardcodeado.

### Prompt CMP-028 — ActionRow
Implementá `ActionRow` navegable con icono, título, descripción, metadata y chevron. Usar Link o button según semántica y objetivo táctil completo.

### Prompt CMP-029 — DateNavigator
Implementá `DateNavigator` con anterior, hoy/siguiente, fecha localizada y callbacks. Deshabilitar límites, anunciar fecha y no depender de controles nativos sin estilo.

### Prompt CMP-030 — AgendaSummary
Implementá `AgendaSummary` con métricas de trabajos, finalizados, próximos y disponibilidad. Reutilizar `MetricValue` y permitir configuración, no fijar cuatro métricas obligatorias.

### Prompt CMP-031 — AgendaTimeline
Implementá `AgendaTimeline` para horas, eventos y espacios disponibles. Posicionar de forma legible sin depender de píxeles absolutos frágiles; ofrecer lista lineal accesible.

### Prompt CMP-032 — AgendaEventCard
Implementá `AgendaEventCard` con rango horario, estado, cliente, servicio, ubicación y CTA. Tonos provistos por configuración; soportar evento finalizado, próximo y pendiente.

### Prompt CMP-033 — AvailabilitySlot
Implementá `AvailabilitySlot` con hora inicial/final, estado disponible/bloqueado y CTA. Debe integrarse en timeline y ser comprensible sin color.

### Prompt CMP-034 — OpportunityCard
Implementá `OpportunityCard` con tiempo de respuesta, compatibilidad, cliente, ubicación, distancia, horario, equipo, ingreso, diagnóstico, medios y decisiones. Separar subcomponentes, apilar acciones en móvil y cubrir pending.

### Prompt CMP-035 — OpportunityCompactRow
Implementá `OpportunityCompactRow` para dashboard con tipo de falla, zona, distancia, ingreso, compatibilidad, fecha y CTA. Mantener información mínima y enlace a detalle.

### Prompt CMP-036 — PreliminaryDiagnosisPanel
Implementá `PreliminaryDiagnosisPanel` con resumen, disclaimer, info contextual y galería opcional. Marcar claramente que no es diagnóstico definitivo.

### Prompt CMP-037 — JobCard
Implementá o consolidá `JobCard` con estado, horario, cliente, servicio, dirección, hechos, próximo paso y CTA derivada externamente. Debe soportar estados activos y cerrados sin lógica duplicada.

### Prompt CMP-038 — JobFactsGrid
Implementá `JobFactsGrid` para equipo, importe, distancia, fecha u otros hechos. Aceptar items tipados; usar divisores suaves y reorganizar 1/2/3 columnas.

### Prompt CMP-039 — NextStepPanel
Implementá `NextStepPanel` con icono, título, descripción y acción contextual. Variantes brand/warning/success; acción pending y contenido legible sin color.

### Prompt CMP-040 — ServiceSummary
Implementá `ServiceSummary` con ID, fecha, horario, falla, cliente, dirección, estado y equipo. Distribuir imagen y datos responsive sin incluir botón volver ni navegación.

### Prompt CMP-041 — ServiceStageTracker
Implementá `ServiceStageTracker` horizontal en desktop y vertical/scroll seguro en móvil, con estados completed/current/pending/error. Usar lista ordenada y `aria-current=step`.

### Prompt CMP-042 — StageAccordion
Implementá `StageAccordion` controlado con etapa, estado, contenido y permisos de expansión. Teclado, `aria-expanded` y animación reducida.

### Prompt CMP-043 — DiagnosisComparison
Implementá `DiagnosisComparison` para estimación inicial y diagnóstico profesional, importes y diferencias. En móvil apilar; etiquetar fuente y momento de cada dato.

### Prompt CMP-044 — PriceChangeAlert
Implementá `PriceChangeAlert` con importe anterior, nuevo, diferencia y motivo. Formato monetario correcto y tonos según aumento/disminución sin sugerir aprobación automática.

### Prompt CMP-045 — CustomerApprovalPanel
Implementá `CustomerApprovalPanel` con explicación, aceptar, no continuar y pending. Exigir confirmación explícita, evitar doble envío y exponer callbacks sin mutar datos localmente como fuente de verdad.

### Prompt CMP-046 — ProfessionalProgress
Implementá `ProfessionalProgress` con nivel actual, porcentaje, siguiente nivel y requisitos. Reutilizar `ProgressBar`; soportar completo y compacto.

### Prompt CMP-047 — PerformanceSummary
Implementá `PerformanceSummary` con métricas configurables, tendencia opcional y mensaje de orientación. No inventar sparklines si no hay serie de datos real.

### Prompt CMP-048 — EarningsSummary
Implementá `EarningsSummary` con total generado/disponible, estado y CTA de liquidaciones. Usar `MoneyValue`, loading y privacidad adecuada.

### Prompt CMP-049 — CommissionBreakdown
Implementá `CommissionBreakdown` con total cliente, comisión y neto profesional, porcentajes opcionales y explicación. Verificar consistencia matemática solo para presentación, sin reemplazar cálculo servidor.

### Prompt CMP-050 — LiquidationRow
Implementá o extendé `LiquidationRow` con neto, total, comisión, trabajo, cliente, fecha y estado. Variante card móvil/list row desktop y enlace a detalle.

### Prompt CMP-051 — TrainingModuleCard
Implementá o extendé `TrainingModuleCard` con número, título, descripción, estado, progreso y CTA. No usar emojis; aceptar icono Lucide o asset.

### Prompt CMP-052 — SupportTopicCard
Implementá o extendé `SupportTopicCard` con tema, descripción, icono y navegación. Variantes trabajo/técnica/pagos/otro definidas por datos, no por condiciones sobre el texto.

### Prompt CMP-053 — ProfessionalRecognitionCard
Implementá `ProfessionalRecognitionCard` con perfil, rol, calificación, aceptación y distintivo. Asegurar que las métricas tengan labels y no simular verificación.

### Prompt CMP-054 — ActiveServiceCard
Implementá `ActiveServiceCard` con profesional, estado, ETA, equipo y ubicación. Componer perfil/ETA, soportar falta de profesional y ofrecer detalle.

### Prompt CMP-055 — TechnicianProfileCard
Implementá `TechnicianProfileCard` compacto/completo con avatar, nombre, verificación, rating, especialidad, matrícula y estadísticas configurables. Ocultar datos sensibles según contexto.

### Prompt CMP-056 — TechnicianEtaCard
Implementá `TechnicianEtaCard` con rango de llegada, estado, distancia y actualización. Usar `time` semántico y aria-live para cambios relevantes.

### Prompt CMP-057 — EquipmentHistoryCard
Implementá `EquipmentHistoryCard` con imagen, nombre, marca/modelo, estado, mantenimiento y últimos servicios. Variante compacta para dashboard y completa para inventario.

### Prompt CMP-058 — MaintenanceReminderCard
Implementá `MaintenanceReminderCard` con equipo, fecha próxima, recomendación, urgencia y CTA. Formatear fechas en es-AR y contemplar vencido/sin fecha.

### Prompt CMP-059 — PaymentMovementCard
Implementá `PaymentMovementCard` para pago o devolución, con servicio, profesional, fecha, método enmascarado, importe, estado, comprobante y detalle. Nunca exponer datos completos de tarjeta.

### Prompt CMP-060 — WarrantyCaseCard
Implementá `WarrantyCaseCard` con equipo, servicio, técnico, fecha, descripción segura, estado y timeline resumida. Contemplar abierto/resuelto/rechazado y enlace a detalle.

### Prompt CMP-061 — QualityFollowupCard
Implementá `QualityFollowupCard` con equipo, tipo, detalle, estado y CTA. Evitar exponer notas internas y usar warning solo para casos que lo ameriten.

### Prompt CMP-062 — ServiceHistoryList
Implementá `ServiceHistoryList` con fecha, tipo de servicio, resultado y comprobante. Lista semántica, límite configurable y acción para historial completo.

### Prompt CMP-063 — IssueOptionCard
Implementá `IssueOptionCard` seleccionable con icono, título, descripción y radio implícito. Agrupar opciones como radiogroup, teclado y selección controlada.

### Prompt CMP-064 — DiagnosticQuestionCard
Implementá `DiagnosticQuestionCard` con progreso de pregunta, enunciado y opciones tipadas. Soportar respuesta única, texto opcional y validación visible.

### Prompt CMP-065 — MediaUploader
Implementá `MediaUploader` para foto/video con límites configurables, drag/drop y selector. Validar tipo/tamaño en cliente como ayuda, sin reemplazar validación servidor; estados de subida y error.

### Prompt CMP-066 — MediaPreviewGrid
Implementá `MediaPreviewGrid` con previews, progreso, error, eliminar y contador. Revocar object URLs y usar botones accesibles con nombre específico.

### Prompt CMP-067 — PriceOptionCard
Implementá `PriceOptionCard` radio con nombre, etiqueta, descripción, ETA, precio, recomendado y selección. No marcar recomendado solo por posición; datos por props.

### Prompt CMP-068 — IncludedServicesChecklist
Implementá `IncludedServicesChecklist` con items incluidos/excluidos y bloque de garantía opcional. Usar listas semánticas e iconos con texto.

### Prompt CMP-069 — MatchingVisualization
Implementá `MatchingVisualization` con centro visual, criterios y estado. Debe tener alternativa textual completa y movimiento desactivable; no usar canvas inaccesible como única información.

### Prompt CMP-070 — MatchingSteps
Implementá `MatchingSteps` con completed/current/pending/error, timestamp y descripción. Usar lista ordenada, aria-current y actualizaciones anunciadas.

### Prompt CMP-071 — TechnicianConfirmation
Implementá `TechnicianConfirmation` con estado de éxito, mensaje, protección y perfil asignado. No incluir header ni progreso; esos son componentes hermanos.

### Prompt CMP-072 — WhatHappensNextTimeline
Implementá `WhatHappensNextTimeline` con pasos numerados, estado actual y descripción. Permitir slot lateral para tracking en desktop y apilado móvil.

### Prompt CMP-073 — TrustHeroPanel
Implementá `TrustHeroPanel` con ilustración/icono, promesa principal y explicación. Variantes pagos/garantía/soporte, sin claims fijos no respaldados.

### Prompt CMP-074 — ServiceCategoryCard
Implementá `ServiceCategoryCard` seleccionable o navegable con icono, nombre, descripción, disponibilidad y estado disabled. Diferenciar semánticamente seleccionar de navegar.

### Prompt CMP-075 — ServiceProcessStrip
Implementá `ServiceProcessStrip` con pasos conectados como pago, servicio, certificado y garantía. Lista ordenada, conectores decorativos y apilado móvil.

### Prompt CMP-076 — EducationBenefitPanel
Implementá `EducationBenefitPanel` con explicación, beneficios configurables y conclusión. Reutilizar `IconHalo`; no forzar cinco columnas en móvil.

### Prompt CMP-077 — HelpCallout
Implementá `HelpCallout` con pregunta, respuesta breve y CTA. Variantes neutral/warm; permitir enlace o callback sin anidar controles.

### Prompt CMP-078 — AssurancePanel
Implementá `AssurancePanel` con promesa, descripción y lista de respaldos. Claims y métricas deben llegar por props; composición responsive y sin navegación global.

### Prompt CMP-079 — LiveTrackingCard
Implementá `LiveTrackingCard` con slot de mapa, ubicación/estado, ETA y profesional. Proveer fallback accesible cuando el mapa no carga y no exponer coordenadas innecesarias.

### Prompt CMP-080 — ChatSupportBanner
Implementá `ChatSupportBanner` para hablar con técnico o Lysto, con disponibilidad, mensaje y CTA. No implementar chat ni conexión dentro del banner; solo emitir acción o link.

## Contrato de las composiciones REF

Aplicá primero el Prompt maestro. Una composición debe usar los componentes indicados, inspeccionar equivalentes existentes y crear solo la página o sección solicitada. Los datos provienen de props, server component, query existente o fixture separado para demo. Debe incluir loading, empty, error y restricciones de rol cuando correspondan.

En todas las composiciones: **ignorá y no generes la barra superior, logo, botón Menú, sidebar o navegación de la referencia**. No modifiques el layout global.

### Composición REF-01 — Agenda profesional
Construí el contenido de agenda usando CMP-019/029/008/030/031/032/033/024/028. Jerarquía: introducción, navegación de fecha y vista, resumen, timeline, respaldo y gestión de disponibilidad. Móvil en lista temporal; desktop permite eje horario más amplio. Cubrir día vacío, error y eventos superpuestos.

### Composición REF-02 — Centro de soporte
Construí soporte profesional con CMP-021/052/024/025/027/028. Jerarquía: promesa de acompañamiento, temas de ayuda, respaldo, recursos de crecimiento y centro de ayuda. La ilustración es opcional; toda categoría debe ser activable por teclado.

### Composición REF-03 — Pagos profesionales
Construí pagos profesionales con CMP-021/048/049/050/023/077. Mostrar saldo y composición antes de liquidaciones; explicar comisión sin claims fijos. Móvil apila resumen; desktop puede dividir neto y desglose. Cubrir sin movimientos, saldo retenido y error.

### Composición REF-04 — Capacitación
Construí capacitación con CMP-019/046/051/023. Encabezado y progreso global preceden una grilla de módulos con estados. Una columna móvil, dos tablet, tres desktop. Cubrir catálogo vacío y progreso no disponible.

### Composición REF-05 — Solicitudes asignadas
Construí oportunidades con CMP-019/022/026/034/036/013/014/024. Mostrar contexto de disponibilidad/compatibilidad/pago, filtros y tarjetas de decisión. Evitar acciones pegadas entre sí en móvil; confirmar rechazo si requiere motivo.

### Composición REF-06 — Trabajos profesionales
Construí lista de trabajos con CMP-019/009/024/037/038/039/002. Tabs por estado, respaldo y tarjetas con próximo paso. Mantener la acción principal alineada con el estado y cubrir listas vacías por tab.

### Composición REF-07 — Mantenimientos recomendados
Construí mantenimientos con CMP-019/076/058/028. Primero explicar valor, luego listar equipos y próximas fechas. Móvil compacto; desktop puede usar grilla. Contemplar vencidos, sin recomendaciones y recordatorios desactivados.

### Composición REF-08 — Dashboard profesional
Construí dashboard con CMP-020/046/022/037/035/031/047/025/024/028. Prioridad: próximo trabajo y oportunidades; métricas y crecimiento son secundarios. Desktop en grilla asimétrica; móvil en orden operativo. No inventar sparklines sin series reales.

### Composición REF-09 — Dashboard cliente
Construí dashboard cliente con CMP-020/022/054/055/056/057/024/025/080. Prioridad: solicitar servicio o seguir el activo; después equipos y accesos. La imagen hero es opcional. Cubrir cliente nuevo sin equipos ni trabajos.

### Composición REF-10 — Seguimiento detallado
Construí detalle con CMP-040/041/015/055/056/042/043/044/045/023/080. Mostrar resumen y tracker antes del contenido actual. La comparación y aprobación aparecen solo cuando el estado lo requiere. Móvil apila profesional y etapa; proteger dobles aprobaciones.

### Composición REF-11 — Equipos e historial
Construí inventario con CMP-019/022/057/058/062/024. Resumen seguido de tarjetas completas por equipo. Permitir imagen ausente, equipo sin historial y paginación/carga progresiva.

### Composición REF-12 — Pagos y movimientos
Construí movimientos cliente con CMP-019/073/010/059/075/077/080. Encabezado de confianza, filtro, lista, proceso y ayuda. No mostrar datos sensibles; devoluciones usan signo y etiqueta explícitos.

### Composición REF-13 — Garantías y calidad
Construí garantías con CMP-019/078/023/008/060/061/053/015. Separar reclamos, seguimiento y reconocimiento mediante tabs accesibles. No mezclar notas internas; cubrir caso sin garantías.

### Composición REF-14 — Técnico confirmado
Construí confirmación con CMP-007/071/003/055/056/072/079/080/014. Orden móvil: progreso, éxito, protección, profesional, próximos pasos, tracking, chat y acciones. Desktop puede usar dos columnas. No incluir header de la captura.

### Composición REF-15 — Inicio y selección de servicio
Construí contenido inicial móvil-first con CMP-021/023/074/014/003. Hero, garantías, categorías y CTA. Otras categorías pueden estar disabled con explicación. Excluir logo superior e ingreso.

### Composición REF-16 — Matching en proceso
Construí matching con CMP-007/069/070/003/014. Visualización y lista textual deben representar el mismo estado. Actualizaciones accesibles, cancelación secundaria y reduced motion. Excluir header.

### Composición REF-17 — Presupuesto preliminar
Construí selección de presupuesto con CMP-007/003/067/068/015/014. Opciones como radiogroup, recomendado por datos y disclaimer visible antes de continuar. No procesar pagos desde la UI.

### Composición REF-18 — Diagnóstico y multimedia
Construí paso de diagnóstico con CMP-007/015/064/065/066/003/014. Pregunta actual, opciones, uploads opcionales, previews y aviso preliminar. Cubrir límites, archivo inválido, progreso y eliminación.

### Composición REF-19 — Selección del problema
Construí selección de falla con CMP-007/063/015/014. Lista/radiogroup de problemas, protección de datos y continuar disabled hasta selección válida. Excluir header, logo y ayuda de la captura.

## Checklist final para el agente

- [ ] Inspeccioné componentes existentes y evité duplicados.
- [ ] No creé ni modifiqué navegación global.
- [ ] Los datos reales llegan por props o capa de servidor.
- [ ] La API del componente está tipada y documentada.
- [ ] Mobile 320 px y desktop fueron contemplados.
- [ ] Hay teclado, focus-visible, semántica y ARIA.
- [ ] Loading, empty, error y pending existen cuando aplican.
- [ ] Agregué pruebas de comportamiento.
- [ ] Ejecuté lint, typecheck y pruebas relevantes.
- [ ] Informé resultados reales y pendientes.

