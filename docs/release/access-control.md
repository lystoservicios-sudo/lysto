# T06 — Sesión y autorización del servidor

Estado al 2026-09-11: implementación, pruebas dirigidas y suite HTTP con Auth real completadas; lint/tipos y verificación de compilación del candidato pendientes de consolidación por el coordinador. Este documento no habilita producción ni promueve G04. T08 y T09 siguen siendo requisitos de identidad y autorización.

El alcance aprobado continúa siendo el plan de producción de 40 tareas. Los cierres provisionales descritos abajo eliminan respuestas simuladas mientras se implementan sus tareas; no constituyen exclusiones aprobadas para un piloto, cambios de contratos ni aceptación de D12.

## Fuente de autoridad

- `lib/auth/session.ts`: `requireSession`, `requireRole`, `requireAdminPermission`, `requirePageSession` y tipos `Session`/`AdminPermission`. El módulo usa `server-only`.
- `supabase/migrations/20260911042254_server_session_context.sql`: migración creada mediante Supabase CLI. `public.get_session_context()` es un wrapper SECURITY INVOKER sin parámetros de identidad; delega en `private.get_session_context()`, SECURITY DEFINER con search_path vacío y referencias calificadas. Sólo authenticated puede ejecutarla. No expone tablas privadas.
- `get_session_context()` deriva de auth.uid() el perfil actual, comprueba coincidencia entre el rol del perfil y app_metadata.app_role del JWT y devuelve IDs propios, estado profesional y permisos administrativos actuales. No usa user_metadata ni IDs de actor enviados por el navegador.
- `requireSession()` verifica la identidad con Auth.getUser(), valida el contexto DB y requiere la entidad correspondiente al rol. Rechaza profesionales no aprobados y administradores sin permisos. No almacena el contexto en una caché compartida entre solicitudes.
- `requireAdminPermission()` acepta el permiso solicitado o owner, con la misma jerarquía que el helper SQL existente. El permiso operations se comprueba antes de calcular o guardar presupuestos mediante el cliente privilegiado; finance se exige para modificar la política de precios.
- `lib/pricing/server.ts` mantiene `getPricingSession` y `PricingSession` como adaptadores. `requirePricingPermission` reutiliza el control central.
- `lib/payments/marketplace-session.ts` conserva elegibilidad profesional y ownership de checkout; el administrador requiere finance/owner mediante el contexto común. No se reemplazan los filtros de propiedad de las consultas PostgreSQL directas.

La migración se aplicó únicamente al proyecto local descartable. Los tipos se regeneraron mediante CLI. No se aplicó a la base original ni a proyectos remotos.

## Paneles, navegación y caché

Los layouts de `/app`, `/pro` y `/admin` son dinámicos y verifican sesión/rol antes de devolver el panel. El administrador accede a su propio panel; no adquiere la identidad visual de cliente o profesional. Los límites de ruta respetan segmentos: `/application` no pertenece a `/app`.

El middleware refresca cookies Supabase SSR mediante getAll/setAll. Transmite los cambios al render del servidor y al navegador, conservando `Cache-Control: private, no-store, max-age=0`. Los layouts, APIs y SQL mantienen sus controles propios; el middleware no es la única barrera. Las respuestas JSON privadas y sus errores usan no-store también fuera del middleware.

`safeLocalRedirectPath()` admite destinos locales dentro del panel del rol verificado. Rechaza orígenes externos, URLs relativas a otro host, barras invertidas, caracteres de control, codificación inválida y navegación a otro panel. El login usa este filtro para el campo opcional next y mantiene el destino por rol cuando el valor no es válido.

## Matriz histórica de las 36 rutas API

Esta sección conserva la línea base de T05. El inventario operativo vigente, generado desde el código y verificado automáticamente por T26, está en [api-inventory.md](../architecture/api-inventory.md). Ese inventario contiene 92 métodos exportados, incluidas las rutas agregadas después de esta auditoría.

Se conservan 14 rutas con implementación DB/proveedor: 13 privadas y un webhook público. Se mantienen 5 rutas retiradas. Se cierran explícitamente 16 rutas parciales y un cálculo auxiliar pendiente de límites/contrato. La matriz HTTP cubre los 37 métodos exportados de las rutas privadas activas o cerradas; los 5 retiros y el webhook tienen contratos separados. HEAD/OPTIONS generados por el framework no se cuentan como métodos exportados de aplicación.

