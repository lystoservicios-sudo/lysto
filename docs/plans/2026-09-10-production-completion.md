# Lysto Production Completion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
>
> Para cualquier agente: usar la guía instalada equivalente `executing-plans`, leer las instrucciones del repositorio y ejecutar este documento por dependencias. El usuario ya eligió ejecutarlo con su propio agente; no volver a pedirle que elija modalidad de ejecución.

**Goal:** Completar, verificar y poner en operación Lysto con clientes, profesionales y operadores reales, y entregar una aplicación mantenible con capacidad demostrada de recuperación.

**Architecture:** Mantener Next.js como aplicación modular y Supabase como autoridad de identidad, persistencia, permisos y transacciones. Reutilizar presupuestos, funciones SQL y ledger de Mercado Pago existentes; conectar las interfaces al mismo núcleo, completar las excepciones y retirar rutas de demostración. Incorporar un worker durable, controles de release y procedimientos operativos sin una reescritura ni microservicios adicionales.

**Tech Stack:** TypeScript, Next.js App Router, React, Supabase Auth/PostgreSQL/RLS/Storage, Mercado Pago OAuth/checkout/webhooks, paquete local mercadopago-split, pnpm, Vitest, pruebas de dominio, pgTAP y Playwright. Confirmar versiones efectivas en T00/T02.

---

Fecha de referencia: 10 de septiembre de 2026, Buenos Aires. Plan basado en el directorio auditado, que contiene cambios sin commit sobre `6bbabd3`; no basta con clonar ese HEAD.

**Estado de este documento: plan pendiente de ejecución.** Crear este plan no cambia el dictamen de no producción. Los resultados de la auditoría son evidencia de diagnóstico y deben renovarse para el candidato que se publique.

## 1. Paquete de ejecución y precedencia

- [Auditoría y evidencia original](E:/Proyectos/GitHub/Lysto/docs/audits/2026-09-10-cto-production-readiness.md).
- [Contratos, decisiones, inventario y pruebas de aceptación](E:/Proyectos/GitHub/Lysto/docs/plans/2026-09-10-production-acceptance.md).
- [Registro de avance inicial, dependencias y gates](E:/Proyectos/GitHub/Lysto/docs/plans/2026-09-10-production-progress.json).
- [Instrucción lista para entregar al agente](E:/Proyectos/GitHub/Lysto/prompts/production-completion-agent.md).

Las instrucciones actuales del usuario prevalecen sobre este plan. Después rigen las decisiones aprobadas D01–D12, este plan y su anexo. Los documentos antiguos sirven como contexto; no pueden restaurar el flujo descartado de pago antes de asignación ni declarar listas capacidades sin evidencia. Si el código cambió desde la auditoría, verificar el hallazgo y cerrar sólo el trabajo demostrado; no reconstruir una función que ya existe.

## 2. Qué significa terminar

| Hito | Estado permitido | Condición verificable |
|---|---|---|
| M0 | BASELINE_CAPTURED | T00 y entorno inventariado; trabajo previo preservado |
| M1 | CORE_INTEGRATED | Flujo completo persistente, acceso real, dinero y excepciones conectados |
| M2 | TECHNICALLY_READY | G01–G13 vigentes para candidato identificado; todavía no autoriza operación comercial |
| M3 | PILOT_READY / PILOT_ENABLED | G01–G15, aceptación staging/proveedor, políticas, operadores, configuración y autorización de activación |
| M4 | GENERAL_PRODUCTION_READY | G01–G16: piloto real satisfactorio y traspaso de mantenimiento |

No usar un porcentaje global de pantallas o tareas como autorización. El contador de tareas mide avance de trabajo; los gates deciden habilitación. El piloto también es producción real: requiere seguridad, dinero y atención completos.

**Bloqueantes de salida:** acceso indebido; aislamiento roto; dinero o beneficiario incorrectos; doble cobro/devolución; pérdida de evidencia; éxito sin persistencia; migración/restore no demostrado; incidentes sin atención; pruebas críticas ausentes; discrepancias monetarias sin explicar; requisito comercial o proveedor pendiente.

**Prioridades:** P0 = incidente de seguridad/dinero/pérdida o exposición activa, contener inmediatamente; P1 = capacidad obligatoria o gate ausente, no lanzar; P2 = mejora que no afecta operación comprometida, sólo diferible con riesgo/alcance aprobado. No reclasificar como P2 una función visible que sigue simulada.

## 3. Alcance funcional que debe quedar operable

El cliente puede crear y recuperar su cuenta, mantener domicilio/equipo, solicitar un servicio, aceptar presupuesto y adicionales, pagar, seguir estados, confirmar sin obligación de reseñar, consultar comprobante/historial y obtener soporte o garantía.

El profesional invitado puede completar alta, recibir aprobación, conectar su cuenta de cobro, administrar disponibilidad, aceptar/rechazar trabajo, ejecutar visita y diagnóstico, presentar adicionales y evidencia, cerrar técnicamente, consultar liquidación y pedir soporte desde un teléfono.

Operaciones puede administrar demanda/capacidad, revisar precios, asignar y reprogramar, resolver ausencias, cancelaciones y reclamos, gestionar comunicación y turnos. Finanzas puede conciliar y tramitar devoluciones sin dar esos permisos a todos los operadores. Calidad tiene los datos y permisos necesarios para casos y garantías.

El equipo técnico puede reproducir builds y base de datos, desplegar una versión trazable, detectar incidentes, detener nuevas operaciones, recuperar datos y archivos, rotar claves y continuar el trabajo sin depender del contexto de un solo agente.

Lo opcional se trata en D12. No se crea IA, optimización automática, sistema de cursos o mensajería compleja sólo para justificar pantallas existentes: implementar la capacidad comprometida o retirar explícitamente su oferta con aprobación de alcance. Nunca ocultar de ese modo autenticación, cobro, cierre, soporte o recuperación.

## 4. Reglas para el agente ejecutor

1. **Preservar línea base.** Revisar estado Git antes de modificar. No reset/clean, no borrado recursivo de carpetas ajenas, no sobrescribir cambios del usuario ni agregar todo indiscriminadamente. Una rama/worktree debe incluir los cambios auditados aún no comprometidos.
2. **Empezar local y aislado.** Toda siembra, reset, pgTAP destructivo o test con fixtures se ejecuta en DB descartable allowlisted. Verificar proyecto, URL, entorno y conexiones antes de mutaciones. Producción nunca sirve como entorno de pruebas.
3. **Permisos desde servidor.** Actor y rol vienen de sesión verificada y perfil vigente; propiedad y estado se consultan en DB. RLS, servicios y handlers deben concordar. Middleware, botones y un UUID válido no bastan.
4. **Integridad al mutar.** Transacciones para cambios internos relacionados; control de versión/bloqueo y clave de idempotencia en operaciones repetibles. Un efecto externo se coordina con intentos persistidos, outbox o ledger; no se asume transacción distribuida.
5. **No inventar éxito.** `202` requiere operación duradera identificable; `200/201` requiere resultado real o cálculo explícito. Los estados inciertos de proveedor siguen pendientes de reconciliación.
6. **Reutilizar antes de duplicar.** Las rutas nuevas propuestas son ubicaciones de implementación; si ya existe un servicio equivalente, reutilizarlo y registrar el cambio de ruta en el plan/inventario. No mantener dos motores de pagos o estados.
7. **Migraciones incrementales.** Generar identificador mediante CLI instalada, nunca modificar una migración ya aplicada para arreglar producción. Los nombres de migración por tarea son etiquetas, no filenames existentes. Usar expand/contract, backfill y comprobación; reducción destructiva sólo tras compatibilidad y autorización pertinente.
8. **Secretos y privacidad.** Inventariar nombres y custodios; no copiar valores, cookies, datos reales o tokens a Git, evidencias o prompts. Usar cuentas de prueba para test.
9. **Autonomía con límites concretos.** Completar código, tests, configuración revisable y documentación autorizados. No solicitar permiso para pasos rutinarios. Si falta decisión comercial/acceso/aceptación externa, registrar dependencia y avanzar otras tareas; no inventar aprobación ni enviar mensajes/cobros reales sin autorización.
10. **Documentar desviaciones.** Registrar archivo, razón, impacto, regresión y decisión. No convertir limitaciones de sandbox o falta de acceso en pass.
11. **Cierre basado en evidencia.** `implemented` no equivale a `verified`. No dejar pruebas omitidas en verde ni eliminar pruebas fallidas para pasar CI.
12. **Lectura de código.** Si existe `.codegraph/`, usar CodeGraph según AGENTS; si no, no indexar por iniciativa propia. Aplicar skills de Supabase, pruebas, depuración y verificación cuando corresponda.

## 5. Método repetible por tarea y por sesión

Cada Txx es un paquete de resultado. Sus pasos funcionales se descomponen en ciclos cortos; no implementar todo el paquete antes de comprobarlo.

1. Leer los archivos indicados, dependencias y casos negativos del anexo; registrar discrepancias.
2. Elegir una invariante concreta y escribir su prueba en el archivo especificado. En trabajos documentales/externos, preparar el checklist/evidencia equivalente.
3. Ejecutar sólo esa prueba y observar el fallo esperado por la carencia real; un error de entorno no demuestra el fallo funcional.
4. Implementar el mínimo cambio de dominio/DB/servicio/UI necesario, manteniendo responsabilidades existentes.
5. Repetir prueba positiva y negativa con DB real cuando haya permisos o persistencia; incluir carrera/reintento en operaciones monetarias o de estado.
6. Ejecutar las regresiones del módulo. Antes de cerrar el paquete ejecutar sus comandos y los checks afectados de calidad; no repetir pruebas amplias sin cambio o riesgo nuevo.
7. Revisar diff y secretos; crear commit local acotado cuando corresponda a la autorización de ejecución; registrar evidencia, siguiente paso y rollback.
8. Actualizar el JSON de avance y el log. Tomar siguiente tarea desbloqueada. Si una decisión externa falta, dejarla pending y continuar trabajo independiente.

Al comenzar otra sesión: leer instrucciones, estos cuatro archivos, registro de decisiones, estado Git y último checkpoint. Verificar que commit/entorno coinciden antes de reutilizar evidencia. Al cerrar una sesión: registrar archivos cambiados, último test real, fallas, dependencias externas y comando/paso siguiente. No marcar completo por agotarse contexto.

Los archivos “modificar” pueden existir ahora o ser creados por una dependencia anterior. Las rutas “crear” son propuestas concretas; no se afirma que existan hoy. Los comandos corren desde `E:/Proyectos/GitHub/Lysto`, con secretos inyectados por mecanismo seguro y sin imprimirlos.

## 6. Dependencias y programación del trabajo

El orden recomendado se genera de dependencias. No es una instrucción para crear agentes paralelos. T24 (entrega), T30 (controles) y T33 (CI) empiezan tan pronto se desbloquean y se amplían con cada módulo; no postergar calidad hasta el final.

**Secuencia disponible:** T00 → T01 → T02 → T03 → T04 → T05 → T06 → T33 → T07 → T10 → T12 → T08 → T13 → T09 → T11 → T14 → T24 → T15 → T16 → T17 → T18 → T19 → T30 → T20 → T32 → T21 → T22 → T23 → T25 → T26 → T27 → T28 → T29 → T31 → T35 → T34 → T36 → T37 → T38 → T39.

| Ola | Resultado | Tareas principales |
|---|---|---|
| A | Base, decisiones, dependencias, DB y pruebas | T00–T05, inicio T33 |
| B | Acceso, cuentas, permisos y datos privados | T06–T13, inicio T24 |
| C | Presupuesto, capacidad, asignación y dinero | T14–T18 |
| D | Visita, cierre, conformidad y posventa | T19–T25 |
| E | Todas las interfaces y contratos reales | T26–T29 |
| F | Operación, recuperación y aceptación | T30–T36, según dependencias |
| G | Activación, piloto y mantenimiento | T37–T39 |

No se fija una fecha comercial sin D01–D11. El tamaño de las tareas no es uniforme. Tras T04 y T05, el agente debe estimar cada paquete por esfuerzo, incertidumbre y dependencia externa, proponer calendario con responsables y actualizarlo con velocidad observada. El tiempo del piloto y la aprobación de terceros no se comprimen afirmando que el código está terminado.

## 7. Trazabilidad de la auditoría

| Hallazgo | Resultado exigido | Tareas |
|---|---|---|
| B01 | Acceso y autorización uniformes | T06,T08,T09,T26,T30,T34 |
| B02 | Ciclo de cuenta e invitación real | T07,T08,T11,T31 |
| B03 | Pantallas conectadas a datos reales | T05,T12–T16,T25–T29,T34 |
| B04 | Servicio completo y excepciones | T05,T18–T21,T23,T34 |
| B05 | Comprobante real y privado por diseño | T22,T34 |
| B06 | APIs sin éxito simulado | T06,T13–T26,T34 |
| B07 | Dependencias y controles técnicos | T02,T17,T30,T33 |
| B08 | Cobro, devoluciones y aceptación comercial | T01,T14,T16–T18,T35–T38 |
| B09 | Fotos, notificaciones y posventa | T10,T20,T23–T25,T30–T32 |
| B10 | Reproducibilidad, operación y mantenimiento | T00–T04,T30–T39 |

## 8. Paquetes de implementación

### T00 — Consolidar la línea base sin perder trabajo existente

**Responsable:** Agente técnico. **Depende de:** ninguna. **Auditoría:** B10.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [package.json](E:/Proyectos/GitHub/Lysto/package.json)
- [pnpm-lock.yaml](E:/Proyectos/GitHub/Lysto/pnpm-lock.yaml)
- [.gitignore](E:/Proyectos/GitHub/Lysto/.gitignore)
- [README.md](E:/Proyectos/GitHub/Lysto/README.md)

**Crear:**

- [docs/release/baseline.md](E:/Proyectos/GitHub/Lysto/docs/release/baseline.md)
- [docs/release/change-log.md](E:/Proyectos/GitHub/Lysto/docs/release/change-log.md)

**Pasos de implementación:**

1. Leer AGENTS.md y la auditoría. Si aparece .codegraph, usar CodeGraph antes de localizar código; no indexar por iniciativa propia.
2. Registrar rama, HEAD, git status, diff y archivos no rastreados. Conservar las nuevas migraciones, módulos de precios/pagos y vendor que todavía no están en HEAD. Excluir secretos, logs, adjuntos y carpetas .next de cualquier snapshot versionado.
3. Preparar una rama codex/production-readiness desde el estado de trabajo consolidado. Si el agente usa worktree, incluir previamente los cambios relevantes: partir sólo del HEAD de agosto perdería el avance auditado. No hacer reset/clean ni sobrescribir trabajo ajeno.
4. Registrar versiones Node/pnpm/Supabase y hashes de lockfile, migraciones y paquete vendor. Inventariar destinos y credenciales por nombre, sin copiar valores al informe.
5. Ejecutar lint, typecheck, test y build en directorio aislado; guardar resultados con fecha y commit/snapshot. Registrar fallas como baseline, sin corregirlas ocultamente ni declarar pass por evidencia anterior.
6. Preparar commit local de la línea base revisada si está dentro de la autorización de ejecución; nunca git add de todo el directorio sin inspección. Registrar archivos preservados y pendientes.

**Verificación específica:**

