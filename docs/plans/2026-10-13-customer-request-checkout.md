# Pedir: contratación contextual y pago marketplace

> Implementación en la app Next.js existente. Trabajo aislado en `codex/customer-request-checkout`; sin publicación automática. El usuario autorizó posteriormente pruebas controladas contra Supabase de producción, sin Docker ni cambios en datos reales.

## Dirección aprobada

Siete momentos: equipo/falla → ubicación → detalles → orientación → visita → resumen/precio/pago → seguimiento. Mantener blanco, azul Lysto, tipografía y componentes existentes; navegación inferior oculta en este flujo. Un equipo por solicitud. Las respuestas de cada aire se conservan por separado al recorrer el carrusel. Seleccionar un hogar nunca modifica su maqueta.

Referencias aprobadas en `C:/Users/quime/.codex/generated_images/01a113b5-c26c-7343-bd9a-4e894c9a32af/`: `exec-454bcebc-ff06-4c8f-bcb9-427139e24d5d.png` (falla, agua realista), `exec-0a00de12-4397-4efd-a816-6a9994eed505.png` (ubicación), `exec-ee82c7bb-2830-4ae2-81c9-ceeee00a890f.png` (detalles), `exec-ce4fffe4-527f-4ccf-9393-9edee6baa7f8.png` (orientación), `exec-141d02cb-7dea-4cf5-8ee7-f47df3696bc3.png` (visita), `exec-6aee1009-7801-4c6f-9f57-8da4d9bb5695.png` (resumen), `exec-5a343892-817e-49a5-956d-1f7e7a98eac0.png` (seguimiento). Los importes y fechas de esas imágenes son ilustrativos, no datos de negocio.

Texto adicional: «Si durante la visita se detectan otros problemas o hacen falta repuestos, el profesional te presentará un presupuesto adicional para que lo revises antes de decidir.» No modificar el precio aceptado ni cobrar extras automáticamente.

## Cierre comercial y garantías

El usuario confirmó expresamente «Confirmar automáticamente al técnico disponible». El cálculo del precio prepara internamente una asignación automática y permite pagar por Mercado Pago con el split existente, sin esperar aceptación individual. Registrar procedencia automática propia sin fabricar `accepted_at` del profesional ni `reviewed_by` de un administrador.

El contrato actual requiere presupuesto revisado y aceptación profesional. Crear un contrato automático explícito, auditado y separado si se confirma esa variante; no debilitar los contratos históricos. Toda tarifa, cobertura, duración/reserva y comisión procede de configuración aprobada del servidor. Precio incompleto, política no aprobada/caducada, equipo fuera de cobertura, falta de técnico disponible o seller no apto impiden habilitar un cobro y mantienen una salida honesta/recuperable.

Precisión del usuario: usar el calculador interno según tipo de falla y distancia del técnico; si falta esa parte se añadirá después. El calculador actual tiene referencias de mano de obra, capacidad, tecnología, acceso y traslado, pero el endpoint histórico toma un origen operativo fijo. El nuevo contrato no utilizará ese origen como si fuese la posición del técnico: necesita un origen confiable y aprobado por profesional. No se creó ni aprobó una tarifa nueva de diagnóstico, ni se alteraron comisiones. La activación automática necesita una política de alcance/agenda y costes completa; cuando falte, el formulario mostrará un estado recuperable sin habilitar un cobro.

Actores verificados; contexto de equipo/hogar/ambiente validado por pertenencia e IDs; dirección histórica de visita conservada. Idempotencia duradera por comando y huella: repetir devuelve el mismo presupuesto/pedido/reserva; cambiar contenido con la misma clave falla. La asignación usa bloqueos y reservas sin solapamiento. El receptor de un checkout ya creado queda congelado. Retornar de Mercado Pago no acredita el pago: el webhook/consulta canónica decide su estado.

## Tareas (TDD: observar rojo, implementar, verde, revisión de especificación y calidad)

### 1. Contexto y borrador puros

