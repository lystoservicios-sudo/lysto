# Pedir: reparto bruto y cierre de verificación

## Estado operativo actualizado — 2026-10-14

Esta sección reemplaza los bloqueos de activación de los informes históricos de abajo. Por instrucción explícita del usuario, producción tiene habilitada la política de Pedir versión 1 con las reglas existentes, reparto **18% Lysto / 82% bruto profesional**, reserva de procesamiento cero y siete alcances iniciales. La migración `20261014235503_customer_rpc_business_conflicts` está aplicada en producción.

Mercado Pago: `MERCADOPAGO_MODE=live` actualizado en el proyecto Vercel `lysto-demo` y también especificado explícitamente en el despliegue de producción `dpl_A5SX2CwM7ujzcae436ezBDNiBbyb`. La cuenta conectada respondió `/users/me` con HTTP 200, identidad coincidente, sitio Argentina y sin etiqueta de usuario de prueba; acceso vigente. Se creó **una preferencia real impaga** y se leyó canónicamente (POST 201 / GET 200), por ARS 1.000 con comisión de ARS 180 y ARS 820 brutos para el profesional; vendedor/aplicación/referencia coincidentes y enlace de checkout real. Vence automáticamente el 2026-10-15 a las 01:37:53 UTC. No se creó un comprador ni un trabajo, no se efectuó un pago y no se modificaron checkouts de clientes para esa comprobación. La respuesta de preferencias no incluye `live_mode`; la cuenta real se verificó directamente, sin inferirlo del prefijo del token.

Se corrigió la validación de origen de las rutas de pago para aceptar únicamente el dominio público configurado, incluso detrás del proxy, y rechazar hosts ajenos. Pruebas enfocadas: RED reproducido; GREEN 52/52 en seis suites y verificación independiente 33/33 de la API, sin repetir la regresión completa. Lectura independiente de la cuenta y preferencia: HTTP 200/200 y verificaciones canónicas correctas. Vercel confirmó el despliegue **READY**, target `production`, con alias `lystohogar.com` y `www.lystohogar.com`. No equivale a certificar una acreditación bancaria ni una compra de punta a punta con un cliente real.

> Ejecución en el worktree existente `codex/customer-request-checkout`, mediante subagent-driven-development y TDD.

**Objetivo:** terminar el flujo aprobado de Pedir sin reservar un 6% estimado de Mercado Pago ni bloquearlo por ese descuento.

**Diseño aprobado por el usuario:** total del presupuesto = comisión Lysto + importe bruto del profesional. Los cargos reales del proveedor se conservan únicamente como observaciones financieras, no como un supuesto del precio. Los presupuestos históricos y el receptor/importes congelados de un checkout no se reescriben.

**Arquitectura:** corregir el calculador compartido y añadir una nueva migración para las validaciones afectadas, sin modificar la migración ya aplicada. Conservar autenticación, pertenencia, integridad financiera, política vigente, disponibilidad real y aprobación independiente de adicionales.

**Stack:** Next.js, TypeScript, Vitest, Supabase/PostgreSQL, Checkout Pro marketplace.

## Tareas

- [x] 1. Calculador: pruebas RED de tasa heredada 6% ignorada, split intacto y presupuesto listo sin `professional_net_floor`; devolver presupuesto de procesamiento cero por compatibilidad, mantener floor bruto y demás validaciones; GREEN y revisión independiente.
- [x] 2. SQL: reproducir el rechazo causado por presupuesto de procesamiento heredado en pruebas rollback; crear migración con CLI Owner aislada; quitar únicamente la resta del proveedor, mantener importes/split e identidades; revisar, probar con rollback, aplicar de forma atómica y verificar historial/permisos/advisors.
- [x] 3. Recorrido completo: ampliar pruebas de resumen, contratación, pago y retorno canónico; errores, reintentos y adicionales sin alterar importe aprobado. Ejercitar la frontera real del coordinador con proveedor simulado cuando no exista una operación de prueba autorizada/configurada.
- [x] 4. Verificación adicional segura: intentar navegador integrado; comprobar viabilidad de HTTP/E2E y concurrencia sin Docker ni navegador personal. No sustituir evidencia faltante con fixtures comerciales de producción. Concurrencia real y prueba parcial Auth/HTTP completadas en QA; compra/pago/proveedor y visual real siguen sin certificar, como se detalla abajo.
- [x] 5. Regresión final: unitarias, dominio, tooling, TypeScript, lint, build, revisión de especificación y calidad; actualizar documentación con evidencia y límites exactos. Esto no supone activar cobros ni certificar verificaciones externas faltantes.

