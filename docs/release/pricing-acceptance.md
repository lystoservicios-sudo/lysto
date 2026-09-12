# T14 — Aceptación de presupuestos

Estado: implementación verificada localmente. La aprobación comercial de D05 permanece pendiente.

## Contrato de operación

Operaciones calcula y revisa alcance, materiales, traslado y exclusiones. Finanzas u owner registra una versión de política con fuente, fecha, vigencia y motivo. Un cambio de política conserva los presupuestos históricos; los pendientes requieren recalcular bajo la versión vigente antes de ofrecerse o aceptarse.

Los importes se calculan en servidor. Una ruta manual registra al operador y su fundamento; su procedencia no puede declararse como Google. Recalcular un presupuesto crea una revisión vinculada al mismo cliente. La versión reemplazada conserva su historial y deja de ser aceptable.

La aceptación crea una única solicitud y trabajo, conserva sus importes y devuelve los mismos identificadores al reintentar. Aceptar una solicitud no confirma disponibilidad de un profesional ni realiza un cobro; agenda y pagos tienen sus propios controles.

La pantalla consulta el estado persistido si se pierde la respuesta de aceptación. El cliente conserva únicamente las fotos verificadas seleccionadas: las revisiones heredan ese conjunto y la aceptación lo vincula dentro de la misma transacción. Los archivos pendientes o deseleccionados no se adjuntan. Permisos revocados durante la espera de una escritura y fallos al guardar la auditoría cancelan toda la operación.

Las fuentes y políticas se guardan en tablas privadas versionadas; una escritura genérica a settings no las habilita. Las operaciones antiguas sin versión y el INSERT directo con service-role están revocados. Los presupuestos históricos conservan sus datos; los pendientes sin la nueva evidencia de aprobación deben recalcularse. Los importes usan aritmética decimal para redondear a centavos; la cobertura de costos compara centavos y la vigencia de la tarifa termina al finalizar el día aprobado en Buenos Aires.

## Evidencia comercial pendiente

D01/D02/D03/D05 deben aportar la política efectiva y casos firmados por finanzas: mano de obra, traslado, materiales, recargo, comisión, costo real del proveedor de cobro, neto profesional y fechas de vigencia. Las referencias iniciales CAIM y los fixtures de integración no sustituyen esta aprobación. No se cargó una política de producción en esta etapa.

## Contratos implementados

| Operación | Autoridad y datos relevantes |
| --- | --- |
| `POST /api/pricing/quote` | Cliente propio u operaciones con MFA. El servidor calcula; rechaza importes/actores enviados por cliente. Una ruta manual exige `source: manual` y `manualRouteReason`. |
| Recalcular con `save: true` | Operaciones envía `previousQuoteId`, `expectedVersion` y `revisionReason`; cliente y fotos se conservan. Un competidor recibe 409. |
| `GET /api/pricing/policy` | Devuelve política, ID y revisión actuales. La referencia por defecto tiene revisión 0 y carece de aprobación. |
| `PUT /api/pricing/policy` | Finanzas/owner con MFA; `{policy, expectedRevision, reason}`. `approvedUntil: null` retira la aprobación para nuevas ofertas. |
| `PATCH /api/pricing/quotes` | Operaciones; `{quoteId, expectedVersion, reason}`. Valida tarifa actual, ruta/cobertura/peajes/materiales/equipo, neto profesional, fotos y vigencias. |
| `POST /api/customer/request/submit` | Cliente propietario; `{quoteId, expectedVersion}`. Crea todo atómicamente y devuelve `request_id`, `job_id`, `quote_id` y estado inicial persistidos. Repetir devuelve los mismos datos. |
| `GET /api/pricing/quotes` | RLS por identidad. `pageSize` 1–100 y `cursor` ligado a esa identidad; devuelve `quotes`, `total`, `nextCursor`. `quoteId` permite recuperar una decisión exacta y no se combina con paginación. |

Todas las mutaciones HTTP usan verificación de origen y límite de cuerpo. La escritura calculada recibe identidad y sesión verificadas desde el servidor y vuelve a comprobarlas con locks en SQL. Las fotos iniciales se seleccionan por `uploadIntentIds` (máximo cinco, un borrador propio); sólo archivos verificados, presentes y aún disponibles se pueden aceptar.

## Verificación local

Se incorporan regresiones para procedencia manual, política no aprobada, revisión concurrente, aislamiento de cliente, expiración, aceptación repetida y redondeo decimal equivalente a PostgreSQL NUMERIC. La evidencia está en `pricing-verification.json`: 452 pruebas unitarias, 171 de dominio, 8 de tooling, 216 de integración, 511 SQL fresh/upgrade y build aislado completados; 41 migraciones y dos presupuestos históricos conservados.

## Recuperación

Ante una tarifa errónea se debe retirar la habilitación de nuevas ofertas mediante una nueva política sin aprobación. Conservar las aceptaciones y sus snapshots; resolver cualquier ajuste comercial mediante el circuito correspondiente, sin reescribir precios históricos.