- Crear `features/service-request/request-context.ts` y `request-draft.ts` y pruebas unitarias propias.
- Selección de equipos propios activos, nickname e identidad, resolución por placement/aliases de dirección, discriminación localizado/sin ubicación/sin hogar/nuevo/incompleto.
- No inventar habitación/pared/posición ni tecnología: solo inverter y on_off determinan tecnología. Capacidad superior a 18000 queda identificada fuera de cobertura tarifaria actual, nunca truncada.
- Un equipo por pedido; fallas y detalles por equipo, reinicio por actor, invalidación de precio ante cambios comerciales; formularios reparación/mantenimiento/instalación discriminados y validación de avance.
- Pruebas: contextos presentes/faltantes, aliases, una/múltiples plantas, equipo legacy, capacidad, swipe, cambio de actor/equipo, invalidación y vuelta entre pasos.

### 2. Assets de equipo

- Inspeccionar `public/images/customer-home-air.png` y referencia aprobada. Reutilizar si encaja; generar assets raster reales transparentes de variantes de falla cuando haga falta, nunca una captura como interfaz ni gotas cartoon.
- Guardar en `public/images/service-request/`, optimizar usando herramientas existentes; fallback neutral para tipos sin representación específica, no afirmar modelo/diagnóstico.

### 3. Contexto mínimo dentro del formulario

- SSR `readCustomerHomes(session)` y refresco actor-bound. Crear componente independiente `RequestLocationStep` con `HomeScene` sin writes, planta única y fallback accesible sin WebGL.
- Completar únicamente hogar/dirección/ambiente/equipo necesarios con los comandos existentes idempotentes y expectedVersion. No navegar fuera ni montar el gestor Hogar completo.
- Conservar comando pendiente antes de escribir, congelar tras respuesta incierta, replay exacto y separación por actor; no duplicar aire existente.

### 4. Pantallas y movimiento

- Dividir el coordinador existente en componentes claros de equipo/falla, ubicación, detalles, orientación, visita y resumen.
- Carrusel táctil + teclado/botones, controles solo si varios equipos; ilusión 2.5D contenida, transición al espacio conocido sin inventar ubicación; respetar reduced motion.
- Fotos privadas mediante `MediaUploader`, solo verifiedUpload; impedir avance final durante uploads, remontar por actor/draft.
- Fecha relativa al día actual y horario preferido no presentado como reserva confirmada. Resumen editable, cálculo real, errores recuperables, una CTA primaria.

### 5. Preparación comercial servidor/SQL

- Endpoint dedicado de preparación de contratación y migración duradera creada con Supabase CLI. Validación estricta de actor, IDs, versión, detalles y media.
- Asociar quote → request → equipo original atómicamente; mantener snapshot postal, sin reescribir inventario ni duplicar direcciones canónicas.
- Cálculo del precio con política vigente aprobada, alcance inicial pagable explícito y adicionales separados. No cambiar porcentajes ni aprobar una política pendiente.
- Resolver asignación autorizada con filtros existentes más seller conectado apto y capacidad/duración confiables; usar locks/reservas/auditoría y deduplicar reintentos.
- Pruebas SQL/integración: pertenencia, precios, snapshot, idempotencia/huella, concurrencia, no candidato/seller/política, ausencia de aceptación ficticia.

### 6. Pago y seguimiento

- Reusar `createCheckoutPreference` y `/api/mercadopago/create-preference`; CTA «Pagar con Mercado Pago», `init_point`, sin monto/comisión/seller del cliente.
- Estados preparación, no disponible/revisión, listo para pagar, pendiente, aprobado, rechazado y retorno incierto. Consulta canónica, nunca querystring como prueba de pago.
- Recuperación después de timeout sin duplicar pedido/checkout. Enlaces reales a Servicios y detalle. Mantener presupuestos adicionales con aprobación expresa independiente.

### 7. Verificación y entrega