- `git status --short --branch`
- `corepack pnpm lint`
- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm build`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Existe un snapshot recuperable que incluye todo el sistema auditado y un inventario verificable de sus fallas. Ningún secreto o artefacto de build queda versionado.

**Recuperación / rollback:** Volver al snapshot de la tarea; preservar diffs del agente. No revertir cambios preexistentes del usuario.

**Evidencia que debe guardar:** baseline.md; estado Git; versiones y logs de gates.


### T01 — Registrar decisiones y dependencias externas del lanzamiento

**Responsable:** Agente + dirección/operaciones/finanzas. **Depende de:** T00. **Auditoría:** B02, B08, B09, B10.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [.env.example](E:/Proyectos/GitHub/Lysto/.env.example)
- [docs/mercadopago-split.md](E:/Proyectos/GitHub/Lysto/docs/mercadopago-split.md)
- [docs/pricing-operations.md](E:/Proyectos/GitHub/Lysto/docs/pricing-operations.md)

**Crear:**

- [docs/release/decision-register.md](E:/Proyectos/GitHub/Lysto/docs/release/decision-register.md)
- [docs/release/environment-register.md](E:/Proyectos/GitHub/Lysto/docs/release/environment-register.md)

**Pasos de implementación:**

1. Crear el registro D01–D12 definido en el anexo de aceptación; estado inicial pending salvo evidencia vigente del responsable.
2. Identificar proveedor de hosting ya usado, proyecto Supabase de staging/producción, dominio, repositorio remoto y responsables. Conservar el proveedor actual si soporta Node/pg/Prisma; no migrar a Railway, Vercel o Cloudflare por una mención antigua.
3. Preparar la lista concreta de credenciales, callback URLs y permisos por entorno. Verificar presencia y alcance mediante canales seguros, sin volcarlos en Git o logs.
4. Acordar recorrido comercial vigente: presupuesto revisado → aceptación cliente → asignación/aceptación técnico → cobro → visita. Señalar documentación antigua que cobra antes de asignar para actualizarla en T05/T31.
5. Proponer valores de trabajo para cupo, cobertura, horarios, soporte, tiempos de recuperación y costos; etiquetarlos como hipótesis y permitir configuración. No presentar importes o textos legales propuestos como aprobados.
6. Solicitar al responsable sólo las decisiones faltantes que afecten trabajo dependiente. Continuar las tareas locales independientes y mantener gates externos pendientes.

**Verificación específica:**

- Revisión del registro D01–D12 contra el anexo; cada fila tiene responsable, fecha objetivo, evidencia y tareas afectadas.

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Ninguna dependencia externa está implícita. El agente puede continuar trabajo técnico y conoce qué evidencia necesita para cada autorización de salida.

**Recuperación / rollback:** Mantener historial de decisiones sustituidas; no borrar ni cambiar decisiones aprobadas sin registrar su reemplazo.

**Evidencia que debe guardar:** decision-register.md y environment-register.md sin secretos.


### T02 — Actualizar dependencias y verificar cadena de suministro

**Responsable:** Agente técnico. **Depende de:** T00. **Auditoría:** B07, B10.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [package.json](E:/Proyectos/GitHub/Lysto/package.json)
- [pnpm-lock.yaml](E:/Proyectos/GitHub/Lysto/pnpm-lock.yaml)
- [next.config.ts](E:/Proyectos/GitHub/Lysto/next.config.ts)
- [eslint.config.mjs](E:/Proyectos/GitHub/Lysto/eslint.config.mjs)
- [vendor/waltergaltieri-mercadopago-split-0.1.0.tgz](E:/Proyectos/GitHub/Lysto/vendor/waltergaltieri-mercadopago-split-0.1.0.tgz)

**Crear:**

- [docs/release/dependency-review.md](E:/Proyectos/GitHub/Lysto/docs/release/dependency-review.md)

**Pasos de implementación:**

1. Reejecutar audit productivo y revisar los avisos oficiales actuales. No fijar una versión por memoria: 15.5.24 era la corrección conocida en la auditoría, no una promesa de vigencia futura.
2. Añadir una comprobación de instalación limpia en Linux para el paquete vendor y su cliente Prisma. Revisar licencia, procedencia, hash, contenido distribuido y motor runtime; registrar cómo reconstruir el tarball desde el commit documentado.
3. Actualizar Next y dependencias transitivas afectadas dentro de versiones compatibles; alinear eslint-config-next. Evitar overrides que oculten incompatibilidades; demostrar carga y ejecución del módulo de pagos.
4. Actualizar Supabase SSR si su tipado exige casts por desalineación; verificar adapter de cookies y login con pruebas existentes. No cambiar arquitectura sólo para eliminar una advertencia.
5. Instalar desde lockfile en checkout limpio Linux y Windows cuando aplique. Ejecutar pruebas/build y audit de nuevo.
6. Registrar vulnerabilidades residuales con superficie, mitigación, dueño y vencimiento. Cualquier crítico/alto aplicable bloquea release; no usar flags para ignorar el audit.

**Verificación específica:**

- `corepack pnpm install --frozen-lockfile`
- `corepack pnpm audit --prod`
- `corepack pnpm test`
- `corepack pnpm lint`
- `corepack pnpm typecheck`
- `corepack pnpm build`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Instalación y build reproducibles; cero avisos críticos/altos aplicables sin resolver; paquete de pagos utilizable en el runtime de destino.

**Recuperación / rollback:** Revertir sólo el commit de dependencias y lockfile juntos; mantener salida pública bloqueada si reaparece el riesgo.

**Evidencia que debe guardar:** Audit nuevo, revisión de advisories, licencia/hash del vendor y logs de instalación Linux.


### T03 — Reproducir esquema completo y reconciliar migraciones

**Responsable:** Agente de backend. **Depende de:** T00. **Auditoría:** B10.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [supabase/config.toml](E:/Proyectos/GitHub/Lysto/supabase/config.toml)
- [supabase/seed.sql](E:/Proyectos/GitHub/Lysto/supabase/seed.sql)
- [lib/supabase/database.types.ts](E:/Proyectos/GitHub/Lysto/lib/supabase/database.types.ts)
- [supabase/migrations/20260910195050_service_quotes_and_onsite_extras.sql](E:/Proyectos/GitHub/Lysto/supabase/migrations/20260910195050_service_quotes_and_onsite_extras.sql)
- [supabase/migrations/20260910204604_marketplace_split_checkout.sql](E:/Proyectos/GitHub/Lysto/supabase/migrations/20260910204604_marketplace_split_checkout.sql)
- [supabase/migrations/20260910220000_marketplace_guards.sql](E:/Proyectos/GitHub/Lysto/supabase/migrations/20260910220000_marketplace_guards.sql)

**Crear:**

- [docs/release/database-migration-runbook.md](E:/Proyectos/GitHub/Lysto/docs/release/database-migration-runbook.md)

**Migración nueva:** etiqueta `baseline_reconciliation, sólo si el diff demuestra una corrección necesaria`. Generar timestamp con CLI y registrar filename real; aplicar protocolo T03.

**Pasos de implementación:**

1. Descubrir comandos con supabase --help, db --help y migration --help. Leer historial local y esquema; comparar SQL efectivo, roles, funciones, triggers, índices y permisos, no sólo nombres de tablas.
2. Crear un entorno Supabase descartable con project_id y puertos propios fuera de la base de trabajo. Verificar identidad/host explícitamente antes de resetear exclusivamente ese entorno.
3. Aplicar todas las migraciones en orden desde cero y seed de prueba. La base existente sólo registra agosto aunque tenga objetos de septiembre: no ejecutar migration repair a ciegas.
4. Si el arranque limpio falla, corregir mediante migración nueva o corrección documentada de archivos aún no desplegados tras comprobar historial de todos los entornos. No modificar migraciones ya publicadas para esconder drift.
5. Regenerar tipos desde el esquema verificado, ejecutar pgTAP completo y advisors/lint disponibles. Revisar RLS de todas las tablas y vistas, permisos del esquema private y accesibilidad de tokens OAuth.
6. Ensayar upgrade desde snapshot anterior en otra base descartable. Documentar orden, compatibilidad, duración, verificación posterior y recuperación; conservar evidencia de esquema e historial convergentes.

**Verificación específica:**

- `corepack pnpm exec supabase --help`
- `corepack pnpm exec supabase db --help`
- `corepack pnpm exec supabase migration --help`
- `corepack pnpm exec supabase test db --local (desde el proyecto descartable configurado)`
- `corepack pnpm typecheck`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Instalación desde cero y actualización desde versión anterior pasan; historial y esquema son consistentes; no se tocó destructivamente la base de trabajo/remota.

**Recuperación / rollback:** Descartar sólo el entorno creado para la prueba. En entornos persistentes, recuperar según runbook; nunca bajar migraciones con pérdida de pagos.

**Evidencia que debe guardar:** Logs de reset/upgrade, inventario RLS, historial completo, diff y tipos generados.


### T04 — Preparar pruebas integrales con identidades y datos aislados

**Responsable:** Agente + QA. **Depende de:** T02, T03. **Auditoría:** B01, B08, B10.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [package.json](E:/Proyectos/GitHub/Lysto/package.json)
- [vitest.config.ts](E:/Proyectos/GitHub/Lysto/vitest.config.ts)
- [playwright.config.ts](E:/Proyectos/GitHub/Lysto/playwright.config.ts)
- [tests/unit/marketplace-ledger.vitest.test.ts](E:/Proyectos/GitHub/Lysto/tests/unit/marketplace-ledger.vitest.test.ts)
- [tests/unit/marketplace-storage.vitest.test.ts](E:/Proyectos/GitHub/Lysto/tests/unit/marketplace-storage.vitest.test.ts)

**Crear:**

- [vitest.integration.config.ts](E:/Proyectos/GitHub/Lysto/vitest.integration.config.ts)
- [scripts/test-integration.mjs](E:/Proyectos/GitHub/Lysto/scripts/test-integration.mjs)
- [tests/integration/fixtures.ts](E:/Proyectos/GitHub/Lysto/tests/integration/fixtures.ts)
- [tests/integration/fixture-safety.test.ts](E:/Proyectos/GitHub/Lysto/tests/integration/fixture-safety.test.ts)
- [tests/e2e/fixtures/accounts.ts](E:/Proyectos/GitHub/Lysto/tests/e2e/fixtures/accounts.ts)
- [docs/release/test-environments.md](E:/Proyectos/GitHub/Lysto/docs/release/test-environments.md)

**Pasos de implementación:**

1. Crear tests rojos del guard de entorno: rechazar host no permitido, proyecto productivo, variables faltantes y ejecución de fixtures sin identidad explícita.
2. Crear fixtures sintéticos de dos clientes, dos profesionales (aprobado/suspendido), operador operations, finance, quality y owner. Generar sesiones mediante Auth de prueba y usar sus JWT en pruebas RLS, nunca service_role como sustituto del usuario.
3. Crear script test:integration que exige DB/URL de entorno descartable y ejecuta Vitest con environment node. Añadir tests/integration/**/*.test.ts e incluir los ocho tests DB de marketplace sin duplicar su conteo.
4. Usar rollback o IDs únicos por corrida y limpieza acotada. Configurar Mailpit/Inbucket o buzón sandbox para invitaciones/recuperación; prohibir envíos a clientes y proveedor live en fixtures.
5. Unificar host/puerto/baseURL de Playwright y webServer; soportar build de producción local aislado para pruebas de release. Exigir browsers Chromium y WebKit en CI.
6. Comprobar una prueba negativa real: usuario B no lee A. Hacer que la suite falle si no hay tests, falta la base o se omiten pruebas obligatorias; corregir advertencias act en pruebas asíncronas afectadas.

**Verificación específica:**

- `corepack pnpm test:integration (script que se crea en esta tarea)`
- `corepack pnpm exec vitest run marketplace`
- `corepack pnpm exec playwright test --list`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Fixtures repetibles, sin datos productivos; integración obligatoria no queda verde por skip; pruebas con roles auténticos.

**Recuperación / rollback:** Revertir harness sin borrar fixtures de otras corridas; conservar base de prueba identificada hasta analizar fallas.

**Evidencia que debe guardar:** Inventario de cuentas sintéticas, salida de guard negativo y suite DB ejecutada.


### T05 — Definir un solo contrato de servicio y sus invariantes

**Responsable:** Agente de backend + operaciones. **Depende de:** T01, T03. **Auditoría:** B03, B04, B06, B08.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [lib/domain/types.ts](E:/Proyectos/GitHub/Lysto/lib/domain/types.ts)
- [lib/domain/state-machine.ts](E:/Proyectos/GitHub/Lysto/lib/domain/state-machine.ts)
- [lib/jobs/workflow.ts](E:/Proyectos/GitHub/Lysto/lib/jobs/workflow.ts)
- [lib/application/service-operations.ts](E:/Proyectos/GitHub/Lysto/lib/application/service-operations.ts)
- [lib/workflows/service-lifecycle.ts](E:/Proyectos/GitHub/Lysto/lib/workflows/service-lifecycle.ts)
- [lib/use-cases/customer-request.ts](E:/Proyectos/GitHub/Lysto/lib/use-cases/customer-request.ts)
- [lib/use-cases/payment-flow.ts](E:/Proyectos/GitHub/Lysto/lib/use-cases/payment-flow.ts)
- [docs/02-user-flows.md](E:/Proyectos/GitHub/Lysto/docs/02-user-flows.md)
- [tests/run-domain-tests.ts](E:/Proyectos/GitHub/Lysto/tests/run-domain-tests.ts)

**Crear:**

- [docs/architecture/service-lifecycle.md](E:/Proyectos/GitHub/Lysto/docs/architecture/service-lifecycle.md)
- [lib/domain/job-status-labels.ts](E:/Proyectos/GitHub/Lysto/lib/domain/job-status-labels.ts)
- [tests/domain/production-lifecycle.test.ts](E:/Proyectos/GitHub/Lysto/tests/domain/production-lifecycle.test.ts)

**Pasos de implementación:**

1. Escribir tabla estado/evento/actor/precondición/efecto para solicitud, presupuesto, trabajo, pago, adicional, reclamo y garantía. Usar el contrato normativo del anexo.
2. Agregar tests de las transiciones nuevas y negativas: técnico confirmado sin pago no inicia visita; devolución/contracargo no se oculta como cobro; presupuesto aceptado es inmutable; cierre no equivale a reseña.
3. Resolver explícitamente inconsistencias entre flujo antiguo de pago-antes-asignación y el actual. Usar functions SQL transaccionales como autoridad de mutación; TypeScript refleja capacidades, no inventa un estado desde el navegador.
4. Preservar estado canónico del proveedor separado de proyección payments. Mostrar charged_back/review aunque payments tenga una proyección failed; documentar qué proyección manda en cada decisión.
5. Extraer etiquetas fuera de lib/mock y adaptar consumidores. Mantener lógica pura útil; retirar simuladores de caminos de producción y actualizar tests que codificaban el flujo viejo.
6. Registrar ADR y mapa de funciones reutilizadas/sustituidas. No hacer refactor masivo fuera del circuito crítico.
7. Registrar el nuevo archivo de pruebas de dominio en tests/run-domain-tests.ts; verificar que el contador aumenta y que quitar una invariante rompe la prueba. Este runner no descubre todos los archivos automáticamente.

**Verificación específica:**

- `corepack pnpm test:domain`
- `corepack pnpm exec vitest run marketplace-contract`
- `corepack pnpm exec supabase test db --local`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Una tabla de estados acordada rige UI, API y DB; no hay dos fuentes contradictorias para autorización o integridad monetaria.

**Recuperación / rollback:** Revertir adapters/etiquetas; cambios SQL siguen protocolo expand/contract de T03.

**Evidencia que debe guardar:** ADR, tablas de transición y tests negativos nuevos.


### T06 — Centralizar sesión, roles y protección del servidor

**Responsable:** Agente de backend. **Depende de:** T04, T05. **Auditoría:** B01, B06.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [middleware.ts](E:/Proyectos/GitHub/Lysto/middleware.ts)
- [lib/supabase/server.ts](E:/Proyectos/GitHub/Lysto/lib/supabase/server.ts)
- [lib/auth/session-routing.ts](E:/Proyectos/GitHub/Lysto/lib/auth/session-routing.ts)
- [lib/permissions/roles.ts](E:/Proyectos/GitHub/Lysto/lib/permissions/roles.ts)
- [lib/pricing/server.ts](E:/Proyectos/GitHub/Lysto/lib/pricing/server.ts)
- [lib/payments/marketplace-session.ts](E:/Proyectos/GitHub/Lysto/lib/payments/marketplace-session.ts)
- [app/(customer)/app/layout.tsx](E:/Proyectos/GitHub/Lysto/app/(customer)/app/layout.tsx)
- [app/(professional)/pro/layout.tsx](E:/Proyectos/GitHub/Lysto/app/(professional)/pro/layout.tsx)
- [app/(admin)/admin/layout.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/layout.tsx)

**Crear:**

- [lib/auth/session.ts](E:/Proyectos/GitHub/Lysto/lib/auth/session.ts)
- [lib/http/api-error.ts](E:/Proyectos/GitHub/Lysto/lib/http/api-error.ts)
- [lib/http/route-handler.ts](E:/Proyectos/GitHub/Lysto/lib/http/route-handler.ts)
- [tests/unit/session.vitest.test.ts](E:/Proyectos/GitHub/Lysto/tests/unit/session.vitest.test.ts)
- [tests/integration/access-control.test.ts](E:/Proyectos/GitHub/Lysto/tests/integration/access-control.test.ts)

**Pasos de implementación:**

1. Escribir primero pruebas HTTP anónimas de los tres paneles y cada endpoint privado; verificar además acceso horizontal y permisos insuficientes.
2. Crear requireSession/requireRole/requireAdminPermission server-only. Resolver usuario confiable y perfil vigente; no confiar en user_metadata, IDs de actor del body o rol visual. Diferenciar 401,403,404 y no filtrar existencia ajena.
3. Aplicar controles próximos a cada lectura/mutación, además de navegación/layout. El middleware refresca cookies con el API SSR compatible; no es la única barrera.
4. Consolidar helpers de precios/pagos sobre el mismo contrato; preservar autorización financiera específica y ownership de checkout cuando se accede por PostgreSQL directo.
5. Bloquear endpoints parciales detrás de denegación explícita mientras se implementan; mantener públicos sólo registro/login/callback/onboarding restringido y comprobante validado. Callback OAuth y webhook conservan controles propios.
6. Probar sesiones expiradas, doble pestaña, redirecciones locales permitidas y URLs externas rechazadas. Verificar headers/cache para que HTML/API privados nunca se compartan entre usuarios.

**Verificación específica:**

- `corepack pnpm exec vitest run session`
- `corepack pnpm test:integration -- access-control`
- `corepack pnpm exec playwright test auth-access (archivo agregado en T34; hasta entonces ejecutar pruebas HTTP de integración)`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Todos los accesos privados requieren sesión vigente y permiso/propiedad adecuados; ningún panel se basa sólo en su rol visual.

**Recuperación / rollback:** Mantener deny-by-default; no reabrir middleware permisivo para recuperar una pantalla.

**Evidencia que debe guardar:** Matriz 401/403/404 y de aislamiento por rol/recurso.


### T07 — Completar registro, verificación, recuperación y logout

**Responsable:** Agente full stack. **Depende de:** T06. **Auditoría:** B02.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [app/(auth)/registro/page.tsx](E:/Proyectos/GitHub/Lysto/app/(auth)/registro/page.tsx)
- [app/(auth)/login/actions.ts](E:/Proyectos/GitHub/Lysto/app/(auth)/login/actions.ts)
- [app/(auth)/login/login-form.tsx](E:/Proyectos/GitHub/Lysto/app/(auth)/login/login-form.tsx)
- [lib/auth/login.ts](E:/Proyectos/GitHub/Lysto/lib/auth/login.ts)
- [lib/auth/onboarding-access.ts](E:/Proyectos/GitHub/Lysto/lib/auth/onboarding-access.ts)
- [components/layout/app-topbar.tsx](E:/Proyectos/GitHub/Lysto/components/layout/app-topbar.tsx)
- [supabase/config.toml](E:/Proyectos/GitHub/Lysto/supabase/config.toml)

**Crear:**

- [app/(auth)/registro/actions.ts](E:/Proyectos/GitHub/Lysto/app/(auth)/registro/actions.ts)
- [app/(auth)/recuperar/page.tsx](E:/Proyectos/GitHub/Lysto/app/(auth)/recuperar/page.tsx)
- [app/(auth)/restablecer/page.tsx](E:/Proyectos/GitHub/Lysto/app/(auth)/restablecer/page.tsx)
- [app/auth/confirm/route.ts](E:/Proyectos/GitHub/Lysto/app/auth/confirm/route.ts)
- [app/auth/logout/route.ts](E:/Proyectos/GitHub/Lysto/app/auth/logout/route.ts)
- [tests/unit/account-lifecycle.vitest.test.ts](E:/Proyectos/GitHub/Lysto/tests/unit/account-lifecycle.vitest.test.ts)
- [tests/integration/account-lifecycle.test.ts](E:/Proyectos/GitHub/Lysto/tests/integration/account-lifecycle.test.ts)

**Migración nueva:** etiqueta `customer_account_bootstrap`. Generar timestamp con CLI y registrar filename real; aplicar protocolo T03.

**Pasos de implementación:**

1. Escribir tests de alta válida, email duplicado, verificación pendiente, token vencido/reutilizado, recuperación genérica y logout real.
2. Conectar formulario con validación servidor, términos versionados y Supabase Auth. Crear perfil/customer_profile idempotentemente con rol customer asignado por código confiable; raw_user_meta_data nunca elige admin/pro.
3. Resolver onboarding de cuentas Auth sin perfil tras fallas parciales mediante operación idempotente de bootstrap/reparación. No crear una cuenta distinta al reintentar.
4. Implementar confirmación de email y recuperación por allowlist de redirects, sesiones apropiadas y expiración. Mensajes públicos no revelan existencia de un email.
5. Implementar logout como mutación protegida que invalida sesión/cookies pertinentes; actualizar navegación con identidad real y probar salida en navegación posterior.
6. Configurar SMTP de Auth en staging cuando esté disponible; probar entrega, enlaces ante scanner de email y expiración con buzón sandbox. No marcar entrega real por mock.

**Verificación específica:**

- `corepack pnpm exec vitest run account-lifecycle`
- `corepack pnpm test:integration -- account-lifecycle`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Cliente nuevo puede verificar su cuenta, ingresar, recuperar acceso y salir; no hay cuentas sin perfil operable ni escalamiento de rol.

**Recuperación / rollback:** Deshabilitar nuevas altas si falla bootstrap; preservar cuentas existentes y repararlas idempotentemente.

**Evidencia que debe guardar:** Recorrido con buzón sandbox y tests de tokens/reintentos.


### T08 — MFA administrativo y revocación efectiva de accesos

**Responsable:** Agente de backend + titular de cuentas. **Depende de:** T06, T07. **Auditoría:** B01, B02, B10.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [lib/auth/session.ts](E:/Proyectos/GitHub/Lysto/lib/auth/session.ts)
- [lib/payments/marketplace-session.ts](E:/Proyectos/GitHub/Lysto/lib/payments/marketplace-session.ts)
- [app/(admin)/admin/layout.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/layout.tsx)

**Crear:**

- [app/(auth)/seguridad/page.tsx](E:/Proyectos/GitHub/Lysto/app/(auth)/seguridad/page.tsx)
- [lib/auth/admin-assurance.ts](E:/Proyectos/GitHub/Lysto/lib/auth/admin-assurance.ts)
- [tests/integration/session-revocation.test.ts](E:/Proyectos/GitHub/Lysto/tests/integration/session-revocation.test.ts)
- [docs/runbooks/account-recovery.md](E:/Proyectos/GitHub/Lysto/docs/runbooks/account-recovery.md)

**Migración nueva:** etiqueta `session_assurance_and_revocation`. Generar timestamp con CLI y registrar filename real; aplicar protocolo T03.

**Pasos de implementación:**

1. Agregar pruebas de admin con aal1, admin aal2, rol retirado con JWT antiguo y profesional suspendido con sesión aún vigente.
2. Exigir nivel MFA suficiente a administración y operaciones financieras tanto en API como en funciones SQL/lecturas directas relevantes. Consultar documentación vigente de Supabase MFA.
3. Diseñar revocación inmediata para mutaciones sensibles apoyada en perfil/permiso vigente y estado de sesión o security-version confiable. Eliminar un usuario o cambiar app_metadata no invalida por sí solo todo JWT existente.
4. Implementar suspensión que detiene nuevos trabajos, bloquea comandos y genera alerta de trabajos activos a operaciones. No desconectar automáticamente OAuth con historial ni impedir conciliación.
5. Preparar recuperación de administrador sin un bypass público permanente, dos responsables de acceso a infraestructura y códigos de recuperación custodiados por el titular.
6. Validar cierre/revocación en otra pestaña y JWT aún no expirado. Registrar eventos sin tokens, OTP ni secretos MFA.

**Verificación específica:**

- `corepack pnpm test:integration -- session-revocation`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** MFA se exige en servidor y cambios de permisos tienen efecto en operaciones sensibles sin esperar pasivamente al vencimiento del JWT.

**Recuperación / rollback:** Recuperación por procedimiento autenticado y auditado; no desactivar MFA global para resolver un caso individual.

**Evidencia que debe guardar:** Pruebas con JWT antiguo y acta de recuperación administrativa.


### T09 — Administrar permisos y dejar auditoría confiable

**Responsable:** Agente de backend. **Depende de:** T06, T08. **Auditoría:** B01, B02, B06, B10.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [lib/admin/audit.ts](E:/Proyectos/GitHub/Lysto/lib/admin/audit.ts)
- [lib/admin/audit-events.ts](E:/Proyectos/GitHub/Lysto/lib/admin/audit-events.ts)
- [app/(admin)/admin/auditoria/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/auditoria/page.tsx)
- [app/(admin)/admin/configuracion/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/configuracion/page.tsx)

**Crear:**

- [lib/admin/permissions-service.ts](E:/Proyectos/GitHub/Lysto/lib/admin/permissions-service.ts)
- [app/api/admin/permissions/route.ts](E:/Proyectos/GitHub/Lysto/app/api/admin/permissions/route.ts)
- [tests/integration/admin-permissions.test.ts](E:/Proyectos/GitHub/Lysto/tests/integration/admin-permissions.test.ts)

**Migración nueva:** etiqueta `admin_permission_and_audit_workflows`. Generar timestamp con CLI y registrar filename real; aplicar protocolo T03.

**Pasos de implementación:**

1. Escribir tests de operations, finance, quality, owner y usuario sin permiso. Mantener enum actual; no introducir un superadmin paralelo sin necesidad.
2. Reutilizar private.admin_profile_permissions y helpers confiables. Sólo owner gestiona privilegios, con control para no dejar la organización sin un acceso de recuperación autorizado.
3. Persistir actor, acción, entidad, motivo y cambios permitidos antes/después dentro de la transacción de cada mutación administrativa.
4. Evitar que authenticated inserte eventos atribuidos a otro actor, cambie o borre auditoría. Implementar consulta paginada según permiso.
5. Separar campos privados de soporte/finanzas de la vista del cliente/técnico. Aplicar redacción a documentos, tokens y datos personales en auditoría.
6. Probar permiso retirado durante una operación y error de insert de auditoría: la mutación administrativa crítica debe revertirse.

**Verificación específica:**

- `corepack pnpm test:integration -- admin-permissions`
- `corepack pnpm exec supabase test db --local`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Menor privilegio real y eventos atribuibles, atómicos y resistentes a manipulación por los roles de aplicación.

**Recuperación / rollback:** Revertir UI nueva manteniendo permisos restrictivos y eventos ya escritos.

**Evidencia que debe guardar:** Matriz de permisos efectiva y prueba de rollback de auditoría.


### T10 — Subir, inspeccionar y consultar evidencia privada

**Responsable:** Agente full stack. **Depende de:** T03, T04, T06. **Auditoría:** B09, B04.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [lib/uploads/validation.ts](E:/Proyectos/GitHub/Lysto/lib/uploads/validation.ts)
- [app/api/uploads/sign/route.ts](E:/Proyectos/GitHub/Lysto/app/api/uploads/sign/route.ts)
- [components/customer/media-uploader.tsx](E:/Proyectos/GitHub/Lysto/components/customer/media-uploader.tsx)
- [supabase/migrations/202608190006_storage_buckets.sql](E:/Proyectos/GitHub/Lysto/supabase/migrations/202608190006_storage_buckets.sql)

**Crear:**

- [lib/uploads/service.ts](E:/Proyectos/GitHub/Lysto/lib/uploads/service.ts)
- [lib/uploads/inspection.ts](E:/Proyectos/GitHub/Lysto/lib/uploads/inspection.ts)
- [app/api/uploads/finalize/route.ts](E:/Proyectos/GitHub/Lysto/app/api/uploads/finalize/route.ts)
- [app/api/uploads/read/route.ts](E:/Proyectos/GitHub/Lysto/app/api/uploads/read/route.ts)
- [tests/integration/private-uploads.test.ts](E:/Proyectos/GitHub/Lysto/tests/integration/private-uploads.test.ts)

**Migración nueva:** etiqueta `upload_intents_and_verified_attachments`. Generar timestamp con CLI y registrar filename real; aplicar protocolo T03.

**Pasos de implementación:**

1. Crear tests rojos: dueño ajeno, MIME falso, tamaño excedido, archivo vacío, token vencido, path traversal, archivos no finalizados y acceso tras suspensión.
2. Crear intención de upload con UUID generado en servidor, owner derivado de sesión, entidad autorizada, tamaño/hash esperado y vencimiento. Para solicitud aún no creada usar borrador/presupuesto propio persistente; no aceptar ownerId arbitrario.
3. Subir directamente a bucket privado con URL acotada. Reutilizar límites actuales por tipo. No servir el original como público ni confiar en extensión o Content-Type.
4. Finalizar verificando bytes/firma y tamaño real; decodificar imágenes con librería corregida. Mantener PDF/video en cuarentena hasta inspección apropiada o limitar tipos explícitamente hasta disponer de validación. Inspección fallida nunca genera evidencia válida.
5. Vincular sólo adjuntos verificados a informe/onboarding/solicitud con controles SQL. Emitir URLs de lectura breves tras verificar permiso; neutralizar nombres activos y contenido inline riesgoso.
6. Agregar limpieza de intenciones vencidas y huérfanos con ventana de gracia y retención aprobada; no borrar evidencia de reclamos o pagos en disputa. Probar reintento de finalización sin duplicar registro.

**Verificación específica:**

- `corepack pnpm test:integration -- private-uploads`
- `corepack pnpm exec supabase test db --local`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Las fotos seleccionadas quedan realmente almacenadas y vinculadas; ningún participante ajeno accede y ningún archivo no inspeccionado cuenta como evidencia.

**Recuperación / rollback:** Desactivar nuevas subidas, conservar objetos y relaciones existentes; no hacer públicos los buckets.

**Evidencia que debe guardar:** Pruebas de contenido/permisos y registros de upload/finalización.


### T11 — Invitación, onboarding, aprobación y suspensión de profesionales

**Responsable:** Agente full stack + responsable de profesionales. **Depende de:** T07, T09, T10. **Auditoría:** B02, B09.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [app/api/admin/invite-professional/route.ts](E:/Proyectos/GitHub/Lysto/app/api/admin/invite-professional/route.ts)
- [app/api/professional/onboarding/route.ts](E:/Proyectos/GitHub/Lysto/app/api/professional/onboarding/route.ts)
- [app/api/admin/professionals/approve/route.ts](E:/Proyectos/GitHub/Lysto/app/api/admin/professionals/approve/route.ts)
- [app/(professional)/pro/onboarding/[token]/page.tsx](E:/Proyectos/GitHub/Lysto/app/(professional)/pro/onboarding/[token]/page.tsx)
- [components/pro/pro-account.tsx](E:/Proyectos/GitHub/Lysto/components/pro/pro-account.tsx)
- [lib/professional/onboarding.ts](E:/Proyectos/GitHub/Lysto/lib/professional/onboarding.ts)

**Crear:**

- [lib/professional/onboarding-service.ts](E:/Proyectos/GitHub/Lysto/lib/professional/onboarding-service.ts)
- [tests/integration/professional-onboarding.test.ts](E:/Proyectos/GitHub/Lysto/tests/integration/professional-onboarding.test.ts)

**Migración nueva:** etiqueta `professional_invitation_lifecycle`. Generar timestamp con CLI y registrar filename real; aplicar protocolo T03.

**Pasos de implementación:**

1. Probar invitación válida, vencida, reutilizada, cancelada, email distinto, documentos incompletos y autoaprobación.
2. Persistir hash de token aleatorio de un solo uso y vencimiento; guardar en outbox el evento de invitación de forma transaccional. El worker se activa en T24: antes la tarea acredita persistencia, no entrega.
3. Permitir acceso limitado a onboarding validando token y vínculo de identidad. No resolver la excepción eliminando toda protección de /pro.
4. Guardar formulario, herramientas, especialidades, zonas y documentos privados. Permitir correcciones con estados de revisión claros; no marcar aprobación por haber terminado el formulario.
5. Conectar aprobación/rechazo/suspensión mediante RPC con operations/owner, motivos y auditoría. Mantener bloqueo de recepción de trabajos y cobros para perfiles no elegibles.
6. Registrar responsable de verificación humana y vigencia documental. No inventar matrícula, seguro ni consentimiento. Verificar el recorrido con envío sandbox cuando T24 esté disponible.

**Verificación específica:**

- `corepack pnpm test:integration -- professional-onboarding`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Un profesional invitado llega a aprobado sólo tras revisión autorizada; token/documentos/estados persisten y una suspensión se aplica efectivamente.

**Recuperación / rollback:** Cancelar nuevas invitaciones, conservar postulaciones y documentos; reenviar sólo tras conciliar estado del token.

**Evidencia que debe guardar:** Ciclo completo de invitación y casos negativos; entrega externa cerrada con T24/T36.


### T12 — Repositorios y modelos de lectura sin datos ficticios

**Responsable:** Agente full stack. **Depende de:** T05, T06. **Auditoría:** B03, B06.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [lib/data-access/contracts.ts](E:/Proyectos/GitHub/Lysto/lib/data-access/contracts.ts)
- [lib/data-access/supabase/repository.ts](E:/Proyectos/GitHub/Lysto/lib/data-access/supabase/repository.ts)
- [features/customer/view-models.ts](E:/Proyectos/GitHub/Lysto/features/customer/view-models.ts)
- [features/customer/dashboard-view-model.ts](E:/Proyectos/GitHub/Lysto/features/customer/dashboard-view-model.ts)
- [components/pro/pro-model.ts](E:/Proyectos/GitHub/Lysto/components/pro/pro-model.ts)
- [components/admin/admin-model.ts](E:/Proyectos/GitHub/Lysto/components/admin/admin-model.ts)

**Crear:**

- [lib/data-access/customer-queries.ts](E:/Proyectos/GitHub/Lysto/lib/data-access/customer-queries.ts)
- [lib/data-access/professional-queries.ts](E:/Proyectos/GitHub/Lysto/lib/data-access/professional-queries.ts)
- [lib/data-access/admin-queries.ts](E:/Proyectos/GitHub/Lysto/lib/data-access/admin-queries.ts)
- [lib/data-access/pagination.ts](E:/Proyectos/GitHub/Lysto/lib/data-access/pagination.ts)
- [tests/integration/read-models.test.ts](E:/Proyectos/GitHub/Lysto/tests/integration/read-models.test.ts)

**Pasos de implementación:**

1. Definir DTO explícito por rol para solicitudes, trabajos, pagos, equipos, profesionales, reclamos y métricas; inventariar campos sensibles que nunca llegan al navegador ajeno.
2. Agregar tests de filas aisladas y paginación con más de 50/100 registros, orden estable por fecha+id y filtros. Verificar que totales y páginas respeten exactamente el mismo permiso.
3. Extender el repositorio real para listas y detalles. Usar RLS con cliente de sesión; reservar acceso privilegiado a casos imprescindibles y probar autorización explícita.
4. Crear cursores opacos validados y pageSize limitado. Añadir índices por ownership/estado/fecha guiados por consultas reales y EXPLAIN, no por intuición.
5. Adaptar view-models puros a DTO reales; sacar fixtures y etiquetas de los imports productivos. No convertir excepciones de base en listas vacías silenciosas.
6. Preparar contrato de error/carga/vacío y invalidación tras mutación; evitar cache compartida de perfiles. Consumidores UI se conectan en T27–T29.

**Verificación específica:**

- `corepack pnpm test:integration -- read-models`
- `corepack pnpm exec vitest run repository-mappers customer-view-models`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Consultas reales paginadas cubren las tres superficies sin exposición horizontal ni pérdidas silenciosas después de la primera página.

**Recuperación / rollback:** Mantener UI bloqueada si el repositorio no está listo; no reintroducir fixtures como fallback de producción.

**Evidencia que debe guardar:** DTOs, EXPLAIN de consultas frecuentes y tests con múltiples usuarios/páginas.


### T13 — Perfiles, direcciones y registro de equipos persistentes

**Responsable:** Agente full stack. **Depende de:** T10, T12. **Auditoría:** B03, B04, B06.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [components/customer/customer-profile-form.tsx](E:/Proyectos/GitHub/Lysto/components/customer/customer-profile-form.tsx)
- [components/customer/customer-address-form.tsx](E:/Proyectos/GitHub/Lysto/components/customer/customer-address-form.tsx)
- [app/(customer)/app/perfil/page.tsx](E:/Proyectos/GitHub/Lysto/app/(customer)/app/perfil/page.tsx)
- [app/(customer)/app/direcciones/page.tsx](E:/Proyectos/GitHub/Lysto/app/(customer)/app/direcciones/page.tsx)
- [app/api/equipment/register/route.ts](E:/Proyectos/GitHub/Lysto/app/api/equipment/register/route.ts)
- [lib/equipment/equipment-registry.ts](E:/Proyectos/GitHub/Lysto/lib/equipment/equipment-registry.ts)

**Crear:**

- [app/api/customer/profile/route.ts](E:/Proyectos/GitHub/Lysto/app/api/customer/profile/route.ts)
- [app/api/customer/addresses/route.ts](E:/Proyectos/GitHub/Lysto/app/api/customer/addresses/route.ts)
- [lib/equipment/service.ts](E:/Proyectos/GitHub/Lysto/lib/equipment/service.ts)
- [tests/integration/customer-assets.test.ts](E:/Proyectos/GitHub/Lysto/tests/integration/customer-assets.test.ts)

**Migración nueva:** etiqueta `customer_assets_workflows`. Generar timestamp con CLI y registrar filename real; aplicar protocolo T03.

**Pasos de implementación:**

1. Probar edición por dueño, cambio de rol prohibido, dirección histórica de presupuesto inmutable y equipo ajeno rechazado.
2. Conectar perfil sólo a campos editables; cambio de email mediante circuito Auth verificado, sin alterar unilateralmente identidad/claims desde profiles.
3. Guardar y seleccionar direcciones reales; eliminar defaults demostrativos del asistente. Conservar snapshot histórico de dirección/costos de cada presupuesto aceptado.
4. Registrar equipo del cliente con relación al trabajo/solicitud, marca/modelo/serie opcional y evidencia. No exigir datos imposibles de obtener ni fusionar equipos de dueños distintos.
5. Definir archivado en lugar de borrado cuando una dirección/equipo está referenciado por servicio, garantía o comprobante; mantener historial navegable.
6. Probar guardado/recarga, cambios simultáneos y error de red sin toast de éxito. Notas privadas del técnico no se copian al perfil público.

**Verificación específica:**

- `corepack pnpm test:integration -- customer-assets`
- `corepack pnpm exec vitest run customer-account-forms customer-equipment`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Datos de cliente/equipo persisten y los snapshots históricos de servicios no cambian al editar un perfil.

**Recuperación / rollback:** Conservar historial y relaciones; revertir formulario/adaptador sin borrar activos.

**Evidencia que debe guardar:** Antes/después/recarga con dos clientes y presupuesto histórico.


### T14 — Cerrar presupuestos, cobertura, tarifas y aceptación

**Responsable:** Agente de backend + finanzas. **Depende de:** T05, T09, T13. **Auditoría:** B03, B08.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [lib/pricing/service-quote.ts](E:/Proyectos/GitHub/Lysto/lib/pricing/service-quote.ts)
- [lib/pricing/google-routes.ts](E:/Proyectos/GitHub/Lysto/lib/pricing/google-routes.ts)
- [lib/pricing/server.ts](E:/Proyectos/GitHub/Lysto/lib/pricing/server.ts)
- [app/api/pricing/quote/route.ts](E:/Proyectos/GitHub/Lysto/app/api/pricing/quote/route.ts)
- [app/api/pricing/quotes/route.ts](E:/Proyectos/GitHub/Lysto/app/api/pricing/quotes/route.ts)
- [app/api/pricing/policy/route.ts](E:/Proyectos/GitHub/Lysto/app/api/pricing/policy/route.ts)
- [app/api/customer/request/submit/route.ts](E:/Proyectos/GitHub/Lysto/app/api/customer/request/submit/route.ts)
- [components/pricing/pricing-calculator.tsx](E:/Proyectos/GitHub/Lysto/components/pricing/pricing-calculator.tsx)
- [features/service-request/air-conditioning-wizard.tsx](E:/Proyectos/GitHub/Lysto/features/service-request/air-conditioning-wizard.tsx)

**Crear:**

- [tests/integration/quote-lifecycle.test.ts](E:/Proyectos/GitHub/Lysto/tests/integration/quote-lifecycle.test.ts)
- [docs/release/pricing-acceptance.md](E:/Proyectos/GitHub/Lysto/docs/release/pricing-acceptance.md)

**Migración nueva:** etiqueta `quote_versioning_and_acceptance_guards`. Generar timestamp con CLI y registrar filename real; aplicar protocolo T03.

**Pasos de implementación:**

1. Probar cotización sin ruta/precio de repuesto, fecha pasada, fuera de cobertura, versión vencida, moneda/decimales inválidos, cambio de tarifa e intento de enviar total desde cliente.
2. Mantener cálculo autoritativo en servidor y revisión con operations; política con finance/owner. Validar coherencia de admin que calcula, revisa y guarda bajo sus permisos reales.
3. Vincular revisiones/nuevas versiones a presupuesto anterior, motivo y cliente para que no aparezcan como cotizaciones inconexas. Versionar fuentes/fechas de costo.
4. Validar material confirmado, peajes y ruta verificada; no ofrecer valores incompletos. Cotización manual debe registrar autor y fundamento, nunca aprobar datos de simulación.
5. Persistir la aceptación idempotente y sus snapshots; volver a leer estado tras timeout. Aplicar redondeo monetario consistente sin errores binarios en ledger.
6. Finanzas valida casos de referencia reales, comisión/recargo/costo del proveedor/neto profesional y fecha de vigencia; crear control para impedir ofrecer tarifas vencidas o no aprobadas.

**Verificación específica:**

- `corepack pnpm exec vitest run service-pricing pricing-api pricing-routes`
- `corepack pnpm test:integration -- quote-lifecycle`
- `corepack pnpm exec supabase test db --local`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Presupuesto ofrecido es completo, revisado, vigente e inmutable tras aceptación; cobro usa ese snapshot y no el body del cliente.

**Recuperación / rollback:** Deshabilitar ofertas nuevas; conservar presupuestos aceptados y sus tarifas; corregir con nueva versión.

**Evidencia que debe guardar:** Casos financieros D05 aprobados y tests de aceptación/reintento.


### T15 — Agenda, capacidad y reprogramación verificables

**Responsable:** Agente backend + operaciones. **Depende de:** T05, T12, T14. **Auditoría:** B03, B04.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [lib/scheduling/availability.ts](E:/Proyectos/GitHub/Lysto/lib/scheduling/availability.ts)
- [lib/scheduling/service-slot.ts](E:/Proyectos/GitHub/Lysto/lib/scheduling/service-slot.ts)
- [app/(professional)/pro/agenda/page.tsx](E:/Proyectos/GitHub/Lysto/app/(professional)/pro/agenda/page.tsx)

**Crear:**

- [lib/scheduling/service.ts](E:/Proyectos/GitHub/Lysto/lib/scheduling/service.ts)
- [app/api/scheduling/availability/route.ts](E:/Proyectos/GitHub/Lysto/app/api/scheduling/availability/route.ts)
- [app/api/jobs/reschedule/route.ts](E:/Proyectos/GitHub/Lysto/app/api/jobs/reschedule/route.ts)
- [tests/integration/scheduling-capacity.test.ts](E:/Proyectos/GitHub/Lysto/tests/integration/scheduling-capacity.test.ts)

**Migración nueva:** etiqueta `scheduling_capacity_and_reschedule`. Generar timestamp con CLI y registrar filename real; aplicar protocolo T03.

**Pasos de implementación:**

1. Definir diferencia entre franja preferida del cliente y visita confirmada. No prometer reserva de técnico antes de verificar capacidad.
2. Crear tests de dos asignaciones concurrentes a una franja, solapamiento, traslado, profesional suspendido y reprogramación simultánea.
3. Reutilizar professional_availability; persistir ventanas/ausencias y duración prevista. Convertir fechas con America/Argentina/Buenos_Aires en bordes; almacenar instantes en UTC y fechas locales de visita explícitas.
4. Proteger reservas mediante transacción/constraint apropiada, duración y buffers configurables. Expirar holds según política aprobada y liberar capacidad por cancelación/rechazo.
5. Implementar reprogramación con motivo, comparación de versión/estado, aprobación pertinente y impacto de presupuesto/ruta/pago; no mutar silenciosamente un alcance ya aceptado.
6. Emitir eventos para las partes; mostrar al operador conflictos y próximos vencimientos. Probar medianoche, días pasados y que una lista limitada no oculte reservas.

**Verificación específica:**

- `corepack pnpm test:integration -- scheduling-capacity`
- `corepack pnpm test:domain`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** No hay doble reserva bajo concurrencia y toda reprogramación deja rastro y condiciones económicas consistentes.

**Recuperación / rollback:** Detener reservas nuevas y coordinar con registro manual auditado; mantener las reservas existentes.

**Evidencia que debe guardar:** Prueba simultánea de capacidad y casos de horario local.


### T16 — Asignación, propuesta y aceptación con recuperación

**Responsable:** Agente backend + operaciones. **Depende de:** T11, T14, T15. **Auditoría:** B03, B04, B06.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [app/api/pricing/offers/route.ts](E:/Proyectos/GitHub/Lysto/app/api/pricing/offers/route.ts)
- [components/pricing/service-offers.tsx](E:/Proyectos/GitHub/Lysto/components/pricing/service-offers.tsx)
- [lib/admin/assignment.ts](E:/Proyectos/GitHub/Lysto/lib/admin/assignment.ts)
- [lib/matching/score-professionals.ts](E:/Proyectos/GitHub/Lysto/lib/matching/score-professionals.ts)
- [lib/data-access/supabase/job-writes.ts](E:/Proyectos/GitHub/Lysto/lib/data-access/supabase/job-writes.ts)

**Crear:**

- [tests/integration/assignment-lifecycle.test.ts](E:/Proyectos/GitHub/Lysto/tests/integration/assignment-lifecycle.test.ts)

**Migración nueva:** etiqueta `assignment_offer_lifecycle`. Generar timestamp con CLI y registrar filename real; aplicar protocolo T03.

**Pasos de implementación:**

1. Probar asignación a técnico no aprobado, sin especialidad/zona/herramientas, doble operador, rechazo, vencimiento y aceptación tardía.
2. Sustituir candidatos mock por consultas autorizadas y restricciones de capacidad. El ranking orienta, pero la transacción vuelve a validar elegibilidad.
3. Reutilizar assign_professional_to_job y professional_respond_to_job; usar actor de sesión y comparar versión. Aceptación repetida debe devolver estado existente, sin duplicar eventos.
4. Persistir propuesta, destinatario, vencimiento y motivo de rechazo. Devolver automáticamente a cola una oferta vencida con evento/outbox idempotente.
5. Mostrar pago pendiente después de aceptación del técnico y bloquear inicio hasta aprobación real. Profesional sin cuenta de pago debe poder vincularla y operaciones ver ese bloqueo.
6. Conservar prohibición de mover destinatario cuando existe checkout. Resolver el caso por T18, no quitando el trigger. Probar dos operadores asignando al mismo tiempo.

**Verificación específica:**

- `corepack pnpm test:integration -- assignment-lifecycle`
- `corepack pnpm exec supabase test db --local`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Asignación y aceptación persistentes, sin sobrescritura concurrente ni técnico inelegible; todas las propuestas tienen una salida.

**Recuperación / rollback:** Pausar asignaciones automáticas/worker; conservar ofertas y resolver su estado antes de reemitir.

**Evidencia que debe guardar:** Pruebas de carrera, vencimiento y elegibilidad.


### T17 — Consolidar OAuth, checkout y ledger de pagos

**Responsable:** Agente backend. **Depende de:** T04, T08, T14, T16. **Auditoría:** B08, B07.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [lib/payments/marketplace.ts](E:/Proyectos/GitHub/Lysto/lib/payments/marketplace.ts)
- [lib/payments/marketplace-db.ts](E:/Proyectos/GitHub/Lysto/lib/payments/marketplace-db.ts)
- [lib/payments/marketplace-ledger.ts](E:/Proyectos/GitHub/Lysto/lib/payments/marketplace-ledger.ts)
- [lib/payments/marketplace-config.ts](E:/Proyectos/GitHub/Lysto/lib/payments/marketplace-config.ts)
- [lib/payments/checkout-contract.ts](E:/Proyectos/GitHub/Lysto/lib/payments/checkout-contract.ts)
- [lib/payments/marketplace-session.ts](E:/Proyectos/GitHub/Lysto/lib/payments/marketplace-session.ts)
- [app/api/mercadopago/webhook/route.ts](E:/Proyectos/GitHub/Lysto/app/api/mercadopago/webhook/route.ts)
- [app/api/mercadopago/create-preference/route.ts](E:/Proyectos/GitHub/Lysto/app/api/mercadopago/create-preference/route.ts)

**Crear:**

- [tests/integration/payment-concurrency.test.ts](E:/Proyectos/GitHub/Lysto/tests/integration/payment-concurrency.test.ts)
- [docs/architecture/payment-invariants.md](E:/Proyectos/GitHub/Lysto/docs/architecture/payment-invariants.md)

**Migración nueva:** etiqueta `payment_reconciliation_guards, sólo para diferencias detectadas`. Generar timestamp con CLI y registrar filename real; aplicar protocolo T03.

**Pasos de implementación:**

1. Conservar los controles ya probados. Añadir casos negativos de cuenta/moneda/ambiente/importe/comisión diferentes, misma idempotency key con otro payload y cambio de destinatario.
2. Ejecutar creación simultánea, timeout después de creación remota y reintento. Persistir identidad/payload antes del llamado externo; un resultado incierto no autoriza una nueva intención cobrable.
3. Verificar firma, validación canónica, eventos duplicados/desordenados y leases del paquete vendor. Registrar evento aplicado sólo junto con efectos atómicos; recibir firma no basta para aprobar dinero.
4. Probar renovación/revocación OAuth, token de ambiente incorrecto, cuenta deshabilitada, conexión DB y protección de secretos. Nunca hacer fallback de sandbox a live.
5. Asegurar que review/charged_back/refunded prevalecen en UI y habilitación de acciones sobre proyecciones simplificadas. Preservar observaciones/eventos, sin reescribir los importes acordados.
6. Revisar pooling, timeouts, límites y llamadas externas dentro de transacciones para evitar bloquear DB durante redes lentas. Mantener pruebas existentes de storage y ledger.

**Verificación específica:**

- `corepack pnpm exec vitest run marketplace`
- `corepack pnpm test:integration -- payment-concurrency`
- `corepack pnpm exec supabase test db --local`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Invariantes monetarias resisten reintento, duplicados y concurrencia. Esto acredita integración local; gate real del proveedor se cierra en T36.

**Recuperación / rollback:** Deshabilitar nuevos checkouts; mantener webhook y conciliación activos. No revertir tablas/eventos financieros con datos.

**Evidencia que debe guardar:** Pruebas de timeout/carrera y esquema del ledger.


### T18 — Operación financiera, devoluciones y sustitución de técnico

**Responsable:** Agente + finanzas/operaciones. **Depende de:** T09, T16, T17. **Auditoría:** B04, B08.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [app/api/mercadopago/checkouts/route.ts](E:/Proyectos/GitHub/Lysto/app/api/mercadopago/checkouts/route.ts)
- [app/(admin)/admin/pagos/split/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/pagos/split/page.tsx)
- [components/payments/payment-panel.tsx](E:/Proyectos/GitHub/Lysto/components/payments/payment-panel.tsx)
- [lib/payments/marketplace-ledger.ts](E:/Proyectos/GitHub/Lysto/lib/payments/marketplace-ledger.ts)

**Crear:**

- [lib/payments/refund-service.ts](E:/Proyectos/GitHub/Lysto/lib/payments/refund-service.ts)
- [app/api/payments/refund-requests/route.ts](E:/Proyectos/GitHub/Lysto/app/api/payments/refund-requests/route.ts)
- [app/api/jobs/cancel/route.ts](E:/Proyectos/GitHub/Lysto/app/api/jobs/cancel/route.ts)
- [tests/integration/financial-exceptions.test.ts](E:/Proyectos/GitHub/Lysto/tests/integration/financial-exceptions.test.ts)
- [docs/runbooks/refunds-and-reassignment.md](E:/Proyectos/GitHub/Lysto/docs/runbooks/refunds-and-reassignment.md)

**Migración nueva:** etiqueta `financial_exception_workflows`. Generar timestamp con CLI y registrar filename real; aplicar protocolo T03.

**Pasos de implementación:**

1. Probar devolución parcial/completa, dos solicitudes concurrentes sobre el mismo saldo, contracargo, pago de estado incierto y cancelación con preferencia aún pagable.
2. Reutilizar private.payment_refund_requests para solicitud/aprobación/monto/motivo/idempotencia. Finanzas ejecuta en proveedor o mediante API autorizada; sólo respuesta canónica verificable marca succeeded. Nunca marcar devuelto por botón manual.
3. Implementar cola financiera paginada de estados inciertos, vencidos, pendientes y discrepantes con último intento, responsable y evidencia. Registrar conciliación, autorización y resolución.
4. Definir sustitución de profesional: bloquear nuevas acciones, reconciliar/cerrar posibilidad de cobro viejo, devolver cuando corresponda y crear servicio reemplazante vinculado con nueva aceptación. No mutar checkout ni beneficiario anterior.
5. Resolver carreras pago-tardío/cancelación/reembolso; si no se puede demostrar que el enlace dejó de ser pagable, mantener revisión y no emitir sustitución cobrable como si no hubiera riesgo.
6. Mostrar al cliente el estado real del reintegro y al técnico los importes bruto/comisión/cargos/neto/ajustes. Probar que operations sin finance no realiza operaciones monetarias.

**Verificación específica:**

- `corepack pnpm test:integration -- financial-exceptions`
- `corepack pnpm exec vitest run marketplace`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Un operador y finanzas pueden resolver cancelación con cobro y reemplazo sin editar SQL, duplicar devoluciones ni alterar destinatarios históricos.

**Recuperación / rollback:** Mantener casos en revisión y detener nuevos cobros; continuar conciliación. Recuperar desde registros canónicos, nunca inventar reversas.

**Evidencia que debe guardar:** Tres expedientes de excepción completos con auditoría y resultado canónico.


### T19 — Trabajo en domicilio, diagnóstico y adicionales

**Responsable:** Agente full stack. **Depende de:** T10, T13, T16, T17. **Auditoría:** B04, B08, B09.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [components/pricing/job-quote-panel.tsx](E:/Proyectos/GitHub/Lysto/components/pricing/job-quote-panel.tsx)
- [components/pro/pro-details.tsx](E:/Proyectos/GitHub/Lysto/components/pro/pro-details.tsx)
- [app/api/pricing/job/status/route.ts](E:/Proyectos/GitHub/Lysto/app/api/pricing/job/status/route.ts)
- [app/api/jobs/extras/route.ts](E:/Proyectos/GitHub/Lysto/app/api/jobs/extras/route.ts)
- [lib/jobs/workflow.ts](E:/Proyectos/GitHub/Lysto/lib/jobs/workflow.ts)

**Crear:**

- [lib/jobs/onsite-service.ts](E:/Proyectos/GitHub/Lysto/lib/jobs/onsite-service.ts)
- [tests/integration/onsite-workflow.test.ts](E:/Proyectos/GitHub/Lysto/tests/integration/onsite-workflow.test.ts)
- [tests/unit/onsite-retry.vitest.test.tsx](E:/Proyectos/GitHub/Lysto/tests/unit/onsite-retry.vitest.test.tsx)

**Migración nueva:** etiqueta `onsite_diagnosis_and_extras_guards`. Generar timestamp con CLI y registrar filename real; aplicar protocolo T03.

**Pasos de implementación:**

1. Agregar pruebas de avance por técnico ajeno, pago no aprobado, conflicto de estado, adicional rechazado y aceptación duplicada.
2. Persistir diagnóstico real y alcance base; diferenciarlo del diagnóstico preliminar. Adjuntar evidencia verificada y equipo del cliente.
3. Conectar inicio/llegada/diagnóstico/trabajo con controles de estado y auditoría. El servidor comprueba condiciones; expectedStatus sólo detecta conflicto, no autoriza.
4. Conservar adicionales separados del presupuesto original, comisión/recargo cero según regla actual y aceptación explícita. Definir en D06 si requieren pago antes de ejecución/cierre; default prudente: no ejecutar adicional sin aceptación y requisito de cobro satisfecho.
5. Persistir clave de reintento de comando de forma segura hasta confirmar resultado; tras timeout consultar estado antes de ofrecer repetir. Borradores locales deben rotularse y no equivaler a trabajo enviado.
6. Probar corte de red y recarga en cada transición/adicional; recuperar desde servidor y nunca anunciar éxito sin acuse.

**Verificación específica:**

- `corepack pnpm test:integration -- onsite-workflow`
- `corepack pnpm exec vitest run onsite-retry`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Técnico y cliente ven el mismo diagnóstico/alcance/estado; adicionales no modifican el original y las acciones se recuperan tras pérdida de red.

**Recuperación / rollback:** Bloquear avances no verificables; conservar borradores y registros persistidos; coordinación con operador registrada.

**Evidencia que debe guardar:** Recorrido base/adicional y prueba de timeout con recarga.


### T20 — Cerrar técnicamente con informe, evidencia e historial

**Responsable:** Agente full stack. **Depende de:** T05, T10, T13, T19. **Auditoría:** B04, B06, B09.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [app/api/jobs/final-report/route.ts](E:/Proyectos/GitHub/Lysto/app/api/jobs/final-report/route.ts)
- [lib/data-access/supabase/job-writes.ts](E:/Proyectos/GitHub/Lysto/lib/data-access/supabase/job-writes.ts)
- [lib/jobs/final-report.ts](E:/Proyectos/GitHub/Lysto/lib/jobs/final-report.ts)
- [components/pro/pro-details.tsx](E:/Proyectos/GitHub/Lysto/components/pro/pro-details.tsx)
- [components/pricing/job-quote-panel.tsx](E:/Proyectos/GitHub/Lysto/components/pricing/job-quote-panel.tsx)

**Crear:**

- [lib/jobs/closeout-service.ts](E:/Proyectos/GitHub/Lysto/lib/jobs/closeout-service.ts)
- [tests/integration/job-closeout.test.ts](E:/Proyectos/GitHub/Lysto/tests/integration/job-closeout.test.ts)

**Migración nueva:** etiqueta `job_closeout_idempotency_and_evidence`. Generar timestamp con CLI y registrar filename real; aplicar protocolo T03.

**Pasos de implementación:**

1. Escribir tests de informe incompleto, equipo ajeno, archivo no verificado, estado inválido, adicional pendiente y doble envío.
2. Reutilizar private.close_job_with_final_report tras revisar su contrato completo; el caller obtiene actor/job reales. Validar diagnóstico, trabajo, materiales, estado final, mantenimiento y evidencia suficiente.
3. Guardar informe, vínculos de archivos, equipment_service_records, recibo y estado pending_customer_confirmation en una transacción; auditar. Si falla cualquier insert, no hay cierre parcial.
4. Separar finished técnico de completed del cliente. Resolver trabajo pendiente de repuesto/segunda visita mediante seguimiento persistente según T05, sin declarar resuelto lo inconcluso.
5. Agregar idempotencia de cierre: reintento igual devuelve informe existente, contenido distinto exige revisión/versión; no overwrite del informe final aceptado.
6. Conectar formulario profesional con respuesta real y recuperación de timeout; demostrar recarga del cliente y del operador con el mismo informe público.

**Verificación específica:**

- `corepack pnpm test:integration -- job-closeout`
- `corepack pnpm exec vitest run professional-workflows`
- `corepack pnpm exec supabase test db --local`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Cierre técnico produce evidencia e historial atómicos y deja conformidad pendiente; no existe accepted:true sin escritura confirmada.

**Recuperación / rollback:** Detener nuevos cierres; preservar informes existentes, corregir por enmienda auditada.

**Evidencia que debe guardar:** Transacción exitosa y prueba de falla intermedia sin registros parciales.


### T21 — Conformidad, disputa y reseña independientes

**Responsable:** Agente full stack. **Depende de:** T20. **Auditoría:** B04, B06.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [app/api/reviews/submit/route.ts](E:/Proyectos/GitHub/Lysto/app/api/reviews/submit/route.ts)
- [components/customer/customer-approval-panel.tsx](E:/Proyectos/GitHub/Lysto/components/customer/customer-approval-panel.tsx)
- [components/customer/customer-review-form.tsx](E:/Proyectos/GitHub/Lysto/components/customer/customer-review-form.tsx)
- [lib/reviews/review.ts](E:/Proyectos/GitHub/Lysto/lib/reviews/review.ts)
- [lib/reviews/recalculate-rating.ts](E:/Proyectos/GitHub/Lysto/lib/reviews/recalculate-rating.ts)
- [app/(customer)/app/trabajos/[id]/review/page.tsx](E:/Proyectos/GitHub/Lysto/app/(customer)/app/trabajos/[id]/review/page.tsx)

**Crear:**

- [app/api/jobs/confirm/route.ts](E:/Proyectos/GitHub/Lysto/app/api/jobs/confirm/route.ts)
- [lib/jobs/customer-confirmation.ts](E:/Proyectos/GitHub/Lysto/lib/jobs/customer-confirmation.ts)
- [tests/integration/customer-closeout.test.ts](E:/Proyectos/GitHub/Lysto/tests/integration/customer-closeout.test.ts)

**Migración nueva:** etiqueta `customer_confirmation_and_review_separation`. Generar timestamp con CLI y registrar filename real; aplicar protocolo T03.

**Pasos de implementación:**

1. Probar dueño ajeno, conformidad repetida, confirmación sin informe, reseña duplicada, desacuerdo y doble pestaña.
2. Crear confirmación explícita sin obligar a dejar rating. Revisar submit_customer_review_transaction que hoy puede completar el trabajo: eliminar el acoplamiento o preservar compatibilidad mediante wrapper seguro sin dos cierres.
3. Derivar trabajo/cliente/técnico de sesión y DB; una reseña no puede cambiar profesional ni pago. Rating con constraints y unicidad por trabajo/cliente.
4. Al abrir desacuerdo crear expediente y mantener estado disputed; no marcar conformidad por timeout sin política aprobada. D06 define escalamiento de falta de respuesta.
5. Recalcular métricas desde trabajos completados y reseñas reales; jobs_completed no debe convertirse en cantidad de reviews. Abrir alerta de calidad idempotente por reseña baja/problema no resuelto.
6. Actualizar UI y avisos para distinguir informe recibido, conformidad pendiente, servicio completado y reseña opcional.

**Verificación específica:**

- `corepack pnpm test:integration -- customer-closeout`
- `corepack pnpm exec vitest run customer-job-pages`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** El cliente confirma o disputa; puede reseñar por separado sin duplicar cierre/alertas ni falsificar métricas.

**Recuperación / rollback:** Conservar decisiones y reviews; no reabrir completados masivamente. Corregir proyecciones desde hechos.

**Evidencia que debe guardar:** Conformidad sin review, review posterior y disputa con caso.


### T22 — Comprobante verificable y publicación mínima

**Responsable:** Agente full stack. **Depende de:** T20, T21. **Auditoría:** B05.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [app/comprobante/[token]/page.tsx](E:/Proyectos/GitHub/Lysto/app/comprobante/[token]/page.tsx)
- [lib/qr/public-receipt.ts](E:/Proyectos/GitHub/Lysto/lib/qr/public-receipt.ts)

**Crear:**

- [lib/receipts/public-receipt-service.ts](E:/Proyectos/GitHub/Lysto/lib/receipts/public-receipt-service.ts)
- [tests/integration/public-receipt.test.ts](E:/Proyectos/GitHub/Lysto/tests/integration/public-receipt.test.ts)

**Migración nueva:** etiqueta `receipt_revocation_and_public_projection, si faltan`. Generar timestamp con CLI y registrar filename real; aplicar protocolo T03.

**Pasos de implementación:**

1. Crear tests de token inventado, mal formado, revocado, de otro recibo, trabajo sin cierre y ausencia de PII privada.
2. Consumir lookup_public_receipt desde servidor con privilegio mínimo y contrato explícito. Validar token antes de consultar; no aceptar datos de servicio desde query/body.
3. Mostrar sólo campos autorizados de servicio/fecha/estado de informe/garantía. No publicar dirección completa, documentos, teléfonos, notas internas o desglose privado de costos.
4. Mostrar pendiente de conformidad cuando corresponda y alcance real de garantía aprobado. Revocación/regeneración sólo por operación auditada; URLs antiguas deben fallar.
5. Aplicar cache compatible con revocación, noindex y rate limit apropiado; token no debe aparecer en logs/analytics públicos ni Referer hacia terceros.
6. Vincular comprobante desde historia real y probar tokens cruzados. D05/D08 definen documento fiscal externo si corresponde; el comprobante de servicio no se presenta como factura.

**Verificación específica:**

- `corepack pnpm test:integration -- public-receipt`
- `corepack pnpm test:domain`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Una URL aleatoria devuelve ausencia; sólo el comprobante verdadero expone una proyección mínima coherente con el cierre.

**Recuperación / rollback:** Deshabilitar página pública mientras se preservan comprobantes privados; nunca volver al contenido fijo.

**Evidencia que debe guardar:** Pruebas de token/revocación y snapshot de campos publicados.


### T23 — Reclamos, garantías, calidad y seguimiento de excepciones

**Responsable:** Agente full stack + soporte/calidad. **Depende de:** T09, T13, T18, T21. **Auditoría:** B04, B06, B09.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [lib/support/cases.ts](E:/Proyectos/GitHub/Lysto/lib/support/cases.ts)
- [lib/warranty/claims.ts](E:/Proyectos/GitHub/Lysto/lib/warranty/claims.ts)
- [app/api/warranty/claim/route.ts](E:/Proyectos/GitHub/Lysto/app/api/warranty/claim/route.ts)
- [app/api/quality/open-case/route.ts](E:/Proyectos/GitHub/Lysto/app/api/quality/open-case/route.ts)
- [components/customer/customer-warranty-center.tsx](E:/Proyectos/GitHub/Lysto/components/customer/customer-warranty-center.tsx)
- [app/(admin)/admin/reclamos/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/reclamos/page.tsx)
- [app/(admin)/admin/garantias/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/garantias/page.tsx)
- [app/(professional)/pro/soporte/page.tsx](E:/Proyectos/GitHub/Lysto/app/(professional)/pro/soporte/page.tsx)

**Crear:**

- [lib/support/service.ts](E:/Proyectos/GitHub/Lysto/lib/support/service.ts)
- [app/api/support/cases/route.ts](E:/Proyectos/GitHub/Lysto/app/api/support/cases/route.ts)
- [app/api/support/cases/[id]/route.ts](E:/Proyectos/GitHub/Lysto/app/api/support/cases/[id]/route.ts)
- [tests/integration/support-warranty.test.ts](E:/Proyectos/GitHub/Lysto/tests/integration/support-warranty.test.ts)

**Migración nueva:** etiqueta `support_case_operations`. Generar timestamp con CLI y registrar filename real; aplicar protocolo T03.

**Pasos de implementación:**

1. Reutilizar complaints, quality_events y warranty_claims según esquema real. Crear relación/case_events sólo donde falte; evitar tres expedientes inconexos para un problema.
2. Probar cliente/técnico ajenos, claim repetido, garantía vencida, fecha límite, reclamo sin garantía y visibilidad de notas internas.
3. Persistir origen, categoría, severidad, responsable, vencimiento, evidencias, cronología y estado. Separar respuesta pública de nota interna y permisos operations/quality/finance.
4. Evaluar cobertura desde cierre/tarifa/fecha de DB; nunca confiar en warrantyDays/completedAt del cliente. Un reclamo fuera de cobertura puede recibirse para soporte sin prometer garantía.
5. Implementar asignación de caso, escalamiento, espera de partes y cierre con motivo. Revisita/garantía genera trabajo vinculado y política de cobro explícita, conservando el servicio original.
6. Registrar plazos efectivos y pausa fuera de horario según D02/D06; no prometer SLA 24/7 por constantes antiguas. Probar reapertura y fallo de comunicación.

**Verificación específica:**

- `corepack pnpm test:integration -- support-warranty`
- `corepack pnpm exec vitest run support-cases customer-warranty`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Soporte resuelve y sigue una incidencia real con responsable/plazos/evidencia; garantías no se conceden ni rechazan sólo por campos del navegador.

**Recuperación / rollback:** Mantener intake y consulta de casos; pausar acciones automáticas y resolver mediante operador con auditoría.

**Evidencia que debe guardar:** Caso normal, reclamo crítico, garantía y revisita trazables.


### T24 — Notificaciones y worker confiable de outbox

**Responsable:** Agente backend. **Depende de:** T03, T06, T09. **Auditoría:** B09, B10.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [lib/notifications/events.ts](E:/Proyectos/GitHub/Lysto/lib/notifications/events.ts)
- [lib/notifications/templates.ts](E:/Proyectos/GitHub/Lysto/lib/notifications/templates.ts)
- [app/api/notifications/emit/route.ts](E:/Proyectos/GitHub/Lysto/app/api/notifications/emit/route.ts)
- [app/(admin)/admin/notificaciones/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/notificaciones/page.tsx)

**Crear:**

- [lib/notifications/worker.ts](E:/Proyectos/GitHub/Lysto/lib/notifications/worker.ts)
- [lib/notifications/provider.ts](E:/Proyectos/GitHub/Lysto/lib/notifications/provider.ts)
- [app/api/internal/outbox/route.ts](E:/Proyectos/GitHub/Lysto/app/api/internal/outbox/route.ts)
- [tests/integration/outbox-worker.test.ts](E:/Proyectos/GitHub/Lysto/tests/integration/outbox-worker.test.ts)
- [docs/runbooks/notification-delivery.md](E:/Proyectos/GitHub/Lysto/docs/runbooks/notification-delivery.md)

**Migración nueva:** etiqueta `domain_outbox_event_wiring`. Generar timestamp con CLI y registrar filename real; aplicar protocolo T03.

**Pasos de implementación:**

1. Escribir tests de dos workers simultáneos, entrega fallida, lease vencido, crash tras envío antes de ack, reintento y dead-letter.
2. Reutilizar claim_outbox_events/ack_outbox_event/fail_outbox_event con token de lease. Producir eventos dentro de transacciones de negocio; no permitir a un cliente elegir libremente destinatarios y mensajes.
3. Implementar in-app y un proveedor transaccional email inicial, con IDs estables y deduplicación compatible con garantías del proveedor. No prometer exactly-once si éste no lo permite; hacer tolerables duplicados residuales y documentarlos.
4. Proteger endpoint worker con identidad de servicio/secret específico, comparación segura, método y límites; configurar scheduler duradero del hosting elegido. No iniciar tareas críticas con promesas sueltas después de responder HTTP.
5. Preparar plantillas de invitación, presupuesto, asignación, pago, visita, conformidad, reclamo y devolución con URLs autorizadas. Configurar SPF/DKIM/DMARC y buzones sandbox según proveedor.
6. Agregar tablero de backlog/fallos/reintento autorizado y alertas. Mantener WhatsApp manual auditado si no se contrata automatización; no afirmar envío por crear template.

**Verificación específica:**

- `corepack pnpm test:integration -- outbox-worker`
- `corepack pnpm exec supabase test db --local`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Evento persistido llega al destinatario de prueba, fallas reintentan y quedan atendibles; scheduler y worker tienen prueba de ejecución real en T36.

**Recuperación / rollback:** Pausar dispatcher manteniendo outbox intacta; reanudar por leases/idempotencia, sin reenviar toda la tabla.

**Evidencia que debe guardar:** Recepción sandbox, pruebas de crash/lease y muestra de dead-letter.


### T25 — Historial, mantenimientos y seguimiento técnico

**Responsable:** Agente full stack. **Depende de:** T13, T20, T23, T24. **Auditoría:** B03, B06, B09.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [lib/equipment/service-record.ts](E:/Proyectos/GitHub/Lysto/lib/equipment/service-record.ts)
- [lib/equipment/maintenance.ts](E:/Proyectos/GitHub/Lysto/lib/equipment/maintenance.ts)
- [lib/customer/maintenance-plan.ts](E:/Proyectos/GitHub/Lysto/lib/customer/maintenance-plan.ts)
- [app/api/maintenance/schedule/route.ts](E:/Proyectos/GitHub/Lysto/app/api/maintenance/schedule/route.ts)
- [components/customer/customer-maintenance-center.tsx](E:/Proyectos/GitHub/Lysto/components/customer/customer-maintenance-center.tsx)
- [app/(customer)/app/mantenimientos/page.tsx](E:/Proyectos/GitHub/Lysto/app/(customer)/app/mantenimientos/page.tsx)

**Crear:**

- [lib/equipment/maintenance-service.ts](E:/Proyectos/GitHub/Lysto/lib/equipment/maintenance-service.ts)
- [tests/integration/maintenance-history.test.ts](E:/Proyectos/GitHub/Lysto/tests/integration/maintenance-history.test.ts)

**Migración nueva:** etiqueta `maintenance_reminder_workflows`. Generar timestamp con CLI y registrar filename real; aplicar protocolo T03.

**Pasos de implementación:**

1. Probar recomendación desde cierre, none, próxima visita por repuesto, fechas futuras/vencidas y recordatorio duplicado.
2. Conectar historial de equipo a informes/casos reales y conservar referencias a servicio/profesional. Sólo anexar/enmendar hechos, sin reescribir informe histórico por editar equipo.
3. Persistir plan y próxima fecha desde regla validada; distinguir recomendación de visita contratada, sin reservar automáticamente ni generar cobro.
4. Crear recordatorios idempotentes con preferencias de contacto y estado de entrega. Si se difiere automatización comercial, ocultarla y conservar plan manual real; su exclusión exige decisión D12 y no elimina historial obligatorio.
5. Permitir al cliente consultar, reprogramar recomendación o iniciar nueva solicitud, reutilizando dirección/equipo con confirmación de datos actuales.
6. Probar recarga, equipos archivados y reclamo abierto: no sugerir mantenimiento que oculte una falla pendiente de garantía.

**Verificación específica:**

- `corepack pnpm test:integration -- maintenance-history`
- `corepack pnpm exec vitest run customer-equipment-pages`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Historia y recomendación reales visibles; no hay recordatorios o visitas ficticias ni doble notificación.

**Recuperación / rollback:** Pausar recordatorios, conservar fechas/historial y tareas de seguimiento.

**Evidencia que debe guardar:** Historial de un equipo con servicio, garantía y siguiente acción.


### T26 — Consolidar y retirar todos los contratos API heredados

**Responsable:** Agente backend. **Depende de:** T06, T11, T14, T16, T18, T19, T20, T21, T23, T24, T25. **Auditoría:** B01, B06.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [app/api/admin/approve-professional/route.ts](E:/Proyectos/GitHub/Lysto/app/api/admin/approve-professional/route.ts)
- [app/api/admin/assign-professional/route.ts](E:/Proyectos/GitHub/Lysto/app/api/admin/assign-professional/route.ts)
- [app/api/admin/pricing/update/route.ts](E:/Proyectos/GitHub/Lysto/app/api/admin/pricing/update/route.ts)
- [app/api/jobs/advance/route.ts](E:/Proyectos/GitHub/Lysto/app/api/jobs/advance/route.ts)
- [app/api/jobs/update-status/route.ts](E:/Proyectos/GitHub/Lysto/app/api/jobs/update-status/route.ts)
- [app/api/pro/jobs/action/route.ts](E:/Proyectos/GitHub/Lysto/app/api/pro/jobs/action/route.ts)
- [app/api/pro/onboarding/evaluate/route.ts](E:/Proyectos/GitHub/Lysto/app/api/pro/onboarding/evaluate/route.ts)
- [app/api/professional/respond-request/route.ts](E:/Proyectos/GitHub/Lysto/app/api/professional/respond-request/route.ts)
- [app/api/payments/webhook/apply/route.ts](E:/Proyectos/GitHub/Lysto/app/api/payments/webhook/apply/route.ts)
- [app/api/service-request/preview/route.ts](E:/Proyectos/GitHub/Lysto/app/api/service-request/preview/route.ts)
- [tests/unit/api-route-contracts.vitest.test.ts](E:/Proyectos/GitHub/Lysto/tests/unit/api-route-contracts.vitest.test.ts)

**Crear:**

- [tests/integration/api-inventory.test.ts](E:/Proyectos/GitHub/Lysto/tests/integration/api-inventory.test.ts)
- [docs/architecture/api-inventory.md](E:/Proyectos/GitHub/Lysto/docs/architecture/api-inventory.md)

**Pasos de implementación:**

1. Aplicar el inventario de las 36 rutas del anexo, registrando destino canónico, auth, método y prueba. Agregar rutas nuevas a la matriz.
2. Para mutaciones duplicadas, usar adapter interno con idénticas validaciones o responder 410; no redirect HTTP ambiguo que pierda body ni handler funcional paralelo.
3. Retirar payment webhook/apply público que acepta estado enviado por cliente; proveedor sólo entra por webhook firmado canónico.
4. Reservar diagnosis/generate como cálculo explícito sin afirmar persistencia y con límites; evaluar onboarding desde servicio interno autorizado, no como autoaprobación.
5. Eliminar respuestas accepted/opened/assigned exitosas si sólo validan. 202 únicamente si existe trabajo duradero en cola identificable; 200/201 requieren resultado persistido o cálculo identificado.
6. Probar métodos no permitidos, JSON inválido, extra fields, tamaño, origen, expiración, dueño ajeno y endpoint retirado. Actualizar pruebas de rutas que antes sólo comprobaban que el archivo existiera.

**Verificación específica:**

- `corepack pnpm test:integration -- api-inventory`
- `corepack pnpm exec vitest run api-route-contracts`
- `corepack pnpm test:domain`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Cada ruta tiene estado final explícito; no queda persistencia pendiente expuesta como éxito ni una vía antigua que saltee autorización.

**Recuperación / rollback:** Revertir adapters puntuales; endpoints inseguros continúan retirados.

**Evidencia que debe guardar:** Inventario completo y suite HTTP por ruta/método.


### T27 — Conectar toda la experiencia del cliente

**Responsable:** Agente full stack. **Depende de:** T07, T12, T13, T14, T18, T21, T22, T23, T25. **Auditoría:** B03, B04, B05.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [app/(customer)/app/page.tsx](E:/Proyectos/GitHub/Lysto/app/(customer)/app/page.tsx)
- [app/(customer)/app/solicitudes/page.tsx](E:/Proyectos/GitHub/Lysto/app/(customer)/app/solicitudes/page.tsx)
- [app/(customer)/app/solicitudes/[id]/page.tsx](E:/Proyectos/GitHub/Lysto/app/(customer)/app/solicitudes/[id]/page.tsx)
- [app/(customer)/app/trabajos/page.tsx](E:/Proyectos/GitHub/Lysto/app/(customer)/app/trabajos/page.tsx)
- [app/(customer)/app/trabajos/[id]/page.tsx](E:/Proyectos/GitHub/Lysto/app/(customer)/app/trabajos/[id]/page.tsx)
- [app/(customer)/app/equipos/page.tsx](E:/Proyectos/GitHub/Lysto/app/(customer)/app/equipos/page.tsx)
- [app/(customer)/app/equipos/[id]/page.tsx](E:/Proyectos/GitHub/Lysto/app/(customer)/app/equipos/[id]/page.tsx)
- [app/(customer)/app/pagos/page.tsx](E:/Proyectos/GitHub/Lysto/app/(customer)/app/pagos/page.tsx)
- [components/customer/customer-dashboard.tsx](E:/Proyectos/GitHub/Lysto/components/customer/customer-dashboard.tsx)
- [components/customer/customer-request-list.tsx](E:/Proyectos/GitHub/Lysto/components/customer/customer-request-list.tsx)
- [components/customer/customer-job-list.tsx](E:/Proyectos/GitHub/Lysto/components/customer/customer-job-list.tsx)
- [features/customer/fixtures/customer-demo-fixtures.ts](E:/Proyectos/GitHub/Lysto/features/customer/fixtures/customer-demo-fixtures.ts)

**Crear:**

- [tests/integration/customer-pages.test.ts](E:/Proyectos/GitHub/Lysto/tests/integration/customer-pages.test.ts)
- [tests/unit/customer-live-model.vitest.test.tsx](E:/Proyectos/GitHub/Lysto/tests/unit/customer-live-model.vitest.test.tsx)

**Pasos de implementación:**

1. Usar el inventario completo de rutas cliente del anexo; añadir tests con usuario sin historial, con operación activa y con error de backend.
2. Conectar dashboard/listas/detalles/equipos/perfil/direcciones/pagos/presupuestos/garantías/mantenimientos a repositorios; ningún route productivo importa fixtures, directa o indirectamente.
3. Eliminar rama UUID-versus-demo y datos iniciales ficticios. Un ID válido sin permiso produce ausencia apropiada, no búsqueda alternativa en mock.
4. Mantener UI existente y adaptar props; mostrar estado real, siguiente acción, responsable/canal y comprobantes verdaderos. Ningún chat/tracking en vivo se anuncia si sólo hay estados.
5. Agregar filtros y cursores, refresco tras mutación, carga/error/vacío y control de botones pendientes. No sumar pagos duplicados por proyecciones distintas.
6. Probar recorrido móvil, navegación por teclado, formularios, reintentos y recarga sin perder operación persistida. Fixtures quedan exclusivamente en tests/demo separado.

**Verificación específica:**

- `corepack pnpm exec vitest run customer-live-model customer-`
- `corepack pnpm test:integration -- customer-pages`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Un cliente ve exclusivamente su historia real y puede completar el circuito sin caer en pantallas demostrativas.

**Recuperación / rollback:** Pausar entradas al módulo afectado; conservar lectura de operaciones existentes y canal de soporte.

**Evidencia que debe guardar:** Inventario cliente completo y recorridos nuevo/recurrente/ajeno.


### T28 — Conectar la experiencia móvil del profesional

**Responsable:** Agente full stack. **Depende de:** T11, T12, T15, T16, T18, T19, T20, T23, T25. **Auditoría:** B02, B03, B04.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [app/(professional)/pro/dashboard/page.tsx](E:/Proyectos/GitHub/Lysto/app/(professional)/pro/dashboard/page.tsx)
- [app/(professional)/pro/agenda/page.tsx](E:/Proyectos/GitHub/Lysto/app/(professional)/pro/agenda/page.tsx)
- [app/(professional)/pro/solicitudes/page.tsx](E:/Proyectos/GitHub/Lysto/app/(professional)/pro/solicitudes/page.tsx)
- [app/(professional)/pro/solicitudes/[id]/page.tsx](E:/Proyectos/GitHub/Lysto/app/(professional)/pro/solicitudes/[id]/page.tsx)
- [app/(professional)/pro/trabajos/page.tsx](E:/Proyectos/GitHub/Lysto/app/(professional)/pro/trabajos/page.tsx)
- [app/(professional)/pro/trabajos/[id]/page.tsx](E:/Proyectos/GitHub/Lysto/app/(professional)/pro/trabajos/[id]/page.tsx)
- [app/(professional)/pro/perfil/page.tsx](E:/Proyectos/GitHub/Lysto/app/(professional)/pro/perfil/page.tsx)
- [app/(professional)/pro/pagos/page.tsx](E:/Proyectos/GitHub/Lysto/app/(professional)/pro/pagos/page.tsx)
- [components/pro/pro-model.ts](E:/Proyectos/GitHub/Lysto/components/pro/pro-model.ts)
- [components/pro/pro-lists.tsx](E:/Proyectos/GitHub/Lysto/components/pro/pro-lists.tsx)
- [components/pro/pro-details.tsx](E:/Proyectos/GitHub/Lysto/components/pro/pro-details.tsx)
- [components/pro/pro-account.tsx](E:/Proyectos/GitHub/Lysto/components/pro/pro-account.tsx)

**Crear:**

- [tests/integration/professional-pages.test.ts](E:/Proyectos/GitHub/Lysto/tests/integration/professional-pages.test.ts)
- [tests/unit/professional-live-model.vitest.test.tsx](E:/Proyectos/GitHub/Lysto/tests/unit/professional-live-model.vitest.test.tsx)

**Pasos de implementación:**

1. Inventariar todas las rutas pro del anexo y sus acciones. Probar técnico sin trabajos, aprobado, suspendido y con caso abierto.
2. Conectar jornada, agenda, propuestas y trabajos a identidad/asignaciones reales; sin technical IDs de otro profesional ni mock fijo como perfil.
3. Integrar documentos/perfil, cuenta Mercado Pago y pagos con importes verdaderos y estados canónicos. Mostrar bloqueo de vinculación/pago sin fingir disponibilidad.
4. Integrar diagnóstico, evidencia, adicionales, informe y soporte. Borradores offline se distinguen de enviados; al volver red, consultar antes de repetir mutaciones.
5. Capacitación: conectar módulos/publicación/cumplimiento si son requisito operativo; si es expansión opcional, retirar navegación/copy mediante D12, sin inventar certificados o cursos completados.
6. Probar uso con una mano, teclado móvil, adjuntos, orientación y regreso de sesión expirada. No prometer GPS/realtime no implementado.

**Verificación específica:**

- `corepack pnpm exec vitest run professional-live-model professional-workflows professional-ui`
- `corepack pnpm test:integration -- professional-pages`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Profesional puede completar una jornada real desde el teléfono y recuperar errores de conexión sin soporte técnico.

**Recuperación / rollback:** Operador coordina trabajos existentes con historial conservado; no mostrar acciones locales como enviadas.

**Evidencia que debe guardar:** Jornada real de prueba y recuperación de red/sesión.


### T29 — Convertir administración en consola operativa completa

**Responsable:** Agente full stack + operadores. **Depende de:** T09, T12, T14, T15, T16, T18, T23, T24, T27, T28. **Auditoría:** B03, B04, B08, B09.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [components/admin/admin-lists.tsx](E:/Proyectos/GitHub/Lysto/components/admin/admin-lists.tsx)
- [components/admin/admin-details.tsx](E:/Proyectos/GitHub/Lysto/components/admin/admin-details.tsx)
- [components/admin/admin-model.ts](E:/Proyectos/GitHub/Lysto/components/admin/admin-model.ts)
- [components/admin/admin-ui.tsx](E:/Proyectos/GitHub/Lysto/components/admin/admin-ui.tsx)
- [app/(admin)/admin/dashboard/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/dashboard/page.tsx)
- [app/(admin)/admin/auditoria/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/auditoria/page.tsx)
- [app/(admin)/admin/reportes/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/reportes/page.tsx)
- [app/(admin)/admin/servicios/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/servicios/page.tsx)
- [app/(admin)/admin/zonas/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/zonas/page.tsx)
- [app/(admin)/admin/diagnostico/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/diagnostico/page.tsx)
- [app/(admin)/admin/configuracion/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/configuracion/page.tsx)

**Crear:**

- [lib/operations/queue-service.ts](E:/Proyectos/GitHub/Lysto/lib/operations/queue-service.ts)
- [tests/integration/admin-operations.test.ts](E:/Proyectos/GitHub/Lysto/tests/integration/admin-operations.test.ts)
- [docs/runbooks/daily-operations.md](E:/Proyectos/GitHub/Lysto/docs/runbooks/daily-operations.md)

**Migración nueva:** etiqueta `operator_queue_and_configuration_workflows`. Generar timestamp con CLI y registrar filename real; aplicar protocolo T03.

**Pasos de implementación:**

1. Aplicar inventario admin completo; listar todas las acciones visibles y qué permiso/servicio las respalda. Pruebas de datasets vacíos, más de 100 filas y usuario sin finance.
2. Conectar cola con responsable, antigüedad, prioridad, SLA, estado y próxima acción; agenda, búsqueda de cliente/profesional, cobros, reclamos, calidad y auditoría.
3. Unificar rutas antiguas de pagos/precios/marketplace con módulos reales para no mantener dos centros financieros/calculadoras. Elegir alias seguro o vista compartida.
4. Conectar servicios/zonas/herramientas/reglas de diagnóstico a catálogo versionado autorizado. Cambios no alteran contratos aceptados; diagnóstico preliminar sigue siendo orientación.
5. Calcular KPIs desde consultas autorizadas con período/zona/definición visibles; separar trabajo cerrado de reseña, bruto de neto y cobro de ingreso propio. Ofrecer reportes exportables con mínimos datos y permisos.
6. Ejecutar ejercicio de entrega de turno: operador A asigna caso, B retoma, finanzas concilia y calidad resuelve. Ninguna acción ordinaria necesita SQL o cambio por desarrollador.

**Verificación específica:**

- `corepack pnpm test:integration -- admin-operations`
- `corepack pnpm exec vitest run admin-ui`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Todas las herramientas expuestas representan registros reales y los operadores resuelven caso normal y excepciones con sus permisos.

**Recuperación / rollback:** Pausar mutaciones del módulo afectado; conservar consulta/cola y registro de coordinación manual.

**Evidencia que debe guardar:** Inventario de acciones, UAT de dos operadores y KPI con datos reconciliados.


### T30 — Observabilidad, límites de uso y controles de producción

**Responsable:** Agente técnico. **Depende de:** T06, T09, T17, T24. **Auditoría:** B01, B07, B10.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [lib/config/env.ts](E:/Proyectos/GitHub/Lysto/lib/config/env.ts)
- [.env.example](E:/Proyectos/GitHub/Lysto/.env.example)
- [next.config.ts](E:/Proyectos/GitHub/Lysto/next.config.ts)
- [lib/http/route-handler.ts](E:/Proyectos/GitHub/Lysto/lib/http/route-handler.ts)
- [app/api/pricing/quote/route.ts](E:/Proyectos/GitHub/Lysto/app/api/pricing/quote/route.ts)
- [app/api/mercadopago/webhook/route.ts](E:/Proyectos/GitHub/Lysto/app/api/mercadopago/webhook/route.ts)

**Crear:**

- [instrumentation.ts](E:/Proyectos/GitHub/Lysto/instrumentation.ts)
- [lib/observability/logger.ts](E:/Proyectos/GitHub/Lysto/lib/observability/logger.ts)
- [lib/observability/metrics.ts](E:/Proyectos/GitHub/Lysto/lib/observability/metrics.ts)
- [lib/security/rate-limit.ts](E:/Proyectos/GitHub/Lysto/lib/security/rate-limit.ts)
- [lib/release/runtime-switches.ts](E:/Proyectos/GitHub/Lysto/lib/release/runtime-switches.ts)
- [app/api/health/live/route.ts](E:/Proyectos/GitHub/Lysto/app/api/health/live/route.ts)
- [app/api/health/ready/route.ts](E:/Proyectos/GitHub/Lysto/app/api/health/ready/route.ts)
- [tests/integration/production-controls.test.ts](E:/Proyectos/GitHub/Lysto/tests/integration/production-controls.test.ts)
- [docs/runbooks/alerts.md](E:/Proyectos/GitHub/Lysto/docs/runbooks/alerts.md)

**Migración nueva:** etiqueta `shared_rate_limits_and_runtime_controls, si se usa PostgreSQL`. Generar timestamp con CLI y registrar filename real; aplicar protocolo T03.

**Pasos de implementación:**

1. Probar redacción de cookies/tokens/PII, rate limit compartido entre instancias, origen indebido, bandera de cobro apagada y configuración productiva incompleta.
2. Implementar logs estructurados con correlationId, evento/código, recurso no sensible, latencia y release; conectar proveedor de errores/alertas elegido en D10. Registrar errores no recuperables, sin reportar mensajes financieros crudos.
3. Limitar login/registro/recuperación, quote/maps, lectura de comprobantes y mutaciones sensibles en almacenamiento compartido. Configurar 429/Retry-After; no usar contador en memoria como protección distribuida.
4. Agregar políticas de origen/CSRF compatibles con callbacks, headers de seguridad y CSP ensayada con Mercado Pago/OAuth. Probar que bloquear iframes/scripts no rompe checkout; evitar CSP amplia como solución.
5. Agregar APP_ENV explícito, LYSTO_ACCEPT_NEW_REQUESTS y LYSTO_ALLOW_NEW_CHECKOUTS independientes. Prod nunca usa provider mock ni datos demo. Apagar cobros nuevos conserva webhook, conciliación, lectura y gestión de reclamos.
6. Health live prueba proceso; ready verifica dependencias con timeout sin exponer secretos. Alertas por 5xx, pago review, cola atrasada, worker ausente, DB saturada y nuevo deploy defectuoso.

**Verificación específica:**

- `corepack pnpm test:integration -- production-controls`
- `corepack pnpm exec vitest run env`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Errores operativos son detectables, abuso/costos limitados y se pueden detener nuevas operaciones sin perder eventos ni servicio a clientes existentes.

**Recuperación / rollback:** Reducir alcance de una regla de seguridad sólo con análisis explícito; switches permiten pausar negocio sin desactivar auth/ledger.

**Evidencia que debe guardar:** Alertas recibidas, logs redactados, límites entre instancias y pruebas de switches.


### T31 — Condiciones comerciales, privacidad y formación de operadores

**Responsable:** Agente prepara; dirección/legal/contabilidad/operaciones validan. **Depende de:** T01, T18, T23, T29. **Auditoría:** B08, B09, B10.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [app/(public)/como-funciona/page.tsx](E:/Proyectos/GitHub/Lysto/app/(public)/como-funciona/page.tsx)
- [app/(public)/servicios/aire-acondicionado/page.tsx](E:/Proyectos/GitHub/Lysto/app/(public)/servicios/aire-acondicionado/page.tsx)
- [app/(public)/ayuda/page.tsx](E:/Proyectos/GitHub/Lysto/app/(public)/ayuda/page.tsx)
- [app/(auth)/registro/page.tsx](E:/Proyectos/GitHub/Lysto/app/(auth)/registro/page.tsx)
- [docs/00-product-vision.md](E:/Proyectos/GitHub/Lysto/docs/00-product-vision.md)

**Crear:**

- [app/(public)/terminos/page.tsx](E:/Proyectos/GitHub/Lysto/app/(public)/terminos/page.tsx)
- [app/(public)/privacidad/page.tsx](E:/Proyectos/GitHub/Lysto/app/(public)/privacidad/page.tsx)
- [app/(public)/cancelaciones/page.tsx](E:/Proyectos/GitHub/Lysto/app/(public)/cancelaciones/page.tsx)
- [docs/operations/operator-handbook.md](E:/Proyectos/GitHub/Lysto/docs/operations/operator-handbook.md)
- [docs/operations/service-policies.md](E:/Proyectos/GitHub/Lysto/docs/operations/service-policies.md)
- [docs/operations/privacy-requests.md](E:/Proyectos/GitHub/Lysto/docs/operations/privacy-requests.md)
- [tests/integration/policy-acceptance.test.ts](E:/Proyectos/GitHub/Lysto/tests/integration/policy-acceptance.test.ts)

**Migración nueva:** etiqueta `policy_versions_and_acceptance`. Generar timestamp con CLI y registrar filename real; aplicar protocolo T03.

**Pasos de implementación:**

1. Preparar borradores completos y decisiones abiertas sobre garantía, cancelación, reintegro, adicionales, profesionales y facturación; no certificar cumplimiento legal ni inventar aprobación.
2. Versionar aceptación de condiciones con sujeto, versión, fecha y evidencia mínima; guardar aceptación del presupuesto/adicional con alcance. Minimizar datos personales recolectados.
3. Definir atención de acceso/corrección/eliminación de datos, retención de evidencia, excepciones por reclamos y obligaciones aplicables con profesional responsable. No borrar ledger por una solicitud de cuenta.
4. Actualizar landing/ayuda/como-funciona para describir exactamente el servicio operativo; quitar promesas de garantía universal, seguimiento GPS, mensajes o factura no implementados.
5. Crear guías de apertura/cierre de turno, asignación, atraso, técnico ausente, repuesto, reclamo, riesgo físico, pago incierto, devolución y caída. Cada guía define responsable, tiempo de respuesta, escalamiento y registro.
6. Capacitar con casos sintéticos y registrar aceptación humana en D02/D05/D06/D07/D08. Si falta un texto aprobado, dejar su gate pendiente; continuar pruebas técnicas sin publicarlo como definitivo.

**Verificación específica:**

- `corepack pnpm test:integration -- policy-acceptance`
- Ejercicio UAT-01 a UAT-08 del anexo con operador y finanzas

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Promesas públicas coinciden con capacidad real, políticas están aprobadas y operadores demuestran el procedimiento; no basta entregar un manual.

**Recuperación / rollback:** Conservar versiones aceptadas; publicar nueva versión con trazabilidad, sin cambiar retroactivamente contratos.

**Evidencia que debe guardar:** Documentos aprobados con autor/fecha y acta de capacitación/UAT.


### T32 — Backups, custodia de claves y restauración ensayada

**Responsable:** Agente técnico + titular de infraestructura. **Depende de:** T03, T17, T24, T30. **Auditoría:** B08, B09, B10.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [docs/release/database-migration-runbook.md](E:/Proyectos/GitHub/Lysto/docs/release/database-migration-runbook.md)
- [docs/release/environment-register.md](E:/Proyectos/GitHub/Lysto/docs/release/environment-register.md)

**Crear:**

- [docs/runbooks/disaster-recovery.md](E:/Proyectos/GitHub/Lysto/docs/runbooks/disaster-recovery.md)
- [docs/runbooks/secret-rotation.md](E:/Proyectos/GitHub/Lysto/docs/runbooks/secret-rotation.md)
- [scripts/verify-restore.mjs](E:/Proyectos/GitHub/Lysto/scripts/verify-restore.mjs)
- [tests/integration/restore-verification.test.ts](E:/Proyectos/GitHub/Lysto/tests/integration/restore-verification.test.ts)

**Pasos de implementación:**

1. Inventariar qué respalda el proveedor: DB, Auth, Storage, configuración, roles/passwords especiales, outbox/ledger y tokens cifrados. Confirmar retención real del plan contratado.
2. Definir RPO/RTO aprobados en D09. Propuesta inicial RPO 1h/RTO 4h requiere medios que la soporten; un backup diario no acredita RPO de una hora.
3. Custodiar clave de cifrado OAuth con acceso restringido y recuperación por responsables designados. Ensayar rotación/versionado sin dejar tokens ilegibles; nunca guardar claves en repo.
4. Crear respaldo de archivos independiente de backup DB. Registrar manifiesto/relaciones/hashes para verificar que informes y documentos recuperados existen.
5. Restaurar en entorno aislado con envíos, scheduler y cobros live apagados. Verificar integridad, login sintético, roles, evidencia privada, descifrado controlado y reconciliación sin crear pagos.
6. Medir tiempos/pérdida máxima y ensayar recuperación de outbox/webhook pendientes. Definir reactivación controlada y evitar mensajes/cobros duplicados tras restore.

**Verificación específica:**

- `corepack pnpm test:integration -- restore-verification`
- `node scripts/verify-restore.mjs --manifest <ruta-del-manifiesto-de-prueba> (script creado en esta tarea; sólo destinos autorizados de restore)`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Restore completo ejecutado y medido dentro de objetivos aprobados, incluidos archivos y material de cifrado; no sólo backup configurado.

**Recuperación / rollback:** Mantener origen intacto; aislar la restauración fallida, no apuntar producción a ella.

**Evidencia que debe guardar:** Manifiesto, tiempos, checklist de integridad y acta de recuperación sin secretos.


### T33 — CI completa y gates de release que fallen ante evidencia faltante

**Responsable:** Agente técnico. **Depende de:** T02, T03, T04, T05. **Auditoría:** B07, B10.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [.github/workflows/ci.yml](E:/Proyectos/GitHub/Lysto/.github/workflows/ci.yml)
- [package.json](E:/Proyectos/GitHub/Lysto/package.json)
- [lib/release/release-gates.ts](E:/Proyectos/GitHub/Lysto/lib/release/release-gates.ts)
- [tests/domain/release-gates.test.ts](E:/Proyectos/GitHub/Lysto/tests/domain/release-gates.test.ts)
- [checks/TEST_RESULTS.md](E:/Proyectos/GitHub/Lysto/checks/TEST_RESULTS.md)

**Crear:**

- [scripts/check-release-evidence.mjs](E:/Proyectos/GitHub/Lysto/scripts/check-release-evidence.mjs)
- [tests/unit/release-evidence.vitest.test.ts](E:/Proyectos/GitHub/Lysto/tests/unit/release-evidence.vitest.test.ts)
- [docs/release/release-policy.md](E:/Proyectos/GitHub/Lysto/docs/release/release-policy.md)
- [scripts/test-e2e-staging.mjs](E:/Proyectos/GitHub/Lysto/scripts/test-e2e-staging.mjs)

**Pasos de implementación:**

1. Escribir tests de gate ausente, lista vacía, evidencia de otro commit/entorno, duplicada, vencida, skipped y error desconocido: todos deben bloquear. El evaluador actual no debe aprobar por lista vacía.
2. Definir catálogo fijo de gates G01–G16 del anexo; resultados incluyen versión, commit, entorno, fecha, comando, exit code, artefacto y tipo automated/provider/human.
3. Agregar instalación limpia Linux, lint, typecheck, dominio, unitarios, DB desde cero, integración de pagos obligatoria, E2E y audit. Pin de acciones verificado, permisos mínimos y secretos sólo en jobs necesarios.
4. Implementar jobs tempranos de integración con suites disponibles y ampliar al completar tareas. No generar un gate verde sobre archivos de test que aún no existen.
5. Agregar evidencia de build/deploy runtime vendor, esquema/tipos sin drift, checks de datos demo y API inventory. Aislar fixtures para que PR no contacte proveedores live.
6. Configurar política de ramas/releases y bloquear promoción sin catálogo completo. Gates humanos/proveedor se verifican como evidencia externa vinculada, no como booleanos que el agente escribe true.
7. Crear test:e2e:staging con scripts/test-e2e-staging.mjs: exigir APP_ENV=staging, URL y project ref allowlisted, cuentas/recursos de prueba identificados y prohibir producción. Registrar todos los scripts nuevos en package.json; comprobar --list y rechazar cero pruebas.

**Verificación específica:**

- `corepack pnpm exec vitest run release-evidence`
- `corepack pnpm test:domain`
- `node scripts/check-release-evidence.mjs --manifest <manifest> --target technical (script creado en esta tarea)`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** CI detecta omisiones y reconstruye la versión desde cero; un pass local no sustituye evidencia de release/staging.

**Recuperación / rollback:** Conservar controles críticos obligatorios; corregir job fallido sin desactivar gate para promover.

**Evidencia que debe guardar:** URL/captura de CI del commit, artefactos y prueba de bloqueo con manifest incompleto.


### T34 — E2E de tres roles, aislamiento y experiencia móvil

**Responsable:** Agente + QA. **Depende de:** T26, T27, T28, T29, T30, T31, T33. **Auditoría:** B01, B02, B03, B04, B05, B06, B08, B09, B10.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [tests/e2e/customer-flow.spec.ts](E:/Proyectos/GitHub/Lysto/tests/e2e/customer-flow.spec.ts)
- [playwright.config.ts](E:/Proyectos/GitHub/Lysto/playwright.config.ts)
- [tests/qa/manual-release-checklist.md](E:/Proyectos/GitHub/Lysto/tests/qa/manual-release-checklist.md)

**Crear:**

- [tests/e2e/auth-access.spec.ts](E:/Proyectos/GitHub/Lysto/tests/e2e/auth-access.spec.ts)
- [tests/e2e/customer-production.spec.ts](E:/Proyectos/GitHub/Lysto/tests/e2e/customer-production.spec.ts)
- [tests/e2e/professional-production.spec.ts](E:/Proyectos/GitHub/Lysto/tests/e2e/professional-production.spec.ts)
- [tests/e2e/admin-production.spec.ts](E:/Proyectos/GitHub/Lysto/tests/e2e/admin-production.spec.ts)
- [tests/e2e/service-lifecycle.spec.ts](E:/Proyectos/GitHub/Lysto/tests/e2e/service-lifecycle.spec.ts)
- [tests/e2e/financial-exceptions.spec.ts](E:/Proyectos/GitHub/Lysto/tests/e2e/financial-exceptions.spec.ts)
- [tests/e2e/accessibility.spec.ts](E:/Proyectos/GitHub/Lysto/tests/e2e/accessibility.spec.ts)

**Pasos de implementación:**

1. Reemplazar el test del wizard antiguo por escenarios del contrato vigente. Eliminar aserciones de matching simulado; comprobar IDs persistidos y recarga.
2. Crear sesiones independientes y recorrido E01–E18 del anexo contra build de producción y Supabase de prueba. No interceptar el backend propio ni resolver la suite con fixtures UI; simular sólo proveedores externos cuando corresponda.
3. Probar errores de conexión, doble click, back/refresh, sesión vencida, conflicto de operador, acceso a registros ajenos, archivo rechazado y token público inválido.
4. Ejecutar Chromium desktop/mobile y WebKit mobile; controlar foco, teclado, labels, contraste, targets táctiles y modales. Medir uso en teléfono físico en UAT; emulación no lo sustituye.
5. Corregir causa raíz de fallas, no ampliar timeouts/snapshots para ocultarlas. Capturar trace/screenshot/video acotados y sin secretos.
6. Operadores realizan UAT con casos y roles reales de staging. Registrar defects y volver a probar sólo afectados más gates requeridos tras cambios.

**Verificación específica:**

- `corepack pnpm test:e2e`
- `corepack pnpm test:integration`
- `corepack pnpm lint`
- `corepack pnpm typecheck`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Todos los escenarios obligatorios pasan con datos persistentes y roles reales; UAT no depende de SQL o asistencia del desarrollador.

**Recuperación / rollback:** Mantener release anterior y corregir en staging; no lanzar con fallas en dinero/privacidad/servicio.

**Evidencia que debe guardar:** Reportes por navegador, trazas, IDs de prueba y acta UAT.


### T35 — Carga, latencia, capacidad y presupuesto operativo

**Responsable:** Agente técnico + dirección. **Depende de:** T12, T29, T30, T33. **Auditoría:** B10.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [lib/payments/marketplace-db.ts](E:/Proyectos/GitHub/Lysto/lib/payments/marketplace-db.ts)
- [docs/release/environment-register.md](E:/Proyectos/GitHub/Lysto/docs/release/environment-register.md)

**Crear:**

- [tests/load/service-platform.js](E:/Proyectos/GitHub/Lysto/tests/load/service-platform.js)
- [docs/release/performance-and-cost.md](E:/Proyectos/GitHub/Lysto/docs/release/performance-and-cost.md)

**Pasos de implementación:**

1. Definir carga esperada y presupuesto con D01/D10: usuarios concurrentes, solicitudes, checkouts, fotos y pico de operadores. Si faltan datos, usar hipótesis explícita que no habilita escala ilimitada.
2. Crear prueba k6 o herramienta primaria equivalente con cuentas sintéticas en staging permitido; endpoints pagos/mapas externos sustituidos o limitados para no generar cargos/transacciones.
3. Medir consultas, CPU/memoria, conexiones combinadas pg+Prisma, latencia p50/p95/p99, errores, cache/aislamiento y backlog. Separar latencia propia de esperas de proveedor.
4. Probar 2× pico acordado, ráfaga, 60 minutos sostenidos y recuperación. Propuesta: p95 lectura propia <1s, mutación propia <2s, <1% 5xx y cero errores de integridad; aprobar umbral en D10.
5. Corregir consultas/índices/pooling/timeouts y revalidar; no aumentar recursos sin entender cuellos. Documentar límites de planes y escalamiento.
6. Calcular costos mensuales y por servicio para escenarios base/2×/5× con tarifas oficiales verificadas al ejecutar y costos humanos. Configurar alertas de gasto y topes de consumo.

**Verificación específica:**

- `k6 run tests/load/service-platform.js (instalar versión oficial y verificar --help; script creado en esta tarea)`
- `corepack pnpm test:integration -- payment-concurrency`

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Carga objetivo demostrada con margen, sin integridad perdida; costos y señales de escalamiento medidos y aprobados.

**Recuperación / rollback:** Detener generador y volver a configuración estable; pruebas no deben saturar producción.

**Evidencia que debe guardar:** Perfil de carga, métricas, EXPLAIN, costos y umbrales.


### T36 — Staging completo y aceptación del proveedor

**Responsable:** Agente técnico + titular Mercado Pago + QA. **Depende de:** T01, T17, T18, T24, T30, T32, T34, T35. **Auditoría:** B08, B09, B10.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [docs/mercadopago-split.md](E:/Proyectos/GitHub/Lysto/docs/mercadopago-split.md)
- [docs/release/environment-register.md](E:/Proyectos/GitHub/Lysto/docs/release/environment-register.md)
- [docs/release/pricing-acceptance.md](E:/Proyectos/GitHub/Lysto/docs/release/pricing-acceptance.md)

**Crear:**

- [docs/release/staging-acceptance.md](E:/Proyectos/GitHub/Lysto/docs/release/staging-acceptance.md)
- [docs/release/provider-acceptance.md](E:/Proyectos/GitHub/Lysto/docs/release/provider-acceptance.md)

**Pasos de implementación:**

1. Desplegar el release candidate en staging identificado usando autorizaciones existentes. Si falta destino/acceso, preparar configuración y solicitar sólo ese dato; nunca adivinar ni usar producción de staging.
2. Configurar HTTPS/dominio, allowlist Auth/OAuth, webhook, secretos aislados, SMTP, scheduler y observabilidad. Verificar marca de entorno y que ningún token TEST se acepte como live o inversamente.
3. Ejecutar migraciones ensayadas, verificar tipos/esquema/roles y smoke tests HTTP en runtime de destino con pg/Prisma. No cambiar el esquema remoto a mano para saltar el proceso.
4. Realizar matriz MP01–MP12 del anexo con cuentas oficiales de prueba: aprobación/pendiente/rechazo/reembolso cuando sandbox lo permita, OAuth, renovación, firma y reconciliación tras fallo de entrega.
5. Documentar limitaciones sandbox. Para casos no reproducibles, conservar prueba local y gate proveedor pending hasta aceptación válida o prueba controlada autorizada. No fabricar estados remotos ni consentimientos.
6. Probar emails reales sólo a buzones de prueba designados, scheduler y alertas. Registrar evidencia saneada del titular y resultados por caso/commit, sin secretos.

**Verificación específica:**

- E2E del release candidate contra staging configurado (test:e2e:staging a crear en T33 con guard de proyecto)
- Matriz MP01–MP12
- Smoke de Auth/DB/Storage/worker en runtime de destino

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** La versión funciona en entorno remoto real y los proveedores críticos están aceptados con evidencia verificable; no se extrapola de mocks.

**Recuperación / rollback:** Rollback de app compatible y switches off para nuevo negocio; preservar DB, webhook/outbox y registro de eventos.

**Evidencia que debe guardar:** Deployment ID, commit, proyecto, migraciones, MP01–MP12 y entrega/alertas.


### T37 — Preparar y ejecutar puesta en producción controlada

**Responsable:** Agente técnico + dirección/titulares. **Depende de:** T31, T32, T33, T34, T35, T36. **Auditoría:** B01, B02, B03, B04, B05, B06, B07, B08, B09, B10.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [docs/release/release-policy.md](E:/Proyectos/GitHub/Lysto/docs/release/release-policy.md)
- [docs/runbooks/disaster-recovery.md](E:/Proyectos/GitHub/Lysto/docs/runbooks/disaster-recovery.md)

**Crear:**

- [docs/release/production-runbook.md](E:/Proyectos/GitHub/Lysto/docs/release/production-runbook.md)
- [docs/release/go-no-go.md](E:/Proyectos/GitHub/Lysto/docs/release/go-no-go.md)

**Pasos de implementación:**

1. Generar manifest completo G01–G16 vinculado al release candidate y sus evidencias; incluir riesgos/exclusiones aprobadas. TECHNICALLY_READY no significa PROD_ENABLED.
2. Preparar ventana, responsables, backup previo, plan forward/rollback, compatibilidad de migraciones y switches. Seleccionar artefacto exacto; cambios de código invalidan evidencia relevante.
3. Confirmar autorizaciones efectivas para publicar/activar cobros. Si no están dadas, presentar resultado concreto para decisión final y seguir con preparación independiente; el plan por sí solo no las inventa.
4. Aplicar sólo migraciones aprobadas tras preflight y backup verificado; desplegar con altas/checkouts nuevos desactivados. Verificar dominio, headers, assets, auth, RLS, pools, scheduler y webhook.
5. Con titular, completar prueba financiera mínima real autorizada y conciliada cuando sea necesaria, con monto/destinatario definidos y devolución según política. No ejecutar pagos o aceptar contratos sin autorización correspondiente.
6. Activar cupo limitado después de smoke y autorización registrada. Monitorear y revertir aplicación compatible o aplicar forward fix según runbook; mantener recepción de eventos durante cualquier pausa.

**Verificación específica:**

- `node scripts/check-release-evidence.mjs --manifest <manifest> --target pilot`
- Smoke de release en producción sin fixtures destructivos
- Verificación de switches, webhook, alertas y versión

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Producción habilitada sólo para el piloto autorizado con release trazable, controles y capacidad real de detener nuevas operaciones.

**Recuperación / rollback:** Apagar admisión/checkouts nuevos, preservar operaciones existentes/webhooks, rollback de app compatible; restore DB sólo bajo incidente y conciliación documentada.

**Evidencia que debe guardar:** Go/no-go firmado por responsables, manifest, deploy, smoke y estado de switches.


### T38 — Ejecutar piloto supervisado y cerrar defectos

**Responsable:** Operaciones + finanzas + técnica. **Depende de:** T37. **Auditoría:** B03, B04, B08, B09, B10.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [docs/operations/operator-handbook.md](E:/Proyectos/GitHub/Lysto/docs/operations/operator-handbook.md)
- [docs/runbooks/daily-operations.md](E:/Proyectos/GitHub/Lysto/docs/runbooks/daily-operations.md)

**Crear:**

- [docs/release/pilot-report.md](E:/Proyectos/GitHub/Lysto/docs/release/pilot-report.md)
- [docs/release/pilot-defects.md](E:/Proyectos/GitHub/Lysto/docs/release/pilot-defects.md)

**Pasos de implementación:**

1. Aplicar cupo/zonas/horarios D01–D03 con clientes y profesionales autorizados. Referencia inicial: 20 servicios completos y dos semanas; cambiar sólo con decisión registrada.
2. Revisar diariamente solicitudes bloqueadas, asignación, pago/conciliación, visitas, cierres, mensajes y reclamos. Mantener soporte con suplente.
3. Registrar defectos reproducibles por severidad y recorrido; corregir con release nuevo y regresión pertinente. No operar habitualmente mediante cambios SQL invisibles.
4. Detener nuevas operaciones ante acceso indebido, doble cobro, evidencia perdida o incapacidad de conocer estado monetario. Conservar trazas y activar incident runbook.
5. Comparar tiempos/costos/cancelaciones/revisitas con objetivos. Cero diferencias monetarias inexplicadas y cero bloqueos críticos abiertos para salir del piloto.
6. Preparar informe con resultados observados, limitaciones, incidentes, aprendizaje y capacidad aprobada. El agente puede instrumentar/seguir evidencia, pero no simular transcurso de días ni aprobación de clientes.

**Verificación específica:**

- Revisión diaria de KPIs y conciliación
- Reejecutar regresiones de defectos corregidos
- Gates G14–G16 y UAT posterior

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** Piloto real completa el umbral aprobado y demuestra operación sin dependencia habitual del desarrollador; incidentes relevantes cerrados.

**Recuperación / rollback:** Pausar crecimiento o nuevas solicitudes; terminar/atender servicios existentes y reclamar/reembolsar según protocolo.

**Evidencia que debe guardar:** Servicios trazables saneados, conciliación diaria, incidentes y aprobación de operación.


### T39 — Habilitar crecimiento y entregar mantenimiento sostenible

**Responsable:** Dirección + técnica + operaciones. **Depende de:** T38. **Auditoría:** B10.

**Modificar / revisar** (existentes ahora o creados por prerrequisitos):

- [README.md](E:/Proyectos/GitHub/Lysto/README.md)
- [BLOCKERS.md](E:/Proyectos/GitHub/Lysto/BLOCKERS.md)
- [checks/HONEST_SYSTEM_STATUS.md](E:/Proyectos/GitHub/Lysto/checks/HONEST_SYSTEM_STATUS.md)
- [checks/IMPLEMENTATION_STATUS.md](E:/Proyectos/GitHub/Lysto/checks/IMPLEMENTATION_STATUS.md)
- [checks/FINAL_SCOPE_MATRIX.md](E:/Proyectos/GitHub/Lysto/checks/FINAL_SCOPE_MATRIX.md)
- [docs/22-production-completion-criteria.md](E:/Proyectos/GitHub/Lysto/docs/22-production-completion-criteria.md)

**Crear:**

- [docs/operations/maintenance-calendar.md](E:/Proyectos/GitHub/Lysto/docs/operations/maintenance-calendar.md)
- [docs/architecture/ownership-map.md](E:/Proyectos/GitHub/Lysto/docs/architecture/ownership-map.md)
- [docs/release/production-handover.md](E:/Proyectos/GitHub/Lysto/docs/release/production-handover.md)

**Pasos de implementación:**

1. Reconciliar todos los B01–B10, T00–T39, rutas, decisiones y G01–G16 con evidencia actual. Ningún pending puede convertirse en complete por narrativa.
2. Actualizar documentos de estado y marcar planes previos como históricos; el plan antiguo sin Mercado Pago no define este release.
3. Asignar dueños y suplentes para código, DB, infraestructura, pagos, soporte y privacidad; documentar acceso de emergencia sin revelar secretos.
4. Programar revisiones de dependencias, accesos, costos, incidentes, backups/restore y capacidad según calendario. Crear instrucciones para nuevo desarrollador desde checkout limpio.
5. Revisar resultados del piloto y autorizar nuevo cupo/zonas con capacidad demostrada; no afirmar escalabilidad ilimitada.
6. Entregar manifest final, operación diaria, runbooks, backlog no bloqueante, riesgos aceptados y siguiente fecha de revisión. Declarar estado final exacto: GENERAL_PRODUCTION_READY sólo con evidencia y decisiones completas.

**Verificación específica:**

- `node scripts/check-release-evidence.mjs --manifest <manifest> --target general`
- Revisión de trazabilidad B01–B10 y entrenamiento de suplente

Aplicar el ciclo de prueba de la sección 5. Pruebas nuevas deben demostrar primero la carencia; al terminar, todos los checks aplicables pasan con casos realmente ejecutados. Si un comando depende de archivo/script futuro, respetar su tarea de creación y usar integración equivalente hasta entonces; registrar el pendiente.

**Criterio de cierre:** La operación puede continuar y evolucionar con dueños, procedimientos, evidencias y capacidad aprobada; no depende del contexto de un solo agente.

**Recuperación / rollback:** Mantener cupo piloto y soporte vigente hasta subsanar cualquier gate faltante.

**Evidencia que debe guardar:** production-handover.md y manifest final; calendario y ownership-map.


## 9. Contratos de implementación que deben quedar comprobados

**Autorización de comandos.** La forma exacta se adapta al esquema existente en T03/T05, manteniendo estas propiedades:

```ts
import { z } from "zod";

