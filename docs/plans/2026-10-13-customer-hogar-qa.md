# Hogar cliente — verificación e integración

Fecha: 2026-10-13. Alcance aprobado: varios hogares por direcciones propias, maqueta 3D orientativa, plantas y ambientes editables, únicamente aires acondicionados. Cámara y RA fuera de esta entrega.

## Estado de publicación

**Pendiente de renovación efectiva de la conexión de Supabase y comprobación de base real. El usuario autorizó la implementación y publicación, pero no debe declararse listo ni publicarse en main hasta superar los controles.**

La rama conserva Inicio y Servicios previamente aprobados y añade Hogar sin duplicar el App Shell. La demo independiente no se utiliza como fuente de datos de clientes.

## Implementación cubierta

- Crear/configurar casa, departamento de edificio bajo/alto, PH, oficina o local comercial; características visuales de balcón, terraza y ventanas.
- Catálogo de 16 tipos de ambientes con 37 variantes, filtrados por tipo de hogar. Alta, edición, dimensiones/posición/rotación orientativas y eliminación confirmada.
- Crear, renombrar, ordenar y quitar plantas; mostrar exclusivamente la activa.
- Foco de un ambiente; alta transaccional de aire o ubicación de equipo existente sobre pared, posición y altura; cancelar, reubicar y quitar ubicación.
- Mantener ficha e historial reales. Eliminar un ambiente/planta o archivar un hogar no elimina equipos ni servicios.
- Estados vacíos/carga/error, recuperación de conflictos, reintentos inmutables, navegación enfocada y alternativa de lista sin GPU.

## Evidencia local