- Línea base antes de cambios; tests enfocados por tarea y regresión unit/domain/typecheck/lint/build; SQL e integración aislados según scripts existentes; E2E varios equipos, datos faltantes, una/múltiples plantas, carga privada, fallos y pago canónico sin cobros reales.
- QA visual usando exclusivamente navegador integrado de Codex. No usar Opera, Chrome ni Edge del usuario, ni saltarse bloqueos del navegador. Si no conecta, informar qué verificación visual queda pendiente.
- Revisión independiente de especificación seguida de calidad. Documentar limitaciones comerciales reales. No afirmar listo para producción ni aplicado remoto si falta evidencia.
- No copiar secretos/.env. No crear trabajos/reservas reales ni iniciar cobros de producción en pruebas. La autorización posterior permite inspección, una migración propia revisada y fixtures sintéticas dentro de una única transacción con `ROLLBACK`; no permite otras migraciones pendientes ni cambios en políticas comerciales reales. No desplegar ni subir a main sin autoridad actual explícita.
- Restricción posterior expresa del usuario: no utilizar Docker, incluidos comandos o pruebas que dependan de contenedores. Buscar verificación alternativa sin Docker; no cambiar servicios ni configuración de Windows para habilitarlo.

## Evidencia de avance

- Base antes del cambio de pantallas: 1146 pruebas unitarias, cero fallos; TypeScript y 174 pruebas de dominio correctas.
- Contexto y borrador: revisión independiente de especificación y calidad aprobada. 52 casos nuevos verificaron identidad, ubicación, capacidad, respuestas por aire y presupuestos tardíos. Los cambios de actor limpian información privada y conservan una revisión monótona.
- Assets: seis estados raster transparentes, PNG fuente y WebP lossless; documentación en `docs/design/customer-request-assets.md`. Agua realista y sin representar causas como diagnósticos.
- Navegador integrado: conexión rechazada por el transporte actual; no se abrió navegador personal. QA visual interactiva pendiente.
- Borrador ampliado: 63 pruebas enfocadas correctas, incluida limpieza exclusiva del contexto del síntoma al cambiar la falla; conserva las demás respuestas.
- Pago: 36 pruebas de rutas correctas; redirección `init_point` y modo verificado, actor explícito en el flujo nuevo. Veinte regresiones del ledger comprobaron que ambos protocolos devuelven el estado persistido, no un «aprobado» previo a los guards SQL, y fijan los padres financieros antes de locks job → checkout. Se vuelve a verificar identidad de cliente/profesional/trabajo. Son pruebas de la frontera del coordinador, no prueba de concurrencia PostgreSQL.
- Traslado: 12 pruebas enfocadas correctas. La vuelta se calcula después de la duración aprobada de la visita; se conserva el default histórico de 120 minutos y se rechazan duraciones inválidas antes de consultar Google.
- Producción: ninguna migración nueva aplicada ni fixture ejecutada. El MCP no presenta herramientas operativas, el puente del navegador rechaza la conexión y la consulta CLI al proyecto devuelve 403. El chat de conexión Owner confirmó que la credencial global actual no tiene acceso a Lysto; una configuración persistida no sustituye un `SELECT 1` exitoso.
- Regresión completa preliminar del cambio: 1.347 pruebas unitarias en 173 archivos, 174 pruebas de dominio y compilación de producción correctas. Los ajustes finales posteriores tienen pruebas enfocadas propias; no atribuirles esa ejecución anterior como si incluyera todos los casos nuevos.
- Revisión backend de especificación y calidad aprobadas en fuente. Se corrigieron cruces de locks con edición de perfil/agenda y la lectura SQL de visita/correo, que ahora usa el snapshot aceptado y exige pago inicial canónico en contratos automáticos. Doce guardas estáticas de la migración pasan; el harness no fue ejecutado.
- Interfaz: revisión de especificación aprobada tras corregir fotos por actor, recuperación después de POST confirmado/GET fallido, características nulas, resumen de respuestas y transición hacia el mesh real. El raster transitorio vive en un portal del viewport y se descarta al salir de Ubicación; comprobado RED → GREEN. E2E actualizado conserva el ciclo histórico y agrega Pedir sin simular disponibilidad, pero sigue sin ejecutarse.

## Verificación final local — 2026-10-14

