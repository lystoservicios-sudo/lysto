# Prompt para implementar las pantallas Cliente por tandas

Copiá el bloque siguiente en una sesión de desarrollo dentro del repositorio Lysto. El agente debe completar una sola tanda, verificarla y detenerse para revisión antes de continuar.

```text
Sos el agente responsable de implementar las pantallas reales del área Cliente de Lysto mediante componentes reutilizables. Trabajá por tandas secuenciales y detenete después de cada checkpoint.

DOCUMENTOS OBLIGATORIOS
1. Leé completo `prompts/03-ui-component-generator.md` y aplicá su Prompt maestro, catálogo CMP y reglas de calidad.
2. Leé `docs/plans/2026-08-25-customer-screens-batches-design.md`.
3. Inspeccioná las rutas actuales bajo `app/(customer)/app` y los componentes existentes antes de crear archivos.
4. Aplicá las guías de brainstorming, interface-design, TDD y verification-before-completion disponibles en el entorno.

OBJETIVO
Dejar visualmente completas, responsive, accesibles y coherentes las 14 pantallas Cliente. Construí código productivo React/Next.js/TypeScript/Tailwind dentro del área utilizable del layout existente. No conviertas mocks en supuesta persistencia y no integres todavía Mercado Pago.

LAYOUT CONGELADO
`components/layout/page-shell.tsx` ya entrega:
- `AppSidebar` a la izquierda;
- `AppTopbar` arriba;
- `<main id="main-content">` debajo del topbar y al lado del sidebar;
- un contenedor centrado `max-w-[90rem]` con padding responsive.

Renderizá únicamente el contenido que recibe `AppShell` como `children`.

PROHIBIDO
- Modificar, reemplazar o rediseñar `AppShell`, `AppSidebar`, `AppTopbar` o `AppShellProvider`.
- Crear una segunda barra superior, sidebar, logo, botón Menú o wrapper `min-h-screen` dentro de una página.
- Cambiar `app-navigation-config.ts` durante estas tandas.
- Copiar la navegación visible en las imágenes de referencia.
- Usar posiciones fijas que invadan sidebar o topbar.
- Eliminar rutas porque todavía no tengan backend.

No modifiques el layout global. Si una pantalla necesita más ancho o separación, resolvelo dentro de su contenido.

ÁREA VISUAL
- Las páginas comienzan con `PageIntro` o un hero de contenido, nunca con navegación.
- Usá el ancho disponible del contenedor: una columna móvil, grillas útiles en tablet/desktop.
- Mantené el azul Lysto para acciones, verde para éxito, ámbar para atención y violeta para beneficios.
- Superficies blancas, canvas gris azulado suave, bordes discretos y sombras mínimas.
- No uses emojis productivos ni colores hex aislados; usá Lucide y tokens existentes.
- La firma visual debe ser: estado → contexto → próximo paso → acción → respaldo Lysto.

RUTAS OBLIGATORIAS

| ID | Ruta | Pantalla |
|---|---|---|
| CUS-01 | `/app` | Panel principal |
| CUS-02 | `/app/solicitar/aire-acondicionado` | Wizard para solicitar técnico |
| CUS-03 | `/app/solicitudes` | Mis solicitudes |
| CUS-04 | `/app/solicitudes/[id]` | Detalle de solicitud |
| CUS-05 | `/app/trabajos` | Mis trabajos |
| CUS-06 | `/app/trabajos/[id]` | Detalle y seguimiento del trabajo |
| CUS-07 | `/app/trabajos/[id]/review` | Calificar servicio |
| CUS-08 | `/app/equipos` | Mis equipos |
| CUS-09 | `/app/equipos/[id]` | Detalle del equipo |
| CUS-10 | `/app/mantenimientos` | Mantenimientos recomendados |
| CUS-11 | `/app/garantias` | Garantías, reclamos y calidad |
| CUS-12 | `/app/pagos` | Pagos y movimientos diferidos |
| CUS-13 | `/app/perfil` | Perfil del cliente |
| CUS-14 | `/app/direcciones` | Direcciones y acceso |

ARQUITECTURA DE COMPONENTES
- Reutilizá primero `components/ui`, `components/business`, `components/dashboard`, `components/status`, `components/wizard` y los CMP del catálogo.
- Extendé un componente equivalente antes de crear uno nuevo.
- Componentes productivos reciben props tipadas; fixtures de demo quedan aislados en archivos claramente identificados.
- Server Components por defecto. Agregá `'use client'` únicamente al borde interactivo mínimo.
- No consultes Supabase ni proveedores externos desde componentes presentacionales.
- No uses siempre el primer registro para rutas `[id]`; resolvé por parámetro o mostrale al usuario un estado no encontrado.

GAPS QUE DEBEN AUDITARSE
Antes de crear estos componentes, comprobá si existe un equivalente real. Si no existe, crealo y registrá la decisión:
- `CustomerProfileForm`;
- `CustomerAddressForm`;
- `CustomerReviewForm`;
- `CustomerRequestSummaryCard`;
- `CustomerRequestDetail`;
- `PaymentDeferredPanel`;
- `FormFeedback` para pending/success/error.

No mantengas nombres terminados en `Mock` dentro de pantallas finales. Podés conservar fixtures separados mientras la persistencia esté pendiente.

DATOS Y HONESTIDAD FUNCIONAL
- Conservá integraciones reales que ya funcionen, pero no amplíes el alcance a persistencia o proveedores externos.
- Si una acción todavía no tiene backend, no muestres una confirmación falsa.
- Usá disabled, estado informativo o callback no conectado claramente documentado.
- Los ejemplos deben estar identificados como demo en desarrollo, nunca como registros reales.
- Cada página con datos debe tener loading, empty, error, datos disponibles y not-found cuando corresponda.
- Formularios: validación visible, pending, error y success únicamente cuando una operación real lo confirme.

POLÍTICA DE MERCADO PAGO DIFERIDO
Mercado Pago se integrará al final reutilizando una pasarela de otro proyecto. En esta etapa:

1. No importes ni implementes la pasarela.
2. No crees preferencias, IDs de pago, webhooks, OAuth, split, devoluciones ni conciliación.
3. No simules pagos aprobados ni hagas avanzar solicitudes como si se hubieran pagado.
4. No elimines `/app/pagos`, el paso de pago del wizard ni los CTAs financieros.
5. Centralizá el estado diferido en `PaymentDeferredPanel` o un equivalente único.
6. El panel debe explicar: “La integración de Mercado Pago se incorporará en la etapa final”.
7. Los botones de pagar, reintentar, devolver o ver comprobante permanecen deshabilitados o muestran estado “Integración pendiente”; no usan `alert()` ni respuestas falsas.
8. El presupuesto preliminar, desglose e información de protección pueden mostrarse porque no ejecutan un cobro.
9. `/app/pagos` debe quedar visualmente terminada con hero, explicación, empty/deferred state y ayuda; no necesita movimientos inventados.
10. Creá o actualizá `docs/integrations/mercadopago-ui-touchpoints.md` con: ruta, componente, acción futura, datos requeridos y contrato esperado.

No modifiques contratos de pago existentes salvo que sea imprescindible para compilar. Documentá cualquier conflicto.

ACCESIBILIDAD Y RESPONSIVE
- Verificá 320 px, 375 px, 768 px, 1024 px y desktop ancho.
- Sin scroll horizontal accidental.
- Controles táctiles mínimos 44×44 px.
- Teclado completo, focus-visible, labels y ARIA correctos.
- `aria-current=step` en progreso, `aria-live` en cambios asíncronos y diálogos con foco controlado.
- Respetá `prefers-reduced-motion`.
- Acciones primarias pueden ser sticky dentro del contenido móvil solo si no tapan información ni navegación.

VENTANAS FLOTANTES
Creá overlays únicamente cuando mejoren una acción real. Reutilizá un Dialog/Popover accesible si existe; no inventes uno por pantalla.

Necesarias dentro de estas tandas:
- confirmación antes de cancelar o rechazar una solicitud/trabajo;
- confirmación de envío de review si la operación existe;
- visor de imágenes;
- selector de fecha/franja si corresponde;
- información de integración pendiente para pagos, sin formulario de cobro.

No crees todavía modal real de Mercado Pago, devolución, reclamo persistente ni chat funcional.

METODOLOGÍA OBLIGATORIA POR TANDA
1. Revisá la ruta, componentes actuales, tipos y tests.
2. Declará intención, paleta, profundidad, superficies, tipografía y espaciado.
3. Escribí primero pruebas de comportamiento o contratos que fallen.
4. Implementá la mínima base compartida necesaria.
5. Implementá las páginas de la tanda.
6. Ejecutá pruebas relevantes, typecheck y lint de archivos tocados.
7. Probá visualmente todas las rutas de la tanda en mobile y desktop.
8. Revisá teclado, focus, loading, empty, error y not-found.
9. Ejecutá `git diff --check` y revisá que no haya cambios en navegación.
10. Entregá el checkpoint y DETENETE. No empieces la tanda siguiente sin aprobación.

FORMATO DE CHECKPOINT
TANDA:
RUTAS COMPLETADAS:
COMPONENTES REUTILIZADOS:
COMPONENTES CREADOS O EXTENDIDOS:
ARCHIVOS MODIFICADOS:
PRUEBAS AGREGADAS:
COMANDOS EJECUTADOS:
RESULTADOS REALES:
VALIDACIÓN MOBILE/DESKTOP:
VALIDACIÓN DE ACCESIBILIDAD:
PUNTOS DE PAGO DIFERIDOS DETECTADOS:
PENDIENTES FUNCIONALES:
RIESGOS:
LISTO PARA REVISIÓN: SÍ/NO

Si una verificación falla, no declares la tanda completa. Diagnosticá la causa, informá el bloqueo y conservá el alcance.

==================================================
TANDA 0 — BASE COMPARTIDA Y CONTRATOS
==================================================

OBJETIVO
Preparar la base reutilizable sin rediseñar todavía todas las rutas.

ACCIONES
- Inventariá componentes existentes y relacionálos con CMP-001 a CMP-028 y CMP-073 a CMP-080.
- Detectá duplicados entre `components/business`, `components/dashboard` y `components/pro/ui`.
- Definí view models Cliente tipados para requests, jobs, equipment, maintenance, warranty y payments.
- Aislá fixtures existentes; no los importes desde componentes presentacionales nuevos.
- Consolidá `PageIntro`, estados, banners, métricas, acciones, empty/loading/error y dialog/popover reutilizable.
- Verificá que `AppShell` siga siendo el único responsable del layout global.
- Escribí pruebas de que páginas Cliente no renderizan un segundo `nav`, sidebar o topbar.

CRITERIO DE SALIDA
Existe una base compartida probada, sin duplicados evidentes ni cambios en navegación. Detenete y entregá checkpoint.

==================================================
TANDA 1 — PANEL, PERFIL Y DIRECCIONES
==================================================

RUTAS
- CUS-01 `/app`
- CUS-13 `/app/perfil`
- CUS-14 `/app/direcciones`

COMPONENTES PRINCIPALES
CMP-019, CMP-020, CMP-022, CMP-024, CMP-025, CMP-054, CMP-055, CMP-056, CMP-057, CMP-080, más formularios Cliente auditados.

PANEL
- Hero/saludo de contenido, sin navegación duplicada.
- Acciones “Solicitar servicio” y “Ver trabajos”.
- Métricas con significado: trabajo activo, equipos, mantenimiento y garantías.
- Servicio activo con técnico y ETA cuando exista.
- Equipos compactos, soporte y accesos rápidos.
- Estado de cliente nuevo sin trabajos ni equipos.

PERFIL Y DIRECCIONES
- Formularios accesibles, responsive y tipados.
- Estados pristine/dirty/invalid/pending/error/success.
- Si guardar todavía no persiste, no mostrar success; dejar acción deshabilitada o aviso de integración pendiente.
- Condiciones de acceso estructuradas para dirección, no un único texto libre si ya existen tipos.

CRITERIO DE SALIDA
Las tres rutas funcionan visualmente, no prometen guardado inexistente y pasan verificaciones. Detenete.

==================================================
TANDA 2 — SOLICITAR Y MIS SOLICITUDES
==================================================

RUTAS
- CUS-02 `/app/solicitar/aire-acondicionado`
- CUS-03 `/app/solicitudes`
- CUS-04 `/app/solicitudes/[id]`

COMPONENTES PRINCIPALES
CMP-007, CMP-013 a CMP-019, CMP-026, CMP-028, CMP-036, CMP-040, CMP-063 a CMP-072 y `CustomerRequestSummaryCard`.

WIZARD
- Conservar cálculos y navegación que ya funcionan.
- Mejorar selección de falla, preguntas, diagnóstico, dirección, horario, presupuesto, media y matching con CMP.
- Upload muestra selección/previews y límites, pero no finge URL firmada ni subida completada.
- Presupuesto preliminar puede calcularse.
- Paso de pago usa `PaymentDeferredPanel`; no cambia estado a pagado.
- Matching y técnico confirmado solo pueden ser demo explícita o estado informativo hasta existir operación real.

LISTADO Y DETALLE
- Filtros/estados, importe, dirección y siguiente paso.
- Resolver `[id]` correctamente; not-found si no existe.
- Mostrar diagnóstico, opciones de precio, timeline y matching sin fingir persistencia.

CRITERIO DE SALIDA
Las tres rutas y los 10 pasos visuales son coherentes; los límites de backend se comunican honestamente. Detenete.

==================================================
TANDA 3 — TRABAJOS, SEGUIMIENTO Y REVIEW
==================================================

RUTAS
- CUS-05 `/app/trabajos`
- CUS-06 `/app/trabajos/[id]`
- CUS-07 `/app/trabajos/[id]/review`

COMPONENTES PRINCIPALES
CMP-002, CMP-009, CMP-014 a CMP-019, CMP-037 a CMP-045, CMP-055, CMP-056, CMP-072, CMP-079, CMP-080 y `CustomerReviewForm`.

LISTADO
- Tabs activos/finalizados/por confirmar con conteos.
- Tarjetas Cliente con estado, técnico/equipo, horario y próximo paso.
- Empty state por filtro.

DETALLE
- Resumen, tracker de ocho etapas, transparencia, técnico, ETA y contenido de etapa.
- Comparación de diagnóstico y cambio de presupuesto cuando corresponda.
- Aprobación solo si existe callback/acción real; de lo contrario, estado deshabilitado claramente indicado.
- Chat y tracking son superficies visuales, no servicios inventados.

REVIEW
- Calificaciones accesibles por teclado, resolución, comentario y validación.
- No aceptar doble envío.
- Si no existe persistencia, permitir completar el formulario pero mantener envío deshabilitado con explicación.

CRITERIO DE SALIDA
Las tres rutas cubren todos los estados visuales y no ejecutan transiciones falsas. Detenete.

==================================================
TANDA 4 — EQUIPOS Y MANTENIMIENTOS
==================================================

RUTAS
- CUS-08 `/app/equipos`
- CUS-09 `/app/equipos/[id]`
- CUS-10 `/app/mantenimientos`

COMPONENTES PRINCIPALES
CMP-012, CMP-019, CMP-022, CMP-024, CMP-028, CMP-057, CMP-058, CMP-062 y CMP-076.

CONTENIDO
- Inventario con métricas, estado, imagen/fallback, mantenimiento e historial.
- Detalle con ficha técnica, ubicación, servicios, garantía y próxima recomendación.
- Resolver `[id]` y not-found correctamente.
- Educación sobre mantenimiento seguida de recordatorios accionables.
- Estados sin equipo, sin imagen, sin historial, vencido y sin recomendación.

CRITERIO DE SALIDA
Las tres rutas comparten componentes y muestran correctamente datos incompletos. Detenete.

==================================================
TANDA 5 — GARANTÍAS Y CALIDAD
==================================================

RUTA
- CUS-11 `/app/garantias`

COMPONENTES PRINCIPALES
CMP-002, CMP-008, CMP-015 a CMP-019, CMP-023, CMP-053, CMP-060, CMP-061 y CMP-078.

CONTENIDO
- Hero de respaldo, beneficios, tabs, casos de garantía, seguimiento de calidad y reconocimiento.
- Timeline comprensible sin color.
- Empty state cuando no hay casos.
- Modal de nuevo reclamo solo si existe una operación real; si no, CTA deshabilitado con integración pendiente.
- No mostrar notas administrativas privadas.

CRITERIO DE SALIDA
La ruta queda visualmente completa y segura sin registrar reclamos ficticios. Detenete.

==================================================
TANDA 6 — PAGOS DIFERIDOS Y HANDOFF
==================================================

RUTA Y SUPERFICIES
- CUS-12 `/app/pagos`
- Paso de pago CUS-02.
- CTAs financieros en solicitudes, trabajos y garantías.

COMPONENTES PRINCIPALES
CMP-003, CMP-005, CMP-010, CMP-015 a CMP-019, CMP-024, CMP-059, CMP-073, CMP-075, CMP-077, CMP-080 y `PaymentDeferredPanel`.

CONTENIDO
- Pantalla visualmente terminada con introducción, respaldo, integración pendiente, proceso y ayuda.
- Empty state financiero por defecto; no poblar movimientos falsos.
- Si se usa fixture para revisión visual, rotularlo “Vista de demostración” y mantenerlo fuera de producción.
- Botones pagar/reintentar/devolver/comprobante permanecen deshabilitados.
- Crear `docs/integrations/mercadopago-ui-touchpoints.md` con todos los puntos futuros.
- Verificar que ninguna llamada real o mock cambie estados de dominio por pago.

CRITERIO DE SALIDA
El lugar de Mercado Pago queda visible, centralizado, documentado e inactivo. No existe ningún cobro o aprobación simulada. Detenete y entregá checkpoint final.

==================================================
VERIFICACIÓN FINAL DESPUÉS DE APROBAR TODAS LAS TANDAS
==================================================

- Confirmá las 14 rutas.
- Ejecutá lint, typecheck, unit/domain tests y build.
- Ejecutá E2E visual de navegación y estados, excluyendo cobro real.
- Verificá que sidebar/topbar no hayan sido modificados por las tandas.
- Confirmá que no existan imports productivos nuevos desde `lib/mock/lysto-data`.
- Confirmá que `[id]` no use siempre el primer registro.
- Confirmá que todos los puntos de Mercado Pago estén centralizados y documentados.
- Entregá un informe final de rutas completas, límites reales y etapa recomendada siguiente.
```

## Resultado esperado

Este prompt no autoriza implementar todas las tandas de una vez. Cada ejecución debe completar una tanda, entregar el checkpoint y esperar aprobación explícita para continuar.
