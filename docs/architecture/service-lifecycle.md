# Contrato único de ciclo de servicio

Fecha: 2026-09-11. Implementación T05 del plan de producción. Deriva del anexo normativo aprobado; las decisiones comerciales D01–D12 conservan su estado en `docs/release/decision-register.md`.

## Autoridades

La identidad proviene de sesión verificada y perfil vigente. Las funciones SQL autorizadas y sus triggers son la autoridad de mutación, propiedad y concurrencia. TypeScript refleja posibilidades para presentación y pruebas; no acredita pago ni autoriza una operación recibida del navegador. Un enum describe un valor persistido, no un permiso.

El precio proviene del snapshot aceptado de `service_quotes`. El dinero proviene de `marketplace_payment_observations` y su agregación en `marketplace_checkouts`; `payments` es una proyección de compatibilidad. El trabajo asíncrono requiere eventos persistidos y un consumidor autorizado, desarrollado en T24.

## Secuencia y estados persistidos

Presupuesto aceptado → trabajo pendiente de asignación → oferta profesional → aceptación profesional → checkout → pago canónico aprobado → visita → cierre técnico → conformidad explícita → reseña opcional/postservicio.

No se crea un segundo enum funcional. Las solicitudes históricas pueden conservar `pending_payment`, `payment_approved` y `matching`; su lectura sigue siendo compatible, pero no son la entrada de un nuevo flujo de cobro antes de asignación. El wizard puro termina la preparación en `price_selected`; aceptar el snapshot en SQL crea solicitud y trabajo `pending_assignment`. El modelo de ciclo completo incluye esa aceptación, por eso termina ese paso en `pending_assignment`.

| Entidad y columna | Estados reales | Significado / condición adicional |
| --- | --- | --- |
| Solicitud `service_requests.status` | `draft`, `diagnosis_completed`, `address_completed`, `schedule_completed`, `price_selected`, `pending_assignment`, `pending_professional_acceptance`, `assigned`, `cancelled`, `expired`; compatibilidad `pending_payment`, `payment_approved`, `matching` | El estado del trabajo y el checkout gobiernan visita y dinero. |
| Presupuesto `service_quotes.status` | `needs_review`, `ready`, `accepted` | Vencimiento por `expires_at`; aceptación por `accepted_at` y `request_id`. Snapshot inmutable incluso antes de aceptar; una revisión modifica decisión, no precio anterior. |
| Trabajo `jobs.status` | `pending_assignment`, `pending_professional_acceptance`, `confirmed`, `technician_on_way`, `arrived`, `onsite_diagnosis`, `waiting_customer_approval`, `in_progress`, `completed_pending_customer_confirmation`, `completed`, tres `cancelled_by_*`, `disputed`, `warranty_claim` | `confirmed` confirma profesional; no significa pagado. `completed_pending_customer_confirmation` confirma informe técnico; no significa conformidad. |
| Checkout `marketplace_checkouts.status` | `creating`, `ready`, `pending`, `in_process`, `approved`, `rejected`, `cancelled`, `refunded`, `partially_refunded`, `charged_back`, `review`, `expired` | Sólo `approved` del servicio inicial habilita visita. `review`, contracargo o devolución bloquean aunque una proyección anterior diga approved. |
| Adicional `job_extras.status` | `proposed`, `accepted`, `rejected` | Aceptación del cliente no acredita pago. Intento independiente con `extra_id`; nunca reescribe el snapshot original. |
| Calidad `complaints.status` | `open`, `in_review`, `resolved`, `rejected` | Caso ligado a servicio, responsable y evidencia; no reemplaza automáticamente el estado financiero. |
| Garantía `warranty_claims.status` | `open`, `approved`, `rejected`, `completed` | Cobertura y revisita derivadas de datos persistidos y política aprobada; no de un booleano del body. |

## Tabla de decisiones y efectos