- Código congelado en `codex/customer-request-checkout`, sin commits, push, merge ni despliegue.
- Suite completa final: **1.395/1.395 pruebas unitarias, 178 archivos, cero fallos y cero omitidas**. Reporte generado en `output/customer-request-unit-final.json` (ignorado por Git).
- Dominio: **174/174**. TypeScript, ESLint global (`--max-warnings=0`), `git diff --check` y compilación Next.js de producción: exit 0.
- Guards estáticos: 12 de migración + regla de entornos; inventario API regenerado (110 métodos) y prueba correcta. Runtime de pagos: paquete/exports/cifrado/Prisma correctos, **0 consultas DB / 0 llamadas al proveedor**; runtime de imágenes correcto.
- Revisión independiente de especificación y calidad: backend e interfaz aprobados en código. La última revisión de interfaz verificó 38 casos después de corregir normalización de dirección/hogar, consultas de pago single-flight y accesibilidad.
- Correcciones finales de recuperación: equivalencia `''`/`NULL` y flags sin ignorar cambios reales; orden de claves de objetos sin cambiar arrays/geometría; consultas de pago vinculadas al comando y serializadas sin fijar «aprobado» para siempre.
- **No verificado:** ejecución real de migración/harness/RLS/advisors/concurrencia PostgreSQL; E2E aislado; fidelidad visual y gestos en navegador. No se usó Docker ni navegador personal en estas verificaciones.
- **Bloqueo operativo:** acceso Owner efectivo al ref real; CLI 403, MCP sin herramientas operativas y puente IAB indisponible. No se modificó producción ni se inició un cobro. La política comercial automática sigue deshabilitada y necesita aprobación real de alcance/agenda vinculada a tarifas vigentes antes de activarse.

## Reanudación: operación completa pendiente — 2026-10-14

- El objetivo solicitado es que Pedir funcione de punta a punta para el cliente; los resultados locales anteriores no bastan para declararlo terminado.
- Se verificó nuevamente el ref enlazado `dqonlqcurvjnjgsczevu`. Una ejecución nueva de `db query --linked --agent no` con `SELECT 1`, usuario y base volvió a fallar al inicializar el rol, con HTTP 403; no ejecutó SQL.
- Además de comprobar la configuración, una ejecución efímera independiente de Codex, limitada a lectura y con `lysto-supabase` obligatorio, falló al renovar OAuth antes de iniciar la sesión. No hubo consulta MCP exitosa ni cambios de autenticación deliberados.
- El navegador integrado se intentó mediante el runtime oficial y rechazó el puente de confianza, también después de recibir las instrucciones actualizadas. No se accedió al dashboard ni se usó un navegador personal o un mecanismo alternativo para evadir ese rechazo.
- El intento de inicio de sesión CLI con `--no-browser` fue interrumpido antes de devolver una sesión; la inspección posterior no encontró procesos `supabase.exe` pendientes. No se obtuvo ni copió una credencial.
- La revisión de pruebas encontró una alternativa sin Docker documentada en staging remoto, pero su identidad y conexión protegidas no están cargadas en esta ejecución. No se deben falsificar los indicadores de entorno para ejecutar los runners aislados contra producción.
- El E2E nuevo actual verifica reutilización de Hogar y bloqueo seguro cuando falta una política/disponibilidad válida. **No verifica el camino exitoso precio → asignación → checkout → pago confirmado**. Ese recorrido y una integración Mercado Pago de prueba separada siguen siendo requisitos de cierre, junto con migración/harness/RLS/advisors, concurrencia PostgreSQL y QA visual.
- La documentación comercial existente no constituye aprobación de tarifas por defecto. La activación requiere evidencia real de tarifa vigente y alcance/agenda; no insertar fixtures o valores inventados como política de producción para aparentar disponibilidad.
- En esta reanudación no se modificó producción ni se realizó commit, push o despliegue. El avance del código se conserva en el mismo worktree.

## Acceso aislado y verificación PostgreSQL completados — 2026-10-14