### Implementación existente protegida

| Ruta | Métodos | Autoridad actual |
|---|---|---|
| `/api/customer/request/submit` | POST | Cliente autenticado; identidad propia y RPC submit_service_quote. |
| `/api/jobs/extras` | GET, POST, PATCH | GET: filas visibles por RLS. POST: profesional aprobado, con asignación comprobada por RPC. PATCH: cliente dueño, comprobado por RPC. |
| `/api/pricing/job` | GET | Sesión vigente y recurso visible por RLS; inexistente o ajeno devuelve 404. |
| `/api/pricing/job/status` | POST | Profesional aprobado; RPC comprueba asignación, estado y pago previo. |
| `/api/pricing/offers` | GET, POST | Admin operations para consulta administrativa/asignación. Respuesta: profesional aprobado y asignado. Lecturas de participantes filtradas por RLS. |
| `/api/pricing/policy` | GET, PUT | Lectura autenticada. Mutación: admin finance/owner y RPC vigente. |
| `/api/pricing/quote` | POST | Cliente propio o admin operations/owner; control previo a proveedor de rutas y escritura privilegiada. |
| `/api/pricing/quotes` | GET, PATCH | GET: sesión y RLS, sin listado global por rol visual. PATCH: admin operations/owner y RPC de revisión. |
| `/api/mercadopago/account` | GET, DELETE | Profesional aprobado, cuenta propia. DELETE conserva control de Origin y bloqueo cuando hay pagos asociados. |
| `/api/mercadopago/checkouts` | GET, POST | Cliente/profesional: checkouts propios. Admin: finance/owner. POST reconcile conserva ownership; renew exige admin financiero. |
| `/api/mercadopago/create-preference` | POST | Cliente dueño; importes/beneficiario canónicos, Origin e idempotencia existentes. |
| `/api/mercadopago/oauth/authorize` | POST | Profesional aprobado; Origin, state y cookie vinculada a usuario/profesional. |
| `/api/mercadopago/oauth/callback` | GET | Requiere sesión profesional y comprobación de state/cookie. No se hizo anónimo por ser callback. |
| `/api/mercadopago/webhook` | POST | Público exclusivamente para notificación del proveedor: conserva firma, consulta canónica y deduplicación. No usa sesión de usuario. |

Los RPC transaccionales y las políticas RLS existentes siguen siendo autoridad de propiedad y estado. Las lecturas cuyo resultado es una colección pueden devolver una colección vacía por RLS; no se afirma que todas las denegaciones SQL tengan idéntico código HTTP. T12/T14/T26 completan DTOs y contratos de errores por operación.

### Rutas retiradas

Estas rutas devuelven 410 sin evaluar estados/actores recibidos y sin ejecutar una mutación:

| Ruta | Sustitución |
|---|---|
| `/api/admin/assign-professional` | `/api/pricing/offers` |
| `/api/jobs/advance` | `/api/pricing/job/status` |
| `/api/jobs/update-status` | `/api/pricing/job/status` |
| `/api/payments/webhook/apply` | `/api/mercadopago/webhook`, sólo con controles del proveedor |
| `/api/service-request/preview` | `/api/pricing/quote` |

### Rutas provisionalmente cerradas

Todas exportan POST mediante `unavailableRoute`. Primero se verifica identidad y permiso; el actor autorizado recibe 503 con `code: feature_unavailable`. No se analiza el body para producir una aprobación, firma, invitación, diagnóstico, cierre o persistencia simulados.