- Revisión independiente de cumplimiento: 101 pruebas enfocadas aprobadas antes de los últimos controles de capacidad.
- Recorridos de interfaz ampliados: 37/37; creación por perfil, varias plantas y hogares, variantes, persistencia solicitada por API, cancelación, errores, reintentos idénticos y navegación real.
- Geometría/escena: 21/21; todos los ambientes/variantes, seis tipos de aire, planta/foco, paredes, límites de ubicación y limpieza de recursos.
- Compilación Next 15.5.27 completa aprobada después de las correcciones finales: 101/101 páginas generadas, lint y tipos aprobados. Regresión detectada/corregida en argumentos opcionales de Presupuestos y Solicitar: validación PageProps generada por Next.
- Dominio: 174/174. Seguridad del harness/herramientas: 41/41 después del parche final y del diagnóstico de arranque.
- Procesamiento de imágenes y biblioteca de pagos: comprobaciones locales aprobadas, sin consultas de base ni llamadas a proveedores.
- Actualizaciones de parche: Sharp 0.35.5, source-map-js 1.2.2 y Next/eslint-config-next 15.5.27. Auditoría JSON de **producción** final: cero avisos en todas las severidades, exit 0. Esto no acredita cero avisos en dependencias de desarrollo. Fuentes: [Sharp](https://github.com/advisories/GHSA-wq5f-xc86-pv6w), [source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q), [Next SSG/ISR](https://github.com/vercel/next.js/security/advisories/GHSA-4jqv-mc3x-m676), [Next caché compartida](https://github.com/vercel/next.js/security/advisories/GHSA-mcj8-r9mp-w47p).
- El guardia de imágenes verifica la política de Next 15.5.27: AVIF solo se decodifica con libheif >=1.23.2. Sharp instalado incluye 1.23.5; cuatro pruebas comprueban el runtime real y el bloqueo ante metadatos inseguros/desconocidos, sin desbloquear loaders.

Las pruebas de UI usan dobles de API/GPU y **no acreditan persistencia real ni renderizado visual**. Una primera suite completa tuvo un timeout de 5 s durante cargas concurrentes; el archivo afectado pasó 9/9 aislado. La suite final local del checkpoint `8b69f37` terminó correctamente: 158 archivos y 1.129 pruebas. CI `38436316694`, commit `a9a4ec98`, amplió esa evidencia a **159 archivos y 1.135 pruebas, cero fallos**, incluyendo los nuevos controles del catálogo. Evidencia local anterior: `output/ci-hogar-checkpoint/unit-final.json`.

## Revisiones y correcciones

Reintentos de creación/alta conservan exactamente el cuerpo y la clave originales. Una dirección nueva participa en la misma transacción que el hogar. No se permite archivar una dirección principal vinculada a un hogar activo. Aires antiguos de tipo incompleto tienen explicación y acceso al historial; nunca se representan silenciosamente como Split. Balcón/terraza no pueden desactivarse si todavía existe ese ambiente.

La revisión de calidad identificó además condiciones de carrera entre clientes al colisionar UUID de plantas, límite de 500 ubicaciones omitido en alta y presupuesto HTTP insuficiente para una distribución válida grande. Los parches pasaron revisión independiente y la suite local de 125 casos de Hogar; el backend descartable de CI ya ejecutó el lifecycle SQL y las seis assertions de integración de Hogar, incluidas las carreras y los reintentos. La limpieza posterior de las dos cuentas sintéticas falló: todavía debe diagnosticarse y corregirse, sin atribuir la causa a una FK o permiso antes de obtener evidencia.

La revisión final detectó que salir o recargar tras una respuesta perdida podía descartar la identidad de un alta. Se incorpora un comando validado en `sessionStorage`, separado por cliente, persistido antes del POST y reintentado solo por acción explícita. Un GET vacío no acredita que la transacción no se haya ejecutado. Los rechazos definitivos se distinguen de una respuesta perdida; un primer 409 conocido permite corregir el comando abortado, pero un 409 posterior a ambigüedad lo conserva. Todas las entradas de edición se bloquean durante recuperación, manteniendo la navegación de lectura y el reintento. La precondición `X-Lysto-Customer-Id` se compara con la sesión fresca en las cinco operaciones API antes del cuerpo/RPC; nunca deriva el propietario desde ese encabezado. Impide enviar un comando de una pestaña de A bajo la cuenta B. Revisión independiente final conforme, sin bloqueantes locales en este alcance; 74/74 casos UI y 20/20 de actor/headers/error pasan.

Los requests mutantes directos del E2E incluyen ahora el Origin real de la app, además del actor. Un actor ajeno exige 403/forbidden; una escritura de un hogar ajeno con actor válido exige 404/not_found. Esto evita confundir un bloqueo CSRF con la comprobación de propiedad. Descubrimiento: nueve casos Hogar en tres proyectos, todavía sin ejecución de backend. El arranque fallido conserva su estado de error y registra solo un diagnóstico sanitizado; ocho pruebas cubren redacción y límites de publicación del log.

El diagnóstico remoto posterior identificó `SQLSTATE 42601` en la sentencia 42 de `20261013141601_customer_hogar.sql`: `IF NOT CASE` necesitaba paréntesis alrededor de la expresión CASE. Se corrigió exclusivamente esa agrupación, sin alterar catálogo ni validación. Regresión de fuente RED→GREEN y dominio/harness: tres archivos, 25 casos aprobados antes de repetir PostgreSQL.

El siguiente CI compiló la migración y pasó **37 archivos / 820 pruebas SQL**, incluido `hogar_rollback.sql` con sus 18 comprobaciones. Los tipos públicos se copiaron byte por byte del archivo generado por PostgreSQL en CI `38433534455`, commit `700025f`: SHA-256 `3662e93ab32823d64c11ddbff03f94aad42d4a020ef89bf588a32657258ae1be`. Incluyen cinco tablas y dos RPC Hogar; también recuperan un RPC heredado que faltaba. Tipo/lint y 25 casos de servicios/rutas pasan. Se añaden casts explícitos a siete arrays y un índice compuesto para la FK de direcciones-hogar; no cambian firmas ni columnas, pero la nueva ejecución debe acreditar la coincidencia exacta de tipos y el lint. Las declaraciones provisionales de RPC ya fueron reemplazadas por la generación real.

El catálogo pgTAP ejecutó correctamente sus **270 casos** (151 combinaciones compatibles, 65 variantes inválidas, 34 incompatibilidades y 20 exteriores desactivados). Fixture de las 37 variantes idéntico al catálogo cliente, comprobado por tres casos unitarios. Solo tablas temporales dentro de BEGIN/ROLLBACK; no persiste hogares, direcciones ni identidades. CI `38436316694` aprobó **38 archivos / 1.090 pruebas SQL**, la coincidencia exacta de tipos generados y el lint sin warnings nuevos de Hogar. Permanecen cinco warnings heredados.

La integración general de ese CI terminó con 267 assertions aprobadas y 15 fallidas, en seis archivos. Las seis assertions de `customer-homes.test.ts` pasaron; el fallo de su suite está en `afterAll`, al borrar sus dos usuarios. El harness descarta el error original de Auth, por lo que la causa de esa limpieza no está demostrada. Otros failures son expectativas/fixtures anteriores de Servicios y onboarding profesional; se revisan contra los contratos existentes, sin relajar autorización. E2E y despliegue quedaron omitidos. La siguiente ejecución permite obtener evidencia E2E independiente si el esquema y los navegadores están verificados, aunque falle integración; ese fallo sigue bloqueando el job y cualquier despliegue.

Se incorpora un diagnóstico SQL rollback-only de limpieza: diez `lives_ok`, cinco escenarios (control sin Hogar, mínimo, con aire/ubicación/idempotencia, direcciones revisionadas y archivado) por dos ejecutores (SQL owner y Auth admin). No se cambia el esquema a partir de una hipótesis; pgTAP debe entregar el SQLSTATE/constraint original. Guards estáticos 4/4 y revisión independiente pasan; PostgreSQL real todavía pendiente para estos diez casos. Servicios y el workspace profesional de solo lectura también se alinean a sus contratos vigentes en tres pruebas de integración, manteniendo las denegaciones operativas. Herramientas completas: 45/45 después de añadir los cuatro controles del diagnóstico E2E.

## Verificación todavía obligatoria

1. Diagnosticar/corregir la limpieza de identidades sintéticas y repetir SQL si hubiera cambios de esquema. Migraciones, casts/índice y catálogo ya pasaron 1.090 controles aislados.
2. Mantener la coincidencia exacta de tipos generados mediante `scripts/verify-ci-schema.mjs`; ese control ya pasó en `a9a4ec98`.
3. Corregir los fallos de integración respaldados por evidencia y ejecutar E2E contra el backend descartable de CI, sin datos de clientes ni credenciales de producción. Cero casos omitidos.
4. Verificar permisos de la conexión de producción y aplicar exclusivamente la nueva migración necesaria; ejecutar advisors y consultas enfocadas. No ejecutar fixtures generales contra producción.
5. Revisión visual 3D/gestos/responsive: el navegador integrado devuelve que el puente nativo no está disponible. No usar Chrome local como alternativa; no hay captura actual certificada.
6. Comprobar la rama remota, integrar sin force y verificar el SHA de main después de publicar.

## Bloqueos comprobados del entorno

- Proyecto Supabase vinculado: `dqonlqcurvjnjgsczevu`. El chat previo «Revisar acceso a Supabase» acredita configuración Owner. MCP listado como enabled/OAuth, pero iniciar conexión falla con `OAuth token refresh failed: Failed to parse server response`; sus herramientas SQL no están expuestas en esta sesión. CLI vinculado devuelve 403 de privilegios al iniciar el rol de consulta; advisors también. El intento de OAuth expiró sin renovar acceso. Se necesita reconectar con la cuenta propietaria, sin compartir secretos por chat.
- Docker Desktop no ofrece un motor operativo; WSL informa servicio deshabilitado. No se modificaron servicios ni características del sistema operativo. CI usa su propio contenedor Supabase descartable como alternativa.
- GitHub main previo ya fallaba en auditoría de dependencias, antes de Hogar. Los checkpoints se publicaron solo en `codex/customer-services`; main permanece intacto. [CI 38427354720](https://github.com/lystoservicios-sudo/lysto/actions/runs/38427354720) se detuvo en la auditoría JSON con dos avisos moderados de Next 15.5.24; la advertencia alta de instalación del gestor no corresponde al artefacto de producción. [CI 38430073085](https://github.com/lystoservicios-sudo/lysto/actions/runs/38430073085), commit `8b69f37`, pasó auditoría, lint, tipos, dominio, herramientas, runtime de imágenes y 158 archivos / 1.129 pruebas. Windows también pasó. Falló al iniciar Supabase descartable, antes de SQL/E2E; su log en RUNNER_TEMP no se publicó, por lo que la causa todavía no está acreditada. Se incorpora un diagnóstico sanitizado para el siguiente intento, sin omitir ni relajar controles.
- [CI 38432247627](https://github.com/lystoservicios-sudo/lysto/actions/runs/38432247627), commit `adeba578`, conservó el diagnóstico sanitizado: las migraciones previas llegaron hasta Hogar, donde falló la expresión CASE mencionada. El rate limit transitorio de descarga se reintentó y no fue la causa final. PostgreSQL no llegó a ejecutar pgTAP, generación de tipos ni E2E. La migración todavía no se aplicó en el proyecto de producción.
- [CI 38433534455](https://github.com/lystoservicios-sudo/lysto/actions/runs/38433534455), commit `700025f`, aprobó migraciones y 820 casos SQL. Lint PostgreSQL no tuvo errores; siete warnings nuevos de arrays originaron los casts explícitos y cinco warnings heredados no se modificaron. Falló exclusivamente por deriva de los tipos guardados; entregó el archivo generado ahora incorporado. Integración y E2E todavía no se ejecutaron.
- [CI 38436316694](https://github.com/lystoservicios-sudo/lysto/actions/runs/38436316694), commit `a9a4ec98`, aprobó Windows, auditoría de producción, lint, TypeScript, dominio, herramientas, 1.135 unitarios, runtime, 1.090 SQL y tipos generados. Integración falló con el detalle anterior. E2E y despliegue no se ejecutaron; esto no acredita una entrega lista.

## Recuperación

Antes de publicar, obtener evidencia de migración y snapshot del estado objetivo. No borrar ni reescribir direcciones/equipos/historial existentes. Archivar desde la interfaz es reversible a nivel de inventario histórico, pero la interfaz actual no incorpora restauración de hogares archivados. Si falla una migración, revisar el error y su estado antes de reintentar; no ejecutar DROP/TRUNCATE ni resets destructivos.