- El usuario reparó el acceso mediante `Supabase CLI:lysto-owner`, perfil externo no secreto y comando obligatorio `E:/Proyectos/GitHub/Lysto/scripts/supabase-lysto.cmd`. Se leyó el AGENTS actualizado y una consulta nueva al ref real devolvió `1`, usuario/base `postgres`; el bloqueo de acceso anterior queda resuelto.
- Preflight real: migración Hogar instalada, FKs/UNIQUE esperadas, cero solicitudes con equipo de otro cliente y cuatro cuerpos legacy iguales a sus últimas migraciones del repositorio. No se aplicaron las migraciones pendientes ajenas a Pedir.
- Las pruebas transaccionales detectaron dos regresiones no certificables con mocks: precedencia JSONB al comparar rutas y permisos del nuevo OID/row locks para el rol SQL `lysto_marketplace`. Ambas se reprodujeron antes de corregir y se agregaron guardas de regresión.
- Permisos mínimos: EXECUTE del wrapper, SELECT de previews/contratos/reservas, UPDATE exclusivamente de `hold_expires_at` en contratos y `updated_at` en los tres padres financieros. No se concedió acceso privado a roles del navegador ni se alteraron credenciales, atributos o membresías en la migración.
- Se aplicó **únicamente `20261014023946_customer_request_contract_checkout`** en una transacción con timeouts de bloqueo/sentencia, incluyendo su registro de historial. Consulta posterior confirma la migración y cinco tablas privadas con RLS.
- El harness ampliado ejecutó **65/65 comprobaciones reales** después de aplicar: RPC públicas, AAL1/AAL2, identidad, privacidad, idempotencia, asignación/reserva, checkout bajo el rol SQL real, locks de padres y estados normales/tardíos. Precios, ruta y aprobación financiera siguen siendo sintéticos: no prueba Google, creación de preferencia, webhook, ledger TypeScript completo ni un pago del proveedor.
- Se verificó después, desde otra consulta, **cero usuarios/previews/contratos de fixture**, membresía administrativa idéntica al baseline y política de tarifas sin cambios. El puente SET del Owner utilizado solo en el harness quedó revertido por ROLLBACK.
- Advisors antes/después: **cero errores, 75 advertencias preexistentes y ninguna nueva**. Dieciséis guardas de fuente de la migración correctas; `git diff --check` correcto.
- Staging remoto es accesible con la misma cuenta Owner, pero está atrasado (`20260923154658`) y aún no tiene Hogar; no se modificó ese entorno ni se falsificaron guardas de pruebas para usar producción.
- **La contratación automática permanece deshabilitada.** La base real no tiene una política de tarifas vigente en `quote_policy_current`. En esa etapa las referencias reservaban 18% para Lysto y un 6% estimado para cobro; el usuario rechazó esa reserva. La corrección posterior la elimina y conserva el reparto bruto 18%/82%, sin aprobar tarifas o recargos nuevos. El estado actual se documenta a continuación.
- Pendientes de cierre: aprobación comercial real y agenda; concurrencia multiconexión y recorrido HTTP/visual; comprobación del proveedor con cuentas de prueba separadas. No hubo cobros/envíos reales, commit, push ni despliegue de la aplicación.

## Reanudación con reparto aprobado — 2026-10-14