| Estado / evento | Actor | Precondición | Efecto autorizado | Prohibición / tarea que amplía el circuito |
| --- | --- | --- | --- | --- |
| Preparación → solicitud/presupuesto | Cliente verificado | Activos propios y combinación operable | Solicitud/evidencia y snapshot calculado en servidor | Sin aceptación, profesional ni pago ficticios. T13/T14 completan alta y límites. |
| `needs_review` → `ready` | Operador con permiso | Versión vigente, motivo, política D05 | `review_service_quote` registra revisión | No cambiar snapshot aceptado. Permiso precios específico se completa T09/T14. |
| `ready` → `accepted` | Cliente dueño | No vencido; condiciones canónicas | `submit_service_quote`: aceptación, solicitud, opción de precio, job y evento atómicos; retry devuelve el mismo vínculo | No aceptar como cliente desde admin; no segundo job. |
| `pending_assignment` → oferta | Operaciones | Profesional elegible y capacidad | `assign_professional_to_job`; oferta `pending_professional_acceptance` | Reserva, expiración y carreras se completan T15/T16. |
| Oferta → `confirmed` o reasignación | Profesional destinatario | Oferta vigente y profesional activo | `professional_respond_to_job` registra respuesta; rechazo retorna cola | No dos aceptaciones ni cambiar beneficiario de checkout existente. |
| `confirmed` → checkout | Cliente dueño | Quote aceptado y profesional confirmado/conectado | `prepare_marketplace_checkout` congela identidad/importe; claim idempotente antes del proveedor | No precios, collector o beneficiario elegidos por body. |
| Pago observado | Webhook firmado / reconciliador | Consulta canónica y validación de cuenta, modo, referencia, moneda, importe | `applyCanonicalPayment` toma locks, deduplica y conserva observación/checkout/proyección en transacción | Navegador no acredita. Divergencias → `review`. No job nuevo por webhook. |
| `confirmed` → `technician_on_way` → `arrived` → `onsite_diagnosis` → `in_progress` | Profesional asignado activo | Estado esperado en DB y checkout inicial `approved`; adicionales pendientes resueltos | `advance_service_job` + trigger `protect_paid_assignment`; timestamps y transición | Impago, devolución, contracargo y revisión no habilitan visita. T19 completa diagnósticos y evidencias. |
| Diagnóstico → adicional `proposed` | Profesional asignado | Trabajo permitido y nueva falla/alcance/importe | `propose_job_extra` crea propuesta separada e idempotente | No sobrescribir precio original ni decidir por cliente. |
| `proposed` → `accepted` / `rejected` | Cliente dueño | Versión/importe vigentes | `decide_job_extra` registra decisión única | Cobro posterior según D06; no doble suma. T19 amplía evidencia y consistencia. |
| `in_progress` → cierre técnico | Profesional asignado | Informe, evidencia y adicionales consistentes | Estado `completed_pending_customer_confirmation`, informe/historial/recibo/eventos en una transacción T20 | No éxito basado en validar body. El helper puro nunca completa al cliente. |
| Pendiente conformidad → `completed` | Cliente dueño | Informe existente y decisión explícita | Comando de conformidad idempotente T21 | Sin reseña obligatoria; sin completar por silencio antes de D06. |
| Servicio completado → reseña | Cliente dueño | Elegibilidad y una reseña por servicio | Reseña y agregación idempotente T21 | Contar trabajos completados desde jobs; disconformidad puede abrir caso. |
| Cancelación / reprogramación | Actor permitido por etapa | Motivo, política y conciliación de dinero | Liberar/cambiar reserva, evento y expediente financiero T15/T18 | No borrar historia ni ocultar pago tardío. |
| Cobro → devolución / contracargo | Finanzas / proveedor verificado | Saldo reembolsable y solicitud trazable | Intento de devolución; ledger sólo confirma resultado canónico T18 | Solicitar no significa devuelto; no exceder cobro. |
| Servicio → caso calidad `open` | Dueño / profesional / operador según caso | Origen autorizado | Caso, responsable, SLA, evidencia y notas T23 | No notas internas públicas. Resolver caso no fuerza pago aprobado. |
| Servicio → garantía `open` → decisión → `completed` | Dueño / operador habilitado | Cobertura y origen consultados en DB | Expediente y revisita ligada T23 | No garantía inferida por body ni trabajo nuevo desligado del original. |

## Estado canónico y proyección monetaria

| Dato | Almacenamiento | Uso |
| --- | --- | --- |
| Estado y fecha del proveedor, importes devueltos, cargos, discrepancias | `marketplace_payment_observations` | Evidencia canónica por pago y orden temporal; persistir `charged_back` sin renombrarlo. |
| Estado agregado del intento | `marketplace_checkouts` | Decidir habilitación de visita y retry, mostrar revisión, congelar beneficiario. Múltiples cobros o discrepancias llevan a revisión. |
| Estado compatible | `payments` | Reportes antiguos; `charged_back` proyecta a `failed`. Nunca sobrescribe ni sustituye la observación original para decisiones. |
| Retorno del navegador | Querystring de la página | Señal para consultar; cero autoridad de cobro. |

`PaymentPanel` lee checkouts y observaciones y muestra ambos: `Contracargo`, `Requiere revisión`, `Reembolso parcial` o `Reembolsado`. El helper puro `applyPaymentWebhook` conserva `providerStatus` separado de `toStatus`; es una proyección de prueba sin efectos persistentes y no tiene endpoint de aplicación pública.

También el wrapper `transitionJob` exige el campo separado `WorkContext.canonicalPaymentStatus` tipado con `MarketplaceCheckoutStatus`. `WorkContext.paymentStatus` representa exclusivamente la proyección. Checkout ausente, `review` o `charged_back` bloquean aun si la proyección dice `approved`; un checkout aprobado puede habilitar la capacidad aunque la proyección esté atrasada.