## Restricciones

No cobros reales, OAuth refresh, nuevos porcentajes comerciales, tarifas inventadas, reescritura de datos reales, migraciones ajenas ni secretos en el repositorio. En producción, las fixtures SQL viven dentro de BEGIN/ROLLBACK. Para concurrencia se permite únicamente el QA explícito y comprobado vacío `obksyzasmfwcbbksesqt`: fixtures sintéticas compartidas entre transacciones, manifiesto de UUIDs propios y limpieza transaccional revisada; ninguna fixture representa una tarifa real. Mantener cargos reales `provider_fee`/`net_received_amount`. Un fallo del MCP no bloquea el acceso CLI Owner ya verificado. No declarar listo para cobros si sigue faltando configuración comercial real.

## Cierre acotado aprobado — 2026-10-14

El usuario pausó el trabajo general y reiteró únicamente retirar el 6%, conservando la división Lysto/profesional. No se reanudaron las tareas ajenas de Pedir ni se aprobaron tarifas, activaciones, publicación o cobros.

- Calculador vigente: tasa por defecto cero y reserva cero incluso con una política heredada no nula. Total, comisión y parte profesional bruta sin cambios; no se genera el bloqueo por neto estimado del proveedor.
- Base real: migración `20261014213321` aplicada previamente, con 70 comprobaciones SQL/RPC transaccionales correctas y fixtures revertidas. Consulta independiente nueva confirma historial y ausencia de `paymentCostBudget` en ambas validaciones vigentes. No hubo escrituras de producción en este cierre acotado.
- Interfaz interna: retirados el editor del 6%, el costo estimado y el supuesto neto. Se muestran únicamente comisión Lysto y parte bruta profesional. Cargar una política heredada no la guarda ni aprueba; solo una nueva configuración guardada explícitamente por Finanzas normaliza su campo obsoleto a cero.
- Compatibilidad: snapshots históricos y observaciones reales del proveedor intactos. El API legacy `review_service_quote(uuid,text)` sigue archivado con EXECUTE exclusivo de postgres, sin acceso del navegador/service_role ni referencias en la aplicación; no se reactivó ni reescribió.
- TDD UI: 3 fallos esperados antes de implementar, 5 pruebas correctas después. Verificación final independiente: **63/63 pruebas enfocadas en siete suites**, **18/18 guardas de tooling**, TypeScript, lint dirigido y diff-check correctos. Revisión independiente de especificación y calidad aprobada.
- Esto certifica la retirada del supuesto del 6%, no la finalización general de Pedir ni un despliegue o acreditación real. El resto del trabajo y sus pruebas externas permanecen pausados.

## Reanudación completa — 2026-10-14

El usuario confirmó 18% para Lysto y 82% bruto para el profesional, y pidió retomar las pantallas/funciones pendientes y todas las pruebas. Esta reanudación revoca la pausa anterior; no supone aprobación de otras tarifas, duraciones o vencimientos comerciales.

Plan de cierre: completar recuperación explícita de PUT inciertos con pruebas de carreras y revisión independiente; repetir unitarias/dominio/tooling/typecheck/lint/build; repetir SQL rollback/RPC/roles y comprobar fixtures cero; agotar el navegador integrado y las alternativas aisladas disponibles para pruebas HTTP/concurrencia sin Docker ni navegador personal. Mantener separación entre pruebas reales de base, transportes simulados y pagos efectivamente acreditados. No ocultar verificaciones externas faltantes ni activar cobros con precios ficticios.

### Recuperación y recorridos completados

- La acción «Revisar ubicación actual» refresca el contexto canónico solo para PUT versionados inciertos de hogar/dirección. La versión actual debe superar la esperada; no permite descartar un POST pendiente ni atribuye una escritura incierta al usuario.
- Un comando guardado diferente, corrupto o reemplazado durante la red mantiene el bloqueo. Identidad canónica mediante el esquema existente, comprobada antes de enviar/reproducir y antes de limpiar; se respeta orden de arrays y valores reales. Un fallo al limpiar almacenamiento conserva el pendiente.
- TDD reprodujo el borrado incorrecto de un POST más nuevo y el falso desacuerdo por orden de claves antes de corregirlos. Revisión independiente final: 22 casos de recuperación, 28 del cliente Hogar y cuatro recorridos completos correctos, sin hallazgos pendientes.
- Recorridos completos del formulario: reparación, mantenimiento, instalación y alta inline desde inventario vacío —hogar, ambiente, registro/ubicación del aire— hasta presupuesto, contratación y confirmación canónica. Handlers, validaciones y calculador reales; transportes externos de inventario/pagos simulados. Verifican 18%/82%, reserva de procesamiento cero, una sola preparación/preferencia y recuperación del mismo servicio.
- El recorrido de coordinadores conserva cargos observados de proveedor de 0%, 3% y 12,5% sin cambiar el presupuesto ni su reparto congelado. No acredita pagos del proveedor.
- Nueva ejecución en producción: 70/70 comprobaciones SQL/RPC/roles correctas dentro de ROLLBACK; consulta posterior independiente verifica cero fixtures/previews/contratos, política deshabilitada y membresía Owner exactamente restituida. Advisors: 75 WARN preexistentes y cero ERROR.