- Reparto confirmado por el usuario: **18% Lysto / 82% bruto profesional**. No se reserva 6% ni se bloquea el presupuesto por una comisión estimada de Mercado Pago. Cargos reales observados del proveedor y snapshots históricos permanecen intactos.
- Siete pasos del cliente implementados: Equipo y problema → Ubicación → Detalles → Orientación → Visita → Pedido y precio → Pago, con estados de recuperación y seguimiento. Se conserva la estética aprobada y los ambientes Hogar; no se agregan cámara/RA ni otros equipos.
- Recuperación de ubicación ampliada y revisada: lectura canónica explícita para PUT inciertos, comparación de versión, bloqueo de comandos reemplazados/corruptos y protección contra borrar un pendiente más nuevo. Un POST incierto no se descarta. TDD y revisión independiente de especificación/calidad aprobados.
- Cuatro recorridos completos UI —reparación, mantenimiento, instalación y alta inline de hogar/ambiente/aire— ejecutan handlers, validaciones y calculador reales. Transporte de inventario/pagos simulado: no acreditar estos tests como Auth/HTTP/3D/proveedor reales.
- Regresión actual: **1.452/1.452 unitarias, 182 archivos, cero omitidas; 174/174 de dominio; 103/103 tooling**. TypeScript sin incremental, lint global, diff-check y build de producción correctos. Runtimes de pagos/imágenes correctos, sin consultas DB ni llamadas al proveedor durante esos smokes.
- Producción: migración adicional `20261014213321_customer_request_gross_split` aplicada y registrada previamente. Nueva ejecución de **70/70 pruebas PostgreSQL/RPC/roles con ROLLBACK**; consulta independiente verifica fixtures/previews/contratos cero, políticas sin cambios y membresía administrativa idéntica. Advisors actuales: 75 WARN preexistentes, cero ERROR.
- QA real aislado `obksyzasmfwcbbksesqt`, comprobado vacío: aplicados únicamente cuatro prerrequisitos exactos de Owner helper/Hogar/Pedir/reparto, en una sola transacción con historial y timeouts. Historial 74→78; RLS verificado; política real permanece deshabilitada. Sin `db push` de migraciones ajenas ni creación de roles.
- **Cinco pruebas de concurrencia PostgreSQL reales correctas**, con conexiones distintas y bloqueo observable: comando duplicado, alias sobre una preview, clientes compitiendo por horario y ambos órdenes entre expiración/aprobación. Confirmación financiera sintética del trigger SQL: no acredita un pago real de Mercado Pago. El cleanup original de QA encontró la protección de Storage y revirtió su transacción; recuperación completada mediante API oficial, sin desactivar la protección. Consulta nueva independiente confirma cero fixtures y restauración exacta de ACL/RLS/owners/membresías/punteros/conteos.
- Navegador integrado: el runtime oficial volvió a rechazar el puente de confianza; no se usó un navegador personal ni se evadió ese bloqueo. HTTP/E2E existentes carecen de identidad/conexión PG y credenciales separadas de prueba; no se falsificaron guardas para ejecutarlos contra producción.
- **Pendiente antes de cobros/despliegue:** tarifario vigente y alcance inicial/duración/agenda aprobados, más verificación externa Auth/HTTP/proveedor y visual real. La aprobación 18%/82% no sustituye esos datos; tampoco se repite un supuesto bloqueo por Mercado Pago. Trabajo conservado en `codex/customer-request-checkout`, sin commit/push/merge/despliegue.

## Verificación HTTP real y conflictos de versión — 2026-10-14

- La regresión ampliada pasa **1.496/1.496 unitarias, 183 archivos, cero omitidas**, **174/174 de dominio** y **131/131 tooling**. TypeScript sin incremental, lint global y build correctos. Las cifras anteriores se conservan como historial, no como la última ejecución.
- El runner parcial utiliza Auth real de QA, cookies SSR, las APIs Next y PostgREST; no sustituye las credenciales con JWT fabricados. No carga secretos en archivos ni en argumentos y excluye proveedores, workers, correo y cobros.
- La primera ejecución real comprobó diez operaciones HTTP, pero el PUT con versión obsoleta no terminó. Se identificó una incompatibilidad documentada de PostgREST 14: lanzar manualmente `40001` provoca reintentos del servidor. Se detuvo únicamente el PID que la consulta de actividad atribuía a ese fixture. [Diagnóstico oficial de Supabase](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b).
- Nueva migración `20261014235503_customer_rpc_business_conflicts`: reemplaza solamente 16 conflictos de negocio por `PT409` en siete helpers exactos, con guardas de preimagen y metadatos. No cambia errores de serialización emitidos por el motor, permisos, RLS ni políticas. Los cuatro adaptadores aceptan el código nuevo y los heredados; 44 regresiones unitarias nuevas pasan.
- QA pasó de 78 a 79 migraciones mediante una transacción revisada. La migración nueva **no está persistida en producción**: debe publicarse junto con los adaptadores compatibles. En producción se probó junto con 70 comprobaciones RPC/roles dentro de ROLLBACK; la huella completa de funciones y la membresía Owner volvieron exactamente a su valor anterior. Advisors QA: 73 WARN, cero ERROR, sin cambios de baseline.
- La recuperación del primer run verificó eliminación exclusiva de sus dos identidades y restauración exacta de conteos/punteros/permisos. Los 412 buckets históricos de rate limit se conservaron íntegramente, hash `72f3c806dda6d3dda0a139eb5cc2458b`. Se conserva el manifiesto original con su incertidumbre y un recibo separado; no se convirtió la ejecución fallida en una prueba aprobada.
- La repetición posterior encontró un 503 en la primera consulta del inventario desde Next. Auth, registro y contexto directos habían pasado, pero **el recorrido HTTP sigue sin aprobarse**. Se detuvo el servidor propio; ninguna mutación de hogar/equipo/solicitud/pago alcanzó a ejecutarse. La reconciliación real identificó exclusivamente sus dos cuentas/sesiones sintéticas para recuperación controlada. No se dedujo una causa sin diagnóstico ni se alteró la autorización de la aplicación para eludir el fallo.