export const JobCommandInput = z.object({
  jobId: z.string().uuid(),
  expectedVersion: z.number().int().nonnegative(),
  idempotencyKey: z.string().uuid(),
}).strict();

export type VerifiedActor = {
  userId: string;
  role: "customer" | "professional" | "admin";
  assurance: "aal1" | "aal2";
};
```

Este contrato es propuesto: no sustituir firmas existentes a ciegas. El actor se deriva del servidor; no es parte del body. La versión o mecanismo equivalente se compara contra DB, no contra un `currentStatus` enviado por el cliente. `paid`, `ownerId`, `professionalId`, importes y permisos del body nunca son autoridad por sí mismos. El servicio valida propiedad/capacidad; SQL repite invariantes críticas dentro de transacción. Una clave repetida con payload diferente produce conflicto, no reutilización silenciosa.

**Prueba mínima del bloqueo de release.** Agregar primero en el archivo de dominio existente, con el harness del repositorio:

```ts
import assert from "node:assert/strict";
import { evaluateReleaseGates } from "../../lib/release/release-gates.ts";

assert.equal(evaluateReleaseGates([]).canLaunch, false);
```

El evaluador actual aprueba una lista vacía: esta aserción debe fallar antes de T33 y pasar después. Integrarla como caso del runner, no ejecutarla aislada y olvidarla. Ampliar el contrato a gates con identidad fija, estado/evidencia y targets. Probar además omisión, duplicado, commit incorrecto, entorno incompatible, evidencia vieja, prueba skipped, proveedor no aceptado y todos los gates válidos. No poner `passed: true` fijo en el catálogo.

**Contrato de error propuesto:** `{ error: { code, message, correlationId }, fieldErrors? }`. Los mensajes son accionables sin PII ni detalles de DB/proveedor. `401` sin identidad, `403` por permiso insuficiente o `404` cuando debe ocultarse existencia, `409` por versión/estado/idempotencia conflictiva, `422` por datos semánticos inválidos, `429` por límite. Mantener una política uniforme; actualizar contratos del cliente y tests en conjunto.

**Contrato de lectura:** DTO mínimo por rol, cursor estable y límite validado, orden determinista, estados empty/loading/error/retry explícitos; contadores calculados sobre datos completos autorizados. Ninguna pantalla agrega importes de una página parcial para llamarlos ingresos totales.

**Contrato de transacción:** una operación durable liga cambio de estado, evento de auditoría y outbox cuando corresponde. El envío externo ocurre después del commit. La recuperación tras timeout consulta el resultado idempotente antes de volver a crear una intención. Los reembolsos no se llaman completados hasta confirmación canónica.

## 10. Comandos y resultados esperados

| Comando desde la raíz | Disponibilidad | Resultado requerido |
|---|---|---|
| `corepack pnpm install --frozen-lockfile` | Actual | exit 0 sin modificar lockfile; vendor reproducible |
| `corepack pnpm lint` | Actual | exit 0, sin warnings tolerados |
| `corepack pnpm typecheck` | Actual | exit 0, sin errores; tipos SQL actualizados |
| `corepack pnpm test:domain` | Actual | exit 0, nuevos archivos importados por runner |
| `corepack pnpm test:unit` | Actual | exit 0; no contar tests DB saltados como integración validada |
| `corepack pnpm exec vitest run marketplace` | Actual | suites existentes pasan; las de PostgreSQL sólo cuentan con DB configurada y cero skips críticos |
| `corepack pnpm exec supabase test db --local` | Actual | ejecutar desde proyecto local descartable; pgTAP pasa, no contra DB del usuario por inercia |
| `corepack pnpm test:integration` | Crear T04 | exit 0, todas las suites críticas ejecutadas; fallar si DB/fixtures faltan |
| `corepack pnpm test:integration -- <filtro>` | Crear T04 | wrapper propaga filtro a Vitest, al menos un test seleccionado |
| `corepack pnpm test:e2e` | Actual; ampliar T34 | navegador contra app real de prueba y datos persistidos; sin interceptar APIs del propio producto para simular éxito |
| `corepack pnpm test:e2e:staging` | Crear T33 | guard de entorno/proyecto y pruebas con cuentas designadas; producción rechazada |
| `corepack pnpm build` | Actual | exit 0, runtime de pagos y rutas correcto; build aislado si existe servidor dev |
| `corepack pnpm audit --prod` | Actual | salida interpretada por aplicabilidad; hallazgos graves aplicables cerrados antes de release |
| `node scripts/check-release-evidence.mjs --manifest <ruta> --target technical` | Crear T33 | exit 0 sólo G01–G13 completos; manifest incompleto debe exit 1 |
| Igual con `--target pilot` | Crear T33 | exit 0 sólo G01–G15 completos |
| Igual con `--target general` | Crear T33 | exit 0 sólo G01–G16 completos |

Los filtros de Vitest listados en cada tarea son los del módulo existente o del archivo nuevo especificado. Si un nombre cambió, actualizarlo con evidencia de descubrimiento; cero pruebas no equivale a pass. No usar `--passWithNoTests` para un gate. Los marcadores `<ruta>`/`<manifest>` se sustituyen por paths verificados; nunca se pegan literalmente.

**Evidencia mínima por comprobación:** task/caso/gate, commit SHA y hash de snapshot si dirty, entorno y project ref saneado, fecha UTC, comando o procedimiento, resultado, exit code/contador de tests/skips, ruta o URL del artefacto, responsable. Conservar logs completos saneados; el resumen es derivado de ellos. La evidencia del snapshot dirty sirve para trabajo local; el release exige candidato comprometido reproducible.

## 11. Operación después de la entrega

El calendario de T39 debe asignar dueño y suplente y ajustar frecuencias a volumen/riesgo:

| Frecuencia propuesta | Actividad | Evidencia |
|---|---|---|
| Cada turno/día operativo | Cola de solicitudes/servicios, conciliación, pagos inciertos, reembolsos, notificaciones, reclamos y alertas | Traspaso de turno y conciliación |
| Cada despliegue | Gates afectados, migración compatible, smoke, observación y rollback disponible | Manifest y deployment ID |
| Semanal | Dependencias y avisos críticos, errores repetidos, capacidad, costo y casos vencidos | Revisión y tareas priorizadas |
| Mensual | Permisos/cuentas, vigencia profesional, cuotas, políticas de retención y accesos de emergencia | Acta de revisión y bajas verificadas |
| Trimestral y tras cambios relevantes | Simulacro de restauración, incidente y continuidad con suplente | RPO/RTO medidos y acciones |
| Según urgencia del aviso | Parche de seguridad aplicable y rotación comprometida | Release y verificación del incidente |

Estas frecuencias son propuestas para aprobación operativa; no crean automatizaciones en Codex ni envían comunicaciones por sí mismas.

**Entrega final exigida al agente:** versión y destino, gates con evidencia, tareas/decisiones pendientes si las hay, runbooks y custodios, costo/capacidad aprobados, resultados del piloto, riesgos no bloqueantes aceptados y próximos pasos. Si sólo llegó a M2 debe decir “preparación técnica completada; producción pendiente de …”. Sólo declarar salida general cuando M4 esté demostrado.