### Concurrencia real y limpieza de QA completadas

- Destino único: `lysto-staging`, ref `obksyzasmfwcbbksesqt`, previamente comprobado vacío. Instalación transaccional de los cuatro prerrequisitos exactos revisados; historial 74→78, tablas con RLS y ninguna migración ajena aplicada. No se fabricó el rol marketplace ausente en QA: preparación bajo `service_role` y transiciones financieras bajo postgres; el rol real marketplace ya se verificó en producción dentro de ROLLBACK.
- Cinco casos reales con diez PIDs distintos y `pg_blocking_pids` observado: mismo comando; dos comandos sobre la misma preview; clientes diferentes compitiendo por un cupo; expiración antes de aprobación; aprobación antes de expiración. Los dos primeros devuelven el mismo servicio; la competencia permite un único servicio; pago tardío produce revisión, no falsa reserva; pago previo mantiene la reserva confirmada.
- Importes sintéticos exclusivos de QA: total 130.000, Lysto 23.400, profesional 106.600, reserva de procesamiento cero. No son tarifas reales ni acreditaciones de Mercado Pago. La ruta también es sintética y no llama Google.
- La primera limpieza SQL encontró `storage.protect_delete`, falló con 42501 y revirtió toda su transacción. La recuperación revisada usa la API oficial para el único avatar sintético de ese manifiesto, con comprobación previa de usuario/perfil/profesional/path, credencial QA validada exclusivamente en memoria y comprobación de ausencia posterior. No se desactivaron triggers ni se modificó `storage.allow_delete_query`.
- Limpieza SQL restante transaccional, limitada a UUIDs propios y protegida contra cambios comerciales ajenos. Consulta nueva independiente confirma cero fixtures y restauración **exacta** de punteros, conteos, ACL de tablas/funciones, owners, RLS/policies y membresías. Manifest: `cleaned`, `remoteUncertain=false`; se conservan las cinco evidencias de bloqueo.
- El runner reutilizable carga/elimina el avatar por API, nunca escribe el esquema Storage. Si una futura carga pierde su respuesta antes de obtener un receipt y antes de crear identidad, se bloquea para revisión manual: no promete limpieza automática ni borra por un UUID aislado.
- Advisors QA: 72→73 WARN, cero ERROR; una advertencia adicional de RPC `SECURITY DEFINER` autenticada. Se inspeccionó el helper histórico `public.get_job_professional_name`, instalado como prerrequisito y señalado por el advisor: acceso autenticado intencional, `search_path` vacío, comprobación de participante del trabajo/permiso Operations y nombre acotado. No se silenció ni se reescribió esa migración histórica. En producción el baseline permanece 75 WARN sin nuevos hallazgos.

### Entrega técnica y límites