| Ruta | Control previo al cierre | Tarea que completa o retira el contrato |
|---|---|---|
| `/api/admin/approve-professional` | Admin operations | T11/T26 |
| `/api/admin/invite-professional` | Admin operations | T11 |
| `/api/admin/pricing/update` | Admin finance | T14/T26 |
| `/api/admin/professionals/approve` | Admin operations | T11 |
| `/api/equipment/register` | Cliente | T13 |
| `/api/jobs/final-report` | Profesional aprobado | T20 |
| `/api/maintenance/schedule` | Cliente | T25 |
| `/api/notifications/emit` | Admin operations; entrada genérica no habilitada | T24/T26 |
| `/api/pro/jobs/action` | Profesional aprobado | T19/T26 |
| `/api/pro/onboarding/evaluate` | Admin operations | T11/T26 |
| `/api/professional/onboarding` | Profesional; candidatos no aprobados siguen denegados | T11 |
| `/api/professional/respond-request` | Profesional aprobado | T16/T26 |
| `/api/quality/open-case` | Admin quality | T23 |
| `/api/reviews/submit` | Cliente | T21 |
| `/api/uploads/sign` | Sesión operativa vigente; ninguna URL emitida | T10 |
| `/api/warranty/claim` | Cliente | T23 |
| `/api/diagnosis/generate` | Cliente/admin; cálculo auxiliar cerrado | T26/T30 |

## Entradas públicas y cierres especiales

Las páginas informativas, login y registro conservan entrada pública. Su funcionalidad completa, límites y contenido de producción siguen bajo T07/T30/T31.

`/comprobante/[token]` está cerrado con notFound, noindex/nofollow y no-store. Se retiró la muestra fija que presentaba un servicio completado sin consultar el token. T22 deberá reabrirlo sólo con token persistido válido/revocable y proyección pública mínima. Este cierre provisional no satisface la funcionalidad de comprobantes de T22.

`/pro/onboarding/[token]` no es una excepción global al panel profesional. T11 deberá crear acceso acotado por invitación válida y sesión, permitiendo al candidato completar su incorporación sin abrir el panel operativo. El cierre del POST impide una autoaprobación basada en el body.

## Errores y estados

- API privada sin identidad válida: 401, code unauthorized.
- Identidad sin rol/entidad/permiso suficiente o profesional no aprobado: 403, code forbidden.
- Checkout inexistente/ajeno: mismo 404, code not_found. La consulta de trabajo conserva su 404 existente para ambos casos.
- Operación provisionalmente cerrada: 503, code feature_unavailable.
- Fallo de disponibilidad de Auth/contexto: 503, code session_unavailable, sin incluir detalles del proveedor o base.
- Los layouts redirigen al login cuando falta identidad y usan notFound para rol denegado. Su comportamiento HTTP real todavía debe comprobarse en esta etapa.

Los mensajes de negocio de precios/pagos se preservan donde corresponden. T06 no certifica por sí solo todos los contratos de error o validación de las futuras tareas.

## Evidencia ejecutada

| Verificación | Resultado observado | Evidencia |
|---|---|---|
| Rojo inicial de sesión/control de acceso | 24 fallos por carencias reales antes de implementación | `output/production-readiness/t06-unit-red.log` |
| Rojo de roles de dominio | 3/5 pasaron; fallaron admin entre paneles y límites de prefijo | `output/production-readiness/t06-role-red.log` |
| Rojo adicional de fronteras | 14 fallos y 52 pases antes de completar redirects, comprobante y Auth no disponible | `output/production-readiness/t06-boundaries-red.log` |
| Verde dirigido de T06 y regresiones cercanas | 140/140 en 14 archivos, 41,54 s | `output/production-readiness/t06-targeted-green.log` |
| pgTAP tras migración en descartable | 434/434 en 10 archivos; incluye session_context | `output/production-readiness/t04-t06-pgtap-retry.log` |
| Rojo HTTP de preparación de refresh concurrente | 61/62 pasaron; único fallo por expires_at cliente todavía futuro | `output/production-readiness/t06-http-concurrency-red.log` |
| Verde HTTP completo de control de acceso | 62/62, cero omitidos, exit 0; 121,89 s | `output/production-readiness/t06-http-concurrency-green.log` |
| Revisión de espacios del diff | Sin errores; avisos de normalización CRLF | `git diff --check` ejecutado durante implementación |

El primer intento de pgTAP posterior a la migración tuvo timeout de conexión; el pase corresponde al reintento completo registrado, no al intento fallido. Las comprobaciones de SQL usan pgTAP y JWT de prueba dentro de transacciones; no sustituyen la suite HTTP con sesiones reales.