## Cierre de la prueba parcial Auth/HTTP — 2026-10-14

- La ejecución final `4642522b-d042-4466-8f7d-2ed8fe825399` terminó con **17/17 comprobaciones reales y salida 0**: Auth/registro/cookies SSR, dos inventarios vacíos, actor explícito, sesión y origen obligatorios, alta/replay de hogar, ambiente, conflicto 409, alta/replay/ubicación del aire, inventario canónico y aislamiento entre clientes. La consulta de Pedir devolvió correctamente `tariffs_unapproved`, sin crear pedido ni iniciar cobro.
- El caso intermedio de 403 se aisló: la autoridad y el contexto reales pasaron bajo `service_role` en ROLLBACK, pero las rutas añadían una comparación contra la URL interna reconstruida. TDD reprodujo dos rechazos de un origen público configurado y una URL interna distinta; la corrección usa el origen canónico ya validado por `readPrivateJsonBody`. Un origen ajeno coincidente con el host interno sigue rechazado antes de leer el cuerpo; 17/17 pruebas de API y 39/39 ampliadas correctas, con revisión independiente.
- El 503 anterior no tiene una causa retrospectiva confirmada porque no se conservó su código. No se afirma haberlo corregido modificando Auth: no volvió a aparecer en las dos ejecuciones siguientes. La instrumentación nueva conserva únicamente código de API aprobado y tiempos numéricos; jamás tokens, cookies o cuerpos del proveedor.
- El teardown final cerró ambas sesiones mediante el JWT legítimo retenido solo en memoria, verificó cero sesiones desde SQL y eliminó exclusivamente las dos identidades propias por API. Manifest `cleaned`, `uncertain=[]`, `failure=null`. Consulta Owner nueva independiente confirma snapshot completo **idéntico** al baseline 79, cero cuentas/sesiones/hogares/previews/contratos y los 412 buckets históricos con hash intacto.
- Las ejecuciones anteriores mantienen su resultado fallido/incertidumbre original, con recibos separados `restored`; no se reescribió su evidencia. Los archivos de tipos modificados automáticamente por Next volvieron a la ruta normal del build, sin cambios funcionales.
- **Alcance certificado:** prueba parcial real de Auth/HTTP/inventario y rechazo seguro de una tarifa no aprobada. **No certificado:** contratación exitosa con proveedor real, pago/acreditación/webhook/reembolso externos, subida privada real de fotos, Google Routes o fidelidad/gestos del navegador. Los mocks y las fixtures financieras SQL no sustituyen esas verificaciones.
- Regresión final tras la corrección de origen y el mensaje genérico de error: **1.500/1.500 unitarias en 183 archivos, cero omitidas; 174/174 de dominio; 157/157 tooling**. TypeScript sin incremental, ESLint global, diff-check y build de 103 páginas correctos. Runtimes de pagos/imágenes correctos sin DB ni proveedor. Revisión independiente de código y recuperaciones sin hallazgos bloqueantes; esto no sustituye la aceptación externa pendiente.