- Regresión final posterior al ajuste de origen: **1.500/1.500 unitarias en 183 archivos; 174/174 de dominio; 157/157 tooling**, todas sin omitidas. TypeScript sin incremental, ESLint global sin advertencias, diff-check y build de producción correctos (103 páginas). Los smokes de pagos/imágenes pasan sin cobros ni acceso externo a DB. Reporte local ignorado por Git: `output/customer-request-unit-origin-final.json`.
- Veinte guardas propias del runner, incluidas dos pruebas inyectadas de red: timeout de carga sin receipt conserva incertidumbre y prohíbe limpieza automática; error de eliminación no anuncia una ausencia falsa. Revisión independiente incremental de especificación/calidad aprobada, sin hallazgos bloqueantes. Estas pruebas no ejecutan una nueva carga remota.
- Pantallas/funciones de cliente implementadas y revisadas: siete pasos, altas mínimas de Hogar/ambiente/aire dentro de Pedir, fotos privadas, recuperación, presupuesto/asignación servidor, pago/reintento/retorno canónico y enlaces al servicio. El trabajo permanece en el worktree existente, sin commit/push/merge/despliegue.
- **No certificado:** recorrido completo con proveedor externo y E2E/QA visual reales. La prueba parcial real Auth/HTTP sí se completó y se acota abajo. El navegador integrado rechazó el puente autorizado; no se evade con navegador personal. Los runners completos existentes no tienen identidad/conexión PG protegidas ni cuentas de pago de prueba separadas. Las pruebas de coordinadores y aprobación sintética SQL no sustituyen esas verificaciones.
- **Antes de habilitar cobros:** producción necesita una política real vigente de tarifas y alcance inicial/duración/agenda. El reparto 18%/82% ya está aprobado; no hay ninguna reserva ni bloqueo pendiente por una comisión estimada de Mercado Pago. No se cargó una tarifa ficticia para aparentar disponibilidad.

### Cierre de conflictos RPC y prueba parcial Auth/HTTP

- La primera prueba real con dos identidades QA y cookies SSR obtuvo diez comprobaciones HTTP antes de que el conflicto de versión manual `40001` quedara reintentándose en PostgREST 14. Se comprobó el PID exacto del fixture antes de detenerlo. La migración `20261014235503` transforma únicamente esos conflictos de negocio en `PT409`; mantiene errores genuinos del motor, OIDs, ACL, RLS y políticas. [Incidencia y solución oficiales](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b).
- QA tiene 79 migraciones tras aplicar esa corrección exacta. Producción solo recibió la prueba transaccional de la corrección más 70 casos RPC/roles y ROLLBACK; no se persistió un código que la versión desplegada anterior aún no entiende. La migración debe acompañar al código compatible en el release.
- Primer run recuperado y baseline completo restaurado; históricos rate limit 412, hash intacto. Manifiesto fallido conservado y recibo de recuperación separado. La prueba no se presenta como exitosa.
- La segunda ejecución Auth/HTTP encontró un 503 en la primera lectura de inventario por Next y no hizo mutaciones de hogar/equipo/solicitud/pago. La reconciliación solo de lectura verificó dos cuentas/sesiones propias, ausencia de RPC activos y de datos comerciales, puerto local cerrado e históricos sin cambios. Ese run se recuperó después con recibo separado, como se detalla abajo; **no se presenta ese resultado fallido como una prueba HTTP aprobada**.

### Prueba parcial real completada y recuperaciones cerradas

- Ejecución final `4642522b-d042-4466-8f7d-2ed8fe825399`: **17/17**, salida 0, Auth/registro reales, cookies SSR y APIs Next→PostgREST. Incluye altas idempotentes, ambiente/aire, conflicto de versión 409 e aislamiento entre clientes. Preview devuelve la falta real de aprobación de tarifas sin pedido ni cobro; no es una compra exitosa.
- Corrección de origen en preview/prepare: se valida `NEXT_PUBLIC_APP_URL`, no la URL interna del servidor. Dos fallos RED se corrigieron; 17 pruebas API y 39 ampliadas pasan. Orígenes faltantes/ajenos y spoofing del host interno siguen rechazados antes del cuerpo. Actor, rol, pertenencia, rate limit, switches y respuestas privadas intactos.
- Los tres runs fallidos previos se recuperaron exclusivamente por identidades/UUIDs/HMAC propios, tras reconciliación SQL y revisión independiente. Sus manifiestos originales e incertidumbres se conservaron; recibos separados `restored`. No se deshabilitó una protección para borrarlos ni se usó una cuenta real.
- El run final sí completó el teardown normal: logout directo con JWT legítimo en RAM, prueba fresca de cero sesiones, Auth DELETE de los dos usuarios y prueba de cascadas ausentes, limpieza de los dos HMAC. Consulta Owner independiente verifica baseline completo 79 idéntico, datos sintéticos cero y 412 buckets históricos sin cambiar una fila.
- El episodio 503 no se reprodujo en las dos corridas siguientes; no se conoce su causa retrospectiva ni se afirma una corrección de Auth. La instrumentación añadida guarda únicamente códigos aprobados y tiempos numéricos, no credenciales.
- Pendientes externos siguen explícitos: compra/pago/acreditación/webhook/reembolso real del proveedor, subida privada de fotos y Google Routes reales, navegador/3D/gestos. No se activaron tarifas o cobros ni se publicó el código.