El verde dirigido incluye session, session-middleware, auth-session-routing, login-flow, login-server-action-contract, login-form, access-controls, api-route-contracts, payment-session, pricing-api, marketplace-api, marketplace-contract, retired-lifecycle y professional-ui. Estas pruebas de Vitest usan dobles donde corresponde; no se presentan como tráfico HTTP real de producción.

## Aceptación HTTP de T06

`tests/integration/access-control.test.ts` pasó sus 62 casos con los helpers locales `startTestApp()` y `fixtureCookieHeader()`, ocho cuentas con sesiones Auth reales y un servidor Next local. El runner ejecutó el archivo completo con la guarda del entorno descartable y confirmó cero pruebas omitidas. El reporte JSON es `output/integration/bf4a1ce0-60df-42fb-b97f-508d007f7533/result.json`. Incluye:

- Los 37 métodos privados: rechazo anónimo y no-store.
- Los tres paneles sin login y cruces de rol, incluido profesional suspendido.
- Permisos insuficientes antes de calcular/modificar precios y antes de APIs parciales.
- Operadores autorizados que reciben cierre explícito en vez de éxito simulado.
- Cliente A/B: lectura propia, 404 ajeno/inexistente y repetición sin contaminación de caché.
- Profesional asignado/no asignado.
- Cambio de permiso consultado con cookie real ya emitida y cookie SSR alterada.
- Dos solicitudes concurrentes con exactamente la misma cookie que requiere renovación: ambas devuelven Set-Cookie, 200 y no-store; las dos cookies resultantes conservan acceso propio en solicitudes posteriores.
- Webhook sin requisito de login y comprobante arbitrario sin publicación ficticia.

La suite crea sólo dos solicitudes/jobs sintéticos con IDs del propio ensayo y los borra antes de limpiar las cuentas Auth. El acceso PostgreSQL del ensayo usa la guarda de entorno descartable. No usa la base original ni un proyecto remoto.

El ensayo concurrente conserva el JWT y refresh token emitidos por Auth y vence únicamente `expires_at`, metadato cliente sin firma, para activar la ruta real de renovación del SDK. Usa `combineChunks`, `createChunks`, `isChunkLike` y los helpers base64 públicos de la versión SSR instalada para leer/reemitir la cookie. No fabrica un JWT firmado expirado y no acredita revocación estricta de T08. La prueba falló primero por carecer de esta preparación y pasó después; el caso concurrente tardó 3,529 s dentro de la suite verde completa.

La limpieza de cuentas está disponible desde que empieza el setup: el hook final llama `pendingFixtures.cleanup()` directamente, aunque la creación de cuentas no haya terminado. El servidor HTTP se detiene al finalizar el ensayo.

Faltan además lint/tipos y compilación del candidato que incorpora T06. Los builds históricos de T02 no verifican estos cambios nuevos. El agente coordinador ejecutará esos controles y actualizará este registro únicamente con resultados observados.

## Límites que continúan abiertos

- **T08:** MFA administrativo y revocación estricta de sesiones. Consultar rol/permisos/estado profesional vigentes no prueba invalidación inmediata de un JWT tras cerrar sesión. No se incorporó verificación de auth.sessions ni security-version en T06.
- **T09:** permisos por función administrativa, gestión de grants y garantías completas de operación privilegiada. Se reutiliza el almacenamiento privado y los controles SQL ya existentes.
- **T11:** invitaciones/onboarding/aprobación persistidos; no reabrir endpoints sólo para recuperar una pantalla.
- **T22:** publicación real de comprobantes; el 404 provisional impide simulación, pero no cumple el producto final.
- **T10/T12–T30:** cargas autorizadas, DTOs, flujos persistidos, controles de concurrencia, límites de abuso, observabilidad y demás tareas conservan sus criterios de aceptación.
- **T34/T36–T39:** recorridos sobre build de producción, staging, piloto y autorización final mantienen sus gates. Ningún pase unitario ni cierre temporal los reemplaza.

Para recuperación se conserva deny-by-default. Reabrir una ruta requiere su implementación real, los permisos/ownership correspondientes y evidencia de aceptación; no basta cambiar 503/410 por una respuesta 200.