## Reutilización y retiro

| Elemento | Decisión T05 | Autoridad/reemplazo |
| --- | --- | --- |
| `lib/domain/types.ts`, `state-machine.ts`, `jobs/workflow.ts` | Conservados y alineados; precondiciones negativas y labels en dominio | Capacidades puras, nunca autorización HTTP. |
| `lib/workflows/service-lifecycle.ts` | Alineado a asignación antes de pago; `approveConfirmedJobPayment` conserva job; cierre y conformidad separados | Modelo puro sin persistencia; SQL manda. |
| `lib/use-cases/customer-request.ts` | Preparación termina en precio para aceptar; draft no permite pago | Quote canónico + `prepare_marketplace_checkout` para cobrar. |
| `lib/use-cases/payment-flow.ts` | No crea trabajos; conserva estado proveedor separado | Flujo financiero persistente en `marketplace-ledger.ts`. |
| `lib/application/service-operations.ts` | Retirado, sin consumidores | Duplicaba simulación de precios, pagos, asignación y cierre; reglas útiles ya tienen módulos puros/SQL. |
| `lib/use-cases/full-system-simulation.ts` | Movido a `tests/simulations/full-system-simulation.ts` y orden actualizado | Evidencia de modelo, no integración ni runtime productivo. |
| `/api/jobs/advance`, `/api/jobs/update-status` | POST retirado 410 | `/api/pricing/job/status` ejecuta RPC con sesión. |
| `/api/payments/webhook/apply` | POST retirado 410 | `/api/mercadopago/webhook` firmado y reconciliación canónica. |
| `/api/admin/assign-professional` | POST retirado 410 | `/api/pricing/offers` y oferta real. |
| `jobStatusLabels` dentro de mock | Extraído a `lib/domain/job-status-labels.ts`; consumidores migrados | Mock sólo reexporta compatibilidad para fixtures; páginas reales no cargan datos ficticios por etiquetas. |
| RPC antiguo `create_service_request_from_app` | Conservado para compatibilidad de schema, ya revocado para authenticated por migración de quotes | `submit_service_quote`; test SQL verifica revocación. |

La búsqueda de consumidores de las cuatro rutas retiradas no encontró invocaciones de producto; sólo pruebas e inventario de rutas. Las rutas siguen existiendo para devolver 410, sin redirigir POST ni simular autorización.

## Evidencia y límites

`tests/domain/production-lifecycle.test.ts` está registrado explícitamente en el runner. La primera corrida guardada en `output/production-readiness/t05-domain-red.log` obtuvo 124/130: las seis nuevas invariantes fallaron por las carencias esperadas. Los cuatro endpoints tienen pruebas de retiro, con evidencia roja 200 frente a 410 y posterior validación requerida.

La prueba SQL `service_quotes.test.sql` agrega intentos privilegiados de reescribir precio aceptado y volverlo a ready. Las suites de marketplace ya prueban ausencia de pago para iniciar visita y preservación de ledger. Ejecutar dominio, marketplace-contract, retired-lifecycle, typecheck y pgTAP antes de cerrar; el resultado final se registra en el change log por el agente integrador.

La revisión posterior detectó que el wrapper confundía la proyección con el checkout. La corrección tiene ciclo rojo/verde propio: `t05-canonical-wrapper-red.log` registra 133/135, con los dos casos nuevos fallando por esa confusión; `t05-canonical-wrapper-green.log` registra 135/135 y salida 0. Cubren checkout `review`, `charged_back` o ausente con proyección aprobada, además de checkout aprobado con proyección todavía pendiente. No se ejecutaron otras suites durante esta corrección.

Una segunda revisión añadió la transmisión de `customerApproved` al guard de adicionales y la idempotencia del helper de confirmación de pago. `t05-wrapper-quality-red.log` registra 136/139: aceptación válida bloqueada y dos errores de transición `approved → approved`; `t05-wrapper-quality-green.log` registra 139/139 y salida 0. La prueba de replay también verifica que una visita ya iniciada conserva su estado y no duplica eventos. El contador incluye las pruebas de dominio de los bloques integrados en paralelo; este ajuste agrega tres casos. Ninguna ruta HTTP ni función SQL cambió por esta corrección.

T05 fija el contrato, elimina las fuentes de éxito simulado listadas y preserva las autoridades existentes. No afirma completar controles de sesión T06, RLS T07, operación de ofertas T16, devoluciones T18, cierre/conformidad T20/T21 ni soporte T23. No se aprobó ninguna tasa, plazo automático, cobertura comercial, cobro real ni entorno productivo. No hay migración nueva: se reutilizan las autoridades ya instaladas y se fortalecen sus pruebas.
