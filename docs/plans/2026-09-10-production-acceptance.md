# Lysto — contratos y aceptación de producción

Anexo normativo del [plan principal](E:/Proyectos/GitHub/Lysto/docs/plans/2026-09-10-production-completion.md). Fecha de referencia: 10/09/2026. Todos los estados empiezan pendientes. Los estados funcionales siguientes describen comportamiento: T05 debe mapearlos a los enums/columnas reales y registrar migraciones necesarias; no crear un segundo estado de negocio paralelo.

## 1. Registro de decisiones D01–D12

Cada decisión requiere estado (`pending/proposed/approved/rejected/superseded`), responsable identificado, fecha, valor concreto, evidencia y tareas afectadas. Completar el inventario sí cierra T01; no aprueba las decisiones. Una propuesta permite código configurable local, pero no activar política comercial sin responsable.

| ID | Decisión | Responsable | Contenido mínimo | Afecta |
| --- | --- | --- | --- | --- |
| D01 | Piloto y capacidad | Dirección + operaciones | Confirmar zona, fecha, cupo, profesionales activos y simultaneidad. Hipótesis inicial: 20 servicios completos, al menos 2 semanas, 3–5 profesionales y 1–2 operadores; son criterios propuestos, no compromisos aceptados. | T15,T16,T35,T38 |
| D02 | Atención y responsables | Operaciones | Definir horarios, asignación de turno, SLA por severidad, canal de soporte, suplentes y escalamiento fuera de horario. | T23,T24,T29,T31,T38 |
| D03 | Oferta inicial | Producto + operaciones | Definir zonas, servicios incluidos, duración, equipamiento requerido, capacidad y restricciones. Publicar sólo combinaciones operables. | T14,T15,T16,T29 |
| D04 | Entornos y hosting | Responsable técnico | Identificar proveedor real, proyectos separados de desarrollo/staging/producción, dominios, región, runtime, scheduler, accesos y facturación. No elegir por un archivo antiguo. | T03,T30,T32,T36 |
| D05 | Economía y facturación | Dirección + finanzas | Aprobar quién vende, quién factura, moneda, impuestos, comisiones, costo del proveedor, redondeo, promociones si existen y neto mínimo profesional. Los porcentajes actuales requieren validación comercial. | T14,T17,T18,T22,T35 |
| D06 | Excepciones del servicio | Producto + operaciones + finanzas | Aprobar cancelación por etapa, ausencia, rechazo, reprogramación, repuestos, adicionales y momento de pago, plazo de conformidad sin respuesta, garantías y revisitas. No completar automáticamente por silencio sin regla aprobada. | T15,T18,T19,T21,T23 |
| D07 | Habilitación profesional | Operaciones + responsable legal | Definir documentos, vencimientos, cualificación, acuerdo, formación obligatoria y suspensión. Responsable humano verifica lo que no puede validar el sistema. | T08,T11,T16,T28 |
| D08 | Privacidad y políticas | Dirección + responsable legal | Aprobar términos, privacidad, retención por clase de dato, solicitudes de derechos, evidencias de servicio, tratamiento de fotos y proveedor de soporte. Registrar revisión de profesional competente. | T07,T10,T23,T31,T32 |
| D09 | Continuidad | Técnica + dirección | Aprobar pérdida máxima de datos y recuperación. Propuesta a demostrar: RPO ≤1 hora y RTO ≤4 horas. Incluir archivos, identidad, configuración y custodia de claves, además de DB. | T32,T37 |
| D10 | Carga, observación y presupuesto | Técnica + finanzas | Aprobar volumen, SLO, alertas, cuotas y presupuesto mensual. Propuesta: p95 lectura ≤1 s, mutación ≤2 s y <1% 5xx en carga convenida, excluyendo duración del checkout externo que se mide separadamente. | T30,T35,T38 |
| D11 | Mercado Pago y aceptación | Titular comercial + finanzas + técnica | Identificar aplicación y cuentas; confirmar permisos comerciales, OAuth, ambientes y límites. Cobro/devolución real de prueba requiere autorización explícita con importe y destinatarios. Nunca pedir secretos en el registro. | T17,T18,T36,T37 |
| D12 | Alcance opcional explícito | Producto + dirección | Aprobar sólo exclusiones justificadas: IA auxiliar, automatización avanzada de matching, nuevas zonas, recordatorios automáticos o formación no obligatoria. Mantener funciones nucleares, seguridad, dinero, historial y soporte. Una opción excluida se oculta coherentemente y se documenta; no devuelve éxito simulado. | T25,T26,T28,T29,T31,T39 |


Registrar revisión separada por entorno para D04/D11. No pegar claves en estos documentos. No sustituir aceptación legal/comercial por criterio del agente. Este anexo establece requisitos de producto y evidencia; no certifica cumplimiento legal.

## 2. Estados, actores y efectos

| Evento | Actor | Precondición | Efecto persistente | Invariante negativa |
| --- | --- | --- | --- | --- |
| Solicitud enviada | Cliente verificado | Activos propios, zona/servicio permitido | Solicitud y evidencia ligada; presupuesto borrador/revisión | Sin asignación, pago o aprobación ficticia. |
| Presupuesto revisado | Operador con permiso precios | Versión actual y política D05 | Snapshot de precio/moneda, validez y condiciones | No modificar aceptación anterior. |
| Presupuesto aceptado | Cliente dueño | Versión vigente y precio canónico | Aceptación única y trabajo vinculado | No aceptar usando identidad del cliente desde otro rol. |
| Oferta de trabajo | Operaciones / matching autorizado | Profesional aprobado, disponible y elegible | Oferta con vencimiento y reserva según política | Sin beneficiario nuevo en checkout fijado. |
| Oferta aceptada/rechazada | Profesional destinatario | Oferta vigente y capacidad | Asignación/reserva atómica o siguiente candidato | Dos aceptaciones no asignan doble. |
| Checkout creado | Cliente dueño | Presupuesto aceptado y profesional confirmado/conectado | Intento y payload canónico idempotente antes de efecto externo | No monto/collector arbitrario ni segundo cobro por timeout. |
| Pago observado | Webhook firmado / reconciliador | Consulta canónica, cuenta/moneda/importe/referencia correctos | Ledger/evento/estado; discrepancia a revisión | Retorno navegador no acredita; duplicados no multiplican efectos. |
| Visita iniciada | Profesional asignado | Estado permitido y pago requerido confirmado | Estado y hora auditados | No iniciar con pago pendiente o sesión suspendida. |
| Diagnóstico / extra | Profesional asignado | Trabajo en curso y alcance descrito | Diagnóstico y adicional versionado con evidencia | No cobrar extra sin aceptación requerida. |
| Extra aceptado/rechazado | Cliente dueño | Versión/importe actual y D06 | Decisión; cobro si procede con intento propio | No sumar dos veces ni atribuir aceptación falsa. |
| Cierre técnico | Profesional asignado | Informe completo, evidencia válida y extras consistentes | Informe+historial+pendiente conformidad+recibo/eventos en transacción | No completar por validación de body solamente. |
| Conformidad | Cliente dueño; automatismo sólo D06 | Informe existente y plazo/regla real | Estado completado y evento único | Reseña opcional; disconformidad abre caso; silencio no equivale a éxito por defecto. |
| Reseña | Cliente dueño | Servicio elegible y una reseña por servicio | Rating/comentario con agregación idempotente | Contar completados desde trabajos, no desde reseñas. |
| Cancelación / reprogramación | Actor permitido por etapa | Motivo, política y efectos financieros | Reserva liberada/cambiada, caso/refund y evento | No ocultar pago tardío ni borrar historia. |
| Devolución | Finanzas habilitada | Monto reembolsable y solicitud trazable | Intento único, confirmación proveedor y ledger | No declarar devuelto al iniciar; no exceder cobro. |
| Garantía / soporte | Dueño/profesional/operador según caso | Origen y cobertura en DB | Caso, responsable, SLA, notas y revisita ligada | No garantía por booleano body ni notas internas públicas. |
| Notificación | Worker interno | Evento durable y destinatario derivado | Claim/lease, intento, entrega/error y retry | No destinatario arbitrario; retry no garantiza exactly-once externo. |


**Permisos de lectura:** cliente sólo recursos propios; profesional sólo sus datos y trabajos/ofertas asignados con información necesaria; admin según función y alcance. Un admin no se convierte en cliente/profesional por navegar a su panel. Soporte accede a expedientes por interfaz administrativa auditada y minimizada. No implementar impersonación sin requisito aprobado.

**Autoridad:** sesión verificada + perfil/permisos vigentes para identidad; SQL transaccional para estados/ownership; snapshot aceptado para precio; proveedor/ledger canónico para dinero; outbox persistida para trabajo asíncrono. La proyección visual no habilita por sí sola una mutación.

**Pruebas SQL por migración:** anónimo, propio, ajeno y admin permitido/no permitido; RLS de tablas nuevas; grants y RPC `SECURITY DEFINER` con `search_path` controlado, privilegios mínimos y autorización interna; constraints/índices; atomicidad/concurrencia cuando corresponda. `service_role` o credenciales privilegiadas sólo en servidor no justifican omitir ownership. Cubrir `private`, funciones y Storage, no sólo contar RLS en `public`.

## 3. Inventario de las 36 API actuales

Verificado en el directorio durante la planificación. T26 debe añadir métodos exportados reales, consumidores, esquemas de entrada/salida, servicio SQL y prueba por método; esta tabla no afirma haber probado todos los contratos HTTP. Añadir rutas nuevas antes de cerrar G09.

| Archivo / ruta | Tareas | Disposición final |
| --- | --- | --- |
| [app/api/admin/approve-professional/route.ts](E:/Proyectos/GitHub/Lysto/app/api/admin/approve-professional/route.ts) | T11,T26 | Retirar 410 tras migrar consumidores a admin/professionals/approve; adapter sólo si reutiliza exactamente su autorización y servicio. |
| [app/api/admin/assign-professional/route.ts](E:/Proyectos/GitHub/Lysto/app/api/admin/assign-professional/route.ts) | T16,T26 | Retirar contrato duplicado; nueva oferta desde pricing/offers, con operador autorizado y capacidad. |
| [app/api/admin/invite-professional/route.ts](E:/Proyectos/GitHub/Lysto/app/api/admin/invite-professional/route.ts) | T11 | Persistir invitación de un uso y outbox; admin habilitado. |
| [app/api/admin/pricing/update/route.ts](E:/Proyectos/GitHub/Lysto/app/api/admin/pricing/update/route.ts) | T14,T26 | Retirar 410 y migrar a pricing/policy; cambios versionados y permiso precios. |
| [app/api/admin/professionals/approve/route.ts](E:/Proyectos/GitHub/Lysto/app/api/admin/professionals/approve/route.ts) | T11 | Aprobación/rechazo real con documentos, elegibilidad y auditoría; admin autorizado. |
| [app/api/customer/request/submit/route.ts](E:/Proyectos/GitHub/Lysto/app/api/customer/request/submit/route.ts) | T13,T14 | Unificar alta real de solicitud/presupuesto; cliente autenticado y dueño de activos. |
| [app/api/diagnosis/generate/route.ts](E:/Proyectos/GitHub/Lysto/app/api/diagnosis/generate/route.ts) | T26,T30 | Cálculo auxiliar explícito, autenticado y limitado; no persiste ni promete diagnóstico profesional; D12 si se excluye. |
| [app/api/equipment/register/route.ts](E:/Proyectos/GitHub/Lysto/app/api/equipment/register/route.ts) | T13 | Persistir equipo propio con validaciones; permisos y evidencia reales. |
| [app/api/jobs/advance/route.ts](E:/Proyectos/GitHub/Lysto/app/api/jobs/advance/route.ts) | T05,T26 | Retirar 410 y migrar a pricing/job/status con servicio canónico y precondiciones. |
| [app/api/jobs/extras/route.ts](E:/Proyectos/GitHub/Lysto/app/api/jobs/extras/route.ts) | T19 | Persistir adicional y aceptación separada; profesional asignado propone, cliente dueño acepta. |
| [app/api/jobs/final-report/route.ts](E:/Proyectos/GitHub/Lysto/app/api/jobs/final-report/route.ts) | T20 | Cierre técnico atómico con evidencia; profesional asignado y estado válido. |
| [app/api/jobs/update-status/route.ts](E:/Proyectos/GitHub/Lysto/app/api/jobs/update-status/route.ts) | T05,T26 | Retirar duplicado; estado sólo por comando de negocio canónico pricing/job/status. |
| [app/api/maintenance/schedule/route.ts](E:/Proyectos/GitHub/Lysto/app/api/maintenance/schedule/route.ts) | T25 | Plan real autorizado e historial; automatización de recordatorio conforme D12. |
| [app/api/mercadopago/account/route.ts](E:/Proyectos/GitHub/Lysto/app/api/mercadopago/account/route.ts) | T17 | Conservar y probar ownership, ambiente, información mínima y desconexión segura. |
| [app/api/mercadopago/checkouts/route.ts](E:/Proyectos/GitHub/Lysto/app/api/mercadopago/checkouts/route.ts) | T17,T18 | Conservar y ampliar conciliación/gestión autorizada; separar acciones de finanzas. |
| [app/api/mercadopago/create-preference/route.ts](E:/Proyectos/GitHub/Lysto/app/api/mercadopago/create-preference/route.ts) | T17 | Conservar controles canónicos, idempotencia y profesional fijado; no confiar importes body. |
| [app/api/mercadopago/oauth/authorize/route.ts](E:/Proyectos/GitHub/Lysto/app/api/mercadopago/oauth/authorize/route.ts) | T17 | Sesión elegible, state y cuenta esperada; sólo rol habilitado conecta su cuenta. |
| [app/api/mercadopago/oauth/callback/route.ts](E:/Proyectos/GitHub/Lysto/app/api/mercadopago/oauth/callback/route.ts) | T17 | Validar state, sesión, expiración/replay y cuenta; errores saneados, tokens cifrados. |
| [app/api/mercadopago/webhook/route.ts](E:/Proyectos/GitHub/Lysto/app/api/mercadopago/webhook/route.ts) | T17 | Público para proveedor: firma, consulta canónica, ambiente y deduplicación; no sesión de usuario. |
| [app/api/notifications/emit/route.ts](E:/Proyectos/GitHub/Lysto/app/api/notifications/emit/route.ts) | T24,T26 | Retirar entrada pública genérica. Eventos desde transacciones; reenvío limitado por admin mediante servicio interno. |
| [app/api/payments/webhook/apply/route.ts](E:/Proyectos/GitHub/Lysto/app/api/payments/webhook/apply/route.ts) | T17,T26 | 410 permanente; ningún cliente envía paid o estado proveedor por esta vía. |
| [app/api/pricing/job/route.ts](E:/Proyectos/GitHub/Lysto/app/api/pricing/job/route.ts) | T12,T14 | Conservar lectura/operaciones existentes con ownership y DTO; documentar cada método real. |
| [app/api/pricing/job/status/route.ts](E:/Proyectos/GitHub/Lysto/app/api/pricing/job/status/route.ts) | T05,T19,T20 | Conservar comando canónico; transición validada desde DB, actor derivado de sesión. |
| [app/api/pricing/offers/route.ts](E:/Proyectos/GitHub/Lysto/app/api/pricing/offers/route.ts) | T16 | Conservar oferta/respuesta real, capacidad y expiración; roles según operación. |
| [app/api/pricing/policy/route.ts](E:/Proyectos/GitHub/Lysto/app/api/pricing/policy/route.ts) | T14 | Conservar lectura/autorización y versión; mutación sólo permiso precios con auditoría. |
| [app/api/pricing/quote/route.ts](E:/Proyectos/GitHub/Lysto/app/api/pricing/quote/route.ts) | T14 | Conservar cálculo canónico y persistencia según método real; límites y datos propios. |
| [app/api/pricing/quotes/route.ts](E:/Proyectos/GitHub/Lysto/app/api/pricing/quotes/route.ts) | T12,T14 | Conservar revisión/aceptación/listado paginado; diferenciar admin y cliente dueño. |
| [app/api/pro/jobs/action/route.ts](E:/Proyectos/GitHub/Lysto/app/api/pro/jobs/action/route.ts) | T19,T26 | Retirar duplicado; migrar a comandos canónicos de visita/cierre, nunca action libre. |
| [app/api/pro/onboarding/evaluate/route.ts](E:/Proyectos/GitHub/Lysto/app/api/pro/onboarding/evaluate/route.ts) | T11,T26 | Evaluación interna autorizada; no autoaprobación pública ni conclusión basada sólo en body. |
| [app/api/professional/onboarding/route.ts](E:/Proyectos/GitHub/Lysto/app/api/professional/onboarding/route.ts) | T11 | Persistencia real con invitación válida, sesión, adjuntos y campos permitidos. |
| [app/api/professional/respond-request/route.ts](E:/Proyectos/GitHub/Lysto/app/api/professional/respond-request/route.ts) | T16,T26 | Retirar duplicado y migrar a respuesta de oferta canónica. |
| [app/api/quality/open-case/route.ts](E:/Proyectos/GitHub/Lysto/app/api/quality/open-case/route.ts) | T23 | Caso real con permiso calidad y origen autorizado; estado/actor auditados. |
| [app/api/reviews/submit/route.ts](E:/Proyectos/GitHub/Lysto/app/api/reviews/submit/route.ts) | T21 | Reseña opcional única de servicio propio completado; no sustituye conformidad. |
| [app/api/service-request/preview/route.ts](E:/Proyectos/GitHub/Lysto/app/api/service-request/preview/route.ts) | T26 | Conservar retirado 410; consumidores nuevos usan presupuesto canónico. |
| [app/api/uploads/sign/route.ts](E:/Proyectos/GitHub/Lysto/app/api/uploads/sign/route.ts) | T10 | Emitir upload intent y URL limitada sólo tras autorización; finalize obligatorio para vincular. |
| [app/api/warranty/claim/route.ts](E:/Proyectos/GitHub/Lysto/app/api/warranty/claim/route.ts) | T23 | Reclamo persistente; cobertura y propiedad consultadas en DB, no declaradas por body. |


Endpoint retirado requiere consumidores migrados y prueba `410`; no redirect ambiguo de POST. Un adapter conservado debe invocar el mismo servicio autorizado. Revisar Server Actions, RPC y acceso directo a Supabase además de estas rutas: no son un perímetro exhaustivo de autorización.

## 4. Inventario de las 69 páginas actuales

Revisar todas aunque sólo se enumeren archivos representativos en cada Txx. T27/T28/T29 completan origen de datos, acciones, autorización, prueba y estado `real/redirect/retired-approved`. Añadir recuperación, políticas, seguridad y demás páginas nuevas. Layout protegido no demuestra autorización de todas sus acciones.

| Archivo | URL | Acceso esperado | Tareas | Aceptación |
| --- | --- | --- | --- | --- |
| [app/(admin)/admin/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/page.tsx) | `/admin` | Admin con permiso | T09,T29 | Consulta real y acciones auditadas; funciones separadas; sin fixtures/KPI inventados. |
| [app/(admin)/admin/auditoria/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/auditoria/page.tsx) | `/admin/auditoria` | Admin con permiso | T09,T29 | Consulta real y acciones auditadas; funciones separadas; sin fixtures/KPI inventados. |
| [app/(admin)/admin/calculadora/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/calculadora/page.tsx) | `/admin/calculadora` | Admin con permiso | T09,T29 | Consulta real y acciones auditadas; funciones separadas; sin fixtures/KPI inventados. |
| [app/(admin)/admin/calculadora/solicitudes/[id]/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/calculadora/solicitudes/[id]/page.tsx) | `/admin/calculadora/solicitudes/[id]` | Admin con permiso | T09,T29 | Consulta real y acciones auditadas; funciones separadas; sin fixtures/KPI inventados. |
| [app/(admin)/admin/calculadora/trabajos/[id]/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/calculadora/trabajos/[id]/page.tsx) | `/admin/calculadora/trabajos/[id]` | Admin con permiso | T09,T29 | Consulta real y acciones auditadas; funciones separadas; sin fixtures/KPI inventados. |
| [app/(admin)/admin/calidad/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/calidad/page.tsx) | `/admin/calidad` | Admin con permiso | T09,T29 | Consulta real y acciones auditadas; funciones separadas; sin fixtures/KPI inventados. |
| [app/(admin)/admin/clientes/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/clientes/page.tsx) | `/admin/clientes` | Admin con permiso | T09,T29 | Consulta real y acciones auditadas; funciones separadas; sin fixtures/KPI inventados. |
| [app/(admin)/admin/clientes/[id]/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/clientes/[id]/page.tsx) | `/admin/clientes/[id]` | Admin con permiso | T09,T29 | Consulta real y acciones auditadas; funciones separadas; sin fixtures/KPI inventados. |
| [app/(admin)/admin/configuracion/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/configuracion/page.tsx) | `/admin/configuracion` | Admin con permiso | T09,T29 | Consulta real y acciones auditadas; funciones separadas; sin fixtures/KPI inventados. |
| [app/(admin)/admin/dashboard/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/dashboard/page.tsx) | `/admin/dashboard` | Admin con permiso | T09,T29 | Consulta real y acciones auditadas; funciones separadas; sin fixtures/KPI inventados. |
| [app/(admin)/admin/diagnostico/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/diagnostico/page.tsx) | `/admin/diagnostico` | Admin con permiso | T09,T29 | Consulta real y acciones auditadas; funciones separadas; sin fixtures/KPI inventados. |
| [app/(admin)/admin/equipos/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/equipos/page.tsx) | `/admin/equipos` | Admin con permiso | T09,T29 | Consulta real y acciones auditadas; funciones separadas; sin fixtures/KPI inventados. |
| [app/(admin)/admin/garantias/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/garantias/page.tsx) | `/admin/garantias` | Admin con permiso | T09,T29 | Consulta real y acciones auditadas; funciones separadas; sin fixtures/KPI inventados. |
| [app/(admin)/admin/marketplace/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/marketplace/page.tsx) | `/admin/marketplace` | Admin con permiso | T09,T29 | Consulta real y acciones auditadas; funciones separadas; sin fixtures/KPI inventados. |
| [app/(admin)/admin/matching/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/matching/page.tsx) | `/admin/matching` | Admin con permiso | T09,T29 | Consulta real y acciones auditadas; funciones separadas; sin fixtures/KPI inventados. |
| [app/(admin)/admin/notificaciones/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/notificaciones/page.tsx) | `/admin/notificaciones` | Admin con permiso | T09,T29 | Consulta real y acciones auditadas; funciones separadas; sin fixtures/KPI inventados. |
| [app/(admin)/admin/pagos/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/pagos/page.tsx) | `/admin/pagos` | Admin con permiso | T09,T29 | Consulta real y acciones auditadas; funciones separadas; sin fixtures/KPI inventados. |
| [app/(admin)/admin/pagos/split/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/pagos/split/page.tsx) | `/admin/pagos/split` | Admin con permiso | T09,T29 | Consulta real y acciones auditadas; funciones separadas; sin fixtures/KPI inventados. |
| [app/(admin)/admin/precios/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/precios/page.tsx) | `/admin/precios` | Admin con permiso | T09,T29 | Consulta real y acciones auditadas; funciones separadas; sin fixtures/KPI inventados. |
| [app/(admin)/admin/profesionales/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/profesionales/page.tsx) | `/admin/profesionales` | Admin con permiso | T09,T29 | Consulta real y acciones auditadas; funciones separadas; sin fixtures/KPI inventados. |
| [app/(admin)/admin/profesionales/invitaciones/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/profesionales/invitaciones/page.tsx) | `/admin/profesionales/invitaciones` | Admin con permiso | T09,T29 | Consulta real y acciones auditadas; funciones separadas; sin fixtures/KPI inventados. |
| [app/(admin)/admin/profesionales/[id]/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/profesionales/[id]/page.tsx) | `/admin/profesionales/[id]` | Admin con permiso | T09,T29 | Consulta real y acciones auditadas; funciones separadas; sin fixtures/KPI inventados. |
| [app/(admin)/admin/reclamos/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/reclamos/page.tsx) | `/admin/reclamos` | Admin con permiso | T09,T29 | Consulta real y acciones auditadas; funciones separadas; sin fixtures/KPI inventados. |
| [app/(admin)/admin/reportes/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/reportes/page.tsx) | `/admin/reportes` | Admin con permiso | T09,T29 | Consulta real y acciones auditadas; funciones separadas; sin fixtures/KPI inventados. |
| [app/(admin)/admin/servicios/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/servicios/page.tsx) | `/admin/servicios` | Admin con permiso | T09,T29 | Consulta real y acciones auditadas; funciones separadas; sin fixtures/KPI inventados. |
| [app/(admin)/admin/solicitudes/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/solicitudes/page.tsx) | `/admin/solicitudes` | Admin con permiso | T09,T29 | Consulta real y acciones auditadas; funciones separadas; sin fixtures/KPI inventados. |
| [app/(admin)/admin/solicitudes/[id]/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/solicitudes/[id]/page.tsx) | `/admin/solicitudes/[id]` | Admin con permiso | T09,T29 | Consulta real y acciones auditadas; funciones separadas; sin fixtures/KPI inventados. |
| [app/(admin)/admin/trabajos/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/trabajos/page.tsx) | `/admin/trabajos` | Admin con permiso | T09,T29 | Consulta real y acciones auditadas; funciones separadas; sin fixtures/KPI inventados. |
| [app/(admin)/admin/trabajos/[id]/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/trabajos/[id]/page.tsx) | `/admin/trabajos/[id]` | Admin con permiso | T09,T29 | Consulta real y acciones auditadas; funciones separadas; sin fixtures/KPI inventados. |
| [app/(admin)/admin/zonas/page.tsx](E:/Proyectos/GitHub/Lysto/app/(admin)/admin/zonas/page.tsx) | `/admin/zonas` | Admin con permiso | T09,T29 | Consulta real y acciones auditadas; funciones separadas; sin fixtures/KPI inventados. |
| [app/(auth)/login/page.tsx](E:/Proyectos/GitHub/Lysto/app/(auth)/login/page.tsx) | `/login` | Público con límites | T07,T08 | Ciclo real de identidad, destino seguro, errores no enumerables; sin botón inerte. |
| [app/(auth)/registro/page.tsx](E:/Proyectos/GitHub/Lysto/app/(auth)/registro/page.tsx) | `/registro` | Público con límites | T07,T08 | Ciclo real de identidad, destino seguro, errores no enumerables; sin botón inerte. |
| [app/(customer)/app/page.tsx](E:/Proyectos/GitHub/Lysto/app/(customer)/app/page.tsx) | `/app` | Cliente dueño | T27 | DTO propio persistido, recarga, paginación y estados vacío/error; acciones reales. |
| [app/(customer)/app/direcciones/page.tsx](E:/Proyectos/GitHub/Lysto/app/(customer)/app/direcciones/page.tsx) | `/app/direcciones` | Cliente dueño | T27 | DTO propio persistido, recarga, paginación y estados vacío/error; acciones reales. |
| [app/(customer)/app/equipos/page.tsx](E:/Proyectos/GitHub/Lysto/app/(customer)/app/equipos/page.tsx) | `/app/equipos` | Cliente dueño | T27 | DTO propio persistido, recarga, paginación y estados vacío/error; acciones reales. |
| [app/(customer)/app/equipos/[id]/page.tsx](E:/Proyectos/GitHub/Lysto/app/(customer)/app/equipos/[id]/page.tsx) | `/app/equipos/[id]` | Cliente dueño | T27 | DTO propio persistido, recarga, paginación y estados vacío/error; acciones reales. |
| [app/(customer)/app/garantias/page.tsx](E:/Proyectos/GitHub/Lysto/app/(customer)/app/garantias/page.tsx) | `/app/garantias` | Cliente dueño | T27 | DTO propio persistido, recarga, paginación y estados vacío/error; acciones reales. |
| [app/(customer)/app/mantenimientos/page.tsx](E:/Proyectos/GitHub/Lysto/app/(customer)/app/mantenimientos/page.tsx) | `/app/mantenimientos` | Cliente dueño | T27 | DTO propio persistido, recarga, paginación y estados vacío/error; acciones reales. |
| [app/(customer)/app/pagos/page.tsx](E:/Proyectos/GitHub/Lysto/app/(customer)/app/pagos/page.tsx) | `/app/pagos` | Cliente dueño | T27 | DTO propio persistido, recarga, paginación y estados vacío/error; acciones reales. |
| [app/(customer)/app/pagos/mercadopago/page.tsx](E:/Proyectos/GitHub/Lysto/app/(customer)/app/pagos/mercadopago/page.tsx) | `/app/pagos/mercadopago` | Cliente dueño | T27 | DTO propio persistido, recarga, paginación y estados vacío/error; acciones reales. |
| [app/(customer)/app/perfil/page.tsx](E:/Proyectos/GitHub/Lysto/app/(customer)/app/perfil/page.tsx) | `/app/perfil` | Cliente dueño | T27 | DTO propio persistido, recarga, paginación y estados vacío/error; acciones reales. |
| [app/(customer)/app/presupuestos/page.tsx](E:/Proyectos/GitHub/Lysto/app/(customer)/app/presupuestos/page.tsx) | `/app/presupuestos` | Cliente dueño | T27 | DTO propio persistido, recarga, paginación y estados vacío/error; acciones reales. |
| [app/(customer)/app/solicitar/aire-acondicionado/page.tsx](E:/Proyectos/GitHub/Lysto/app/(customer)/app/solicitar/aire-acondicionado/page.tsx) | `/app/solicitar/aire-acondicionado` | Cliente dueño | T27 | DTO propio persistido, recarga, paginación y estados vacío/error; acciones reales. |
| [app/(customer)/app/solicitudes/page.tsx](E:/Proyectos/GitHub/Lysto/app/(customer)/app/solicitudes/page.tsx) | `/app/solicitudes` | Cliente dueño | T27 | DTO propio persistido, recarga, paginación y estados vacío/error; acciones reales. |
| [app/(customer)/app/solicitudes/[id]/page.tsx](E:/Proyectos/GitHub/Lysto/app/(customer)/app/solicitudes/[id]/page.tsx) | `/app/solicitudes/[id]` | Cliente dueño | T27 | DTO propio persistido, recarga, paginación y estados vacío/error; acciones reales. |
| [app/(customer)/app/trabajos/page.tsx](E:/Proyectos/GitHub/Lysto/app/(customer)/app/trabajos/page.tsx) | `/app/trabajos` | Cliente dueño | T27 | DTO propio persistido, recarga, paginación y estados vacío/error; acciones reales. |
| [app/(customer)/app/trabajos/[id]/page.tsx](E:/Proyectos/GitHub/Lysto/app/(customer)/app/trabajos/[id]/page.tsx) | `/app/trabajos/[id]` | Cliente dueño | T27 | DTO propio persistido, recarga, paginación y estados vacío/error; acciones reales. |
| [app/(customer)/app/trabajos/[id]/review/page.tsx](E:/Proyectos/GitHub/Lysto/app/(customer)/app/trabajos/[id]/review/page.tsx) | `/app/trabajos/[id]/review` | Cliente dueño | T27 | DTO propio persistido, recarga, paginación y estados vacío/error; acciones reales. |
| [app/(professional)/pro/page.tsx](E:/Proyectos/GitHub/Lysto/app/(professional)/pro/page.tsx) | `/pro` | Profesional propio/asignado | T28 | Datos propios, permisos de asignación/estado, móvil y reintento honesto. |
| [app/(professional)/pro/agenda/page.tsx](E:/Proyectos/GitHub/Lysto/app/(professional)/pro/agenda/page.tsx) | `/pro/agenda` | Profesional propio/asignado | T28 | Datos propios, permisos de asignación/estado, móvil y reintento honesto. |
| [app/(professional)/pro/capacitacion/page.tsx](E:/Proyectos/GitHub/Lysto/app/(professional)/pro/capacitacion/page.tsx) | `/pro/capacitacion` | Profesional propio/asignado | T28 | Formación real si D07 la exige; si opcional, exclusión D12 y navegación coherente. |
| [app/(professional)/pro/dashboard/page.tsx](E:/Proyectos/GitHub/Lysto/app/(professional)/pro/dashboard/page.tsx) | `/pro/dashboard` | Profesional propio/asignado | T28 | Datos propios, permisos de asignación/estado, móvil y reintento honesto. |
| [app/(professional)/pro/equipos/[id]/page.tsx](E:/Proyectos/GitHub/Lysto/app/(professional)/pro/equipos/[id]/page.tsx) | `/pro/equipos/[id]` | Profesional propio/asignado | T28 | Datos propios, permisos de asignación/estado, móvil y reintento honesto. |
| [app/(professional)/pro/mercadopago/page.tsx](E:/Proyectos/GitHub/Lysto/app/(professional)/pro/mercadopago/page.tsx) | `/pro/mercadopago` | Profesional propio/asignado | T28 | Datos propios, permisos de asignación/estado, móvil y reintento honesto. |
| [app/(professional)/pro/onboarding/[token]/page.tsx](E:/Proyectos/GitHub/Lysto/app/(professional)/pro/onboarding/[token]/page.tsx) | `/pro/onboarding/[token]` | Invitación válida + sesión | T11,T28 | Entrada por token no abre panel pro ni omite aprobación; un uso y archivos privados. |
| [app/(professional)/pro/pagos/page.tsx](E:/Proyectos/GitHub/Lysto/app/(professional)/pro/pagos/page.tsx) | `/pro/pagos` | Profesional propio/asignado | T28 | Datos propios, permisos de asignación/estado, móvil y reintento honesto. |
| [app/(professional)/pro/pagos/mercadopago/page.tsx](E:/Proyectos/GitHub/Lysto/app/(professional)/pro/pagos/mercadopago/page.tsx) | `/pro/pagos/mercadopago` | Profesional propio/asignado | T28 | Datos propios, permisos de asignación/estado, móvil y reintento honesto. |
| [app/(professional)/pro/perfil/page.tsx](E:/Proyectos/GitHub/Lysto/app/(professional)/pro/perfil/page.tsx) | `/pro/perfil` | Profesional propio/asignado | T28 | Datos propios, permisos de asignación/estado, móvil y reintento honesto. |
| [app/(professional)/pro/presupuestos/page.tsx](E:/Proyectos/GitHub/Lysto/app/(professional)/pro/presupuestos/page.tsx) | `/pro/presupuestos` | Profesional propio/asignado | T28 | Datos propios, permisos de asignación/estado, móvil y reintento honesto. |
| [app/(professional)/pro/solicitudes/page.tsx](E:/Proyectos/GitHub/Lysto/app/(professional)/pro/solicitudes/page.tsx) | `/pro/solicitudes` | Profesional propio/asignado | T28 | Datos propios, permisos de asignación/estado, móvil y reintento honesto. |
| [app/(professional)/pro/solicitudes/[id]/page.tsx](E:/Proyectos/GitHub/Lysto/app/(professional)/pro/solicitudes/[id]/page.tsx) | `/pro/solicitudes/[id]` | Profesional propio/asignado | T28 | Datos propios, permisos de asignación/estado, móvil y reintento honesto. |
| [app/(professional)/pro/soporte/page.tsx](E:/Proyectos/GitHub/Lysto/app/(professional)/pro/soporte/page.tsx) | `/pro/soporte` | Profesional propio/asignado | T28 | Datos propios, permisos de asignación/estado, móvil y reintento honesto. |
| [app/(professional)/pro/trabajos/page.tsx](E:/Proyectos/GitHub/Lysto/app/(professional)/pro/trabajos/page.tsx) | `/pro/trabajos` | Profesional propio/asignado | T28 | Datos propios, permisos de asignación/estado, móvil y reintento honesto. |
| [app/(professional)/pro/trabajos/[id]/page.tsx](E:/Proyectos/GitHub/Lysto/app/(professional)/pro/trabajos/[id]/page.tsx) | `/pro/trabajos/[id]` | Profesional propio/asignado | T28 | Datos propios, permisos de asignación/estado, móvil y reintento honesto. |
| [app/(public)/page.tsx](E:/Proyectos/GitHub/Lysto/app/(public)/page.tsx) | `/` | Público | T31 | Oferta/políticas reales, CTA funcional, accesibilidad y capacidad aprobada. |
| [app/(public)/ayuda/page.tsx](E:/Proyectos/GitHub/Lysto/app/(public)/ayuda/page.tsx) | `/ayuda` | Público | T31 | Oferta/políticas reales, CTA funcional, accesibilidad y capacidad aprobada. |
| [app/(public)/como-funciona/page.tsx](E:/Proyectos/GitHub/Lysto/app/(public)/como-funciona/page.tsx) | `/como-funciona` | Público | T31 | Oferta/políticas reales, CTA funcional, accesibilidad y capacidad aprobada. |
| [app/(public)/servicios/aire-acondicionado/page.tsx](E:/Proyectos/GitHub/Lysto/app/(public)/servicios/aire-acondicionado/page.tsx) | `/servicios/aire-acondicionado` | Público | T31 | Oferta/políticas reales, CTA funcional, accesibilidad y capacidad aprobada. |
| [app/comprobante/[token]/page.tsx](E:/Proyectos/GitHub/Lysto/app/comprobante/[token]/page.tsx) | `/comprobante/[token]` | Token público restringido | T22 | Token validado/revocable y proyección mínima; inválido no muestra muestra fija. |


## 5. Matriz funcional E01–E18

Ejecutar contra backend/DB real aislado. Sólo proveedor externo puede sustituirse por doble controlado local; eso no cierra aceptación del proveedor. Cubrir recarga/nueva sesión y verificar persistencia, no sólo un toast.

| Caso | Recorrido | Preparación / acción | Resultado obligatorio | Tareas |
| --- | --- | --- | --- | --- |
| E01 | Acceso y aislamiento | Anónimo, cliente A/B, profesional asignado/no asignado, admin sin permiso, suspendido y JWT anterior. | Sin datos ajenos; 401 sin sesión, 403/404 según política con sesión; ninguna mutación; MFA bajo no autoriza admin. | T06,T08,T09 |
| E02 | Cuenta de cliente | Registro→correo de prueba→verificación→login→recuperación→logout; link vencido y replay. | Perfil único real; ningún autoascenso; correo no enumera cuentas; sesión revocada según contrato. | T07,T08 |
| E03 | Alta profesional | Invitación→documentos privados→revisión→aprobación/rechazo→suspensión. | Token de un uso y vencimiento, elegibilidad real para ofertas, evento auditable; no certificados ficticios. | T10,T11 |
| E04 | Presupuesto | Solicitud con dirección/equipo/evidencia; revisar versión, aceptar, luego enviar versión vieja o monto adulterado. | Precio canónico y snapshot inmutable; aceptación vieja/conflictiva rechazada; una sola creación del trabajo. | T13,T14 |
| E05 | Agenda concurrente | Dos aceptaciones simultáneas que compiten por el mismo profesional/franja; reprogramación. | Sólo una reserva incompatible aceptada, liberación controlada y hora local coherente. | T15,T16 |
| E06 | Ofertas y reemplazo | Rechazo, vencimiento, aceptación tardía, doble aceptación y pro suspendido. | Siguiente oferta trazable; nadie ejecuta sin asignación vigente; checkout existente fija beneficiario. | T16,T18 |
| E07 | Cobro | Pendiente, rechazado, aprobado y retorno del navegador sin webhook; callback duplicado/desordenado. | No se marca pagado por URL/body; aprobación canónica única; rechazo no habilita trabajo. | T17 |
| E08 | Visita y adicionales | Inicio sin pago; luego inicio válido, diagnóstico y adicional aprobado/rechazado por cliente. | Bloqueo correcto; extra aceptado por dueño y regla D06; historial e importes consistentes. | T19 |
| E09 | Informe final atómico | Archivos válidos; error inducido a mitad de transacción; repetir después de timeout. | O todo o nada; informe/equipo/estado/recibo consistentes, sin duplicaciones ni éxito falso. | T10,T20 |
| E10 | Conformidad y reseña | Cliente confirma sin reseñar; luego reseña/reintento; disconformidad separada. | Trabajo puede completar sin estrella obligatoria; rating no aumenta dos veces; caso abierto visible. | T21,T23 |
| E11 | Comprobante | Token válido, arbitrario, vencido/revocado; consultar sin login. | Sólo proyección pública mínima del servicio real; inválidos sin muestra fija; sin datos privados ni indexación. | T22 |
| E12 | Reclamo y garantía | Cliente propio/ajeno; dentro/fuera de cobertura; operador asigna y resuelve/reabre. | Cobertura calculada en servidor; SLA, notas privadas y revisita vinculada; cambios auditados. | T23 |
| E13 | Dinero en excepciones | Cancelar antes/después de pagar; pago tardío; refund parcial/total/fallido; reemplazo pagado. | Sin doble devolución ni cambio de beneficiario histórico; monto disponible verificado; pendientes conciliables. | T18 |
| E14 | Archivos hostiles y pérdida de acceso | MIME engañoso, exceso tamaño, ruta ajena, URL vencida, lectura tras suspensión. | Archivo no se vincula como válido; autorización de lectura real; datos sensibles fuera de logs. | T10,T30 |
| E15 | Red interrumpida y doble clic | Cortar red al enviar aceptación, cierre, extra y soporte; recargar en otro dispositivo. | Estado reconstruido del servidor; reintento idempotente; borrador claramente pendiente; no falsa confirmación. | T19,T27,T28 |
| E16 | Volumen y datos vacíos | Sin servicios; >100 registros por rol; búsqueda/paginación; usuario cambia cuenta. | Listas completas por páginas, KPIs del servidor y caché sin mezclar identidades. | T12,T27,T28,T29 |
| E17 | Entrega y fallos externos | Caída email, doble worker, worker muerto durante lease, evento venenoso. | Reintentos acotados; entrega deduplicada cuando proveedor permite; dead letter visible; reenvío autorizado. | T24,T30 |
| E18 | Operación y accesibilidad | Operador resuelve cola, finanzas devuelve y calidad gestiona reclamo; teclado y teléfono real. | Permisos separan funciones, etiquetas/foco/errores legibles, carga de foto usable, acciones sin SQL. | T29,T31,T34 |


T34 relaciona navegador con integración SQL/HTTP. Ejecutar Chromium y WebKit; teclado, foco, errores, contraste y teléfono físico. Emulación no reemplaza cámara/red real. Automatizar semántica/accesibilidad donde sea útil; registrar revisión manual de lo no comprobable por herramienta.

## 6. Matriz Mercado Pago MP01–MP12

| Caso | Escenario | Resultado / comprobación |
| --- | --- | --- |
| MP01 | OAuth válido | Vincular cuenta de prueba del profesional correcto; cifrado en reposo, ownership y seller_id correctos; callback limpio. |
| MP02 | OAuth inválido | state incorrecto/vencido/reutilizado, callback sin sesión o sesión de otro usuario; no vincula ni filtra tokens. |
| MP03 | Refresh y revocación | Dos refresh concurrentes, token vencido/revocado y desconexión; una renovación coherente, error visible, historial preservado. |
| MP04 | Checkout canónico | Monto/moneda/collector/fee/referencia y URLs corresponden al snapshot; doble clic reutiliza preferencia válida. |
| MP05 | Pendiente y rechazado | Cliente vuelve antes del webhook; pendiente/rechazado no habilita prestación ni se confunde con cobro confirmado. |
| MP06 | Aprobado | Notificación válida seguida de consulta al proveedor; transición única y conciliación de bruto, costo, comisión y neto. |
| MP07 | Firma y manipulación | Firma ausente/incorrecta y pago de otra cuenta, moneda, monto o referencia; rechazo/cuarentena sin acreditar trabajo ajeno. |
| MP08 | Duplicados y desorden | Repetición de evento y entrega fuera de orden concurrente; no duplica cobro/evento ni degrada estado canónico. |
| MP09 | Timeout e incertidumbre | Cae respuesta al crear preferencia/cobro o lease; reconciliar antes de reintentar, respetar expiración y asignación fijada. |
| MP10 | Webhook ausente | Pago existe sin notificación; conciliación con permisos lo recupera una vez, con seguimiento del operador. |
| MP11 | Reembolsos | Solicitud parcial/total, replay, timeout, fallido y excedente; confirmar estado con proveedor antes de declarar devuelto. |
| MP12 | Cancelación tardía, disputa y cuenta desconectada | Pago después de cancelar, contracargo/reclamo y desconexión con historial; cola de excepción y resolución financiera auditable. |


**Evidencia por caso:** entorno, commit, aplicación/cuenta de prueba sin secretos, IDs saneados, acción, respuesta proveedor, estados local antes/después, conciliación y responsable. No tokens ni datos de tarjeta. No capturar tarjeta en Lysto cuando el flujo usa checkout del proveedor.

**Sandbox:** usar `passed/failed/pending/not-supported` con razón. `not-supported` no equivale a pass. G14 requiere criterio alternativo verificable: prueba de contrato local más confirmación documentada del proveedor/titular sobre capacidad, o prueba financiera controlada expresamente autorizada. Si sigue incierto un flujo obligatorio, permanece bloqueado; no inyectar datos falsos al proveedor para completar la matriz.

Preservar firma y consulta canónica existentes. Mercado Pago documenta validación del origen mediante firma secreta; confirmar producto/país/cuenta en T17/T36. [Webhooks de Mercado Pago](https://www.mercadopago.com.ar/developers/en/docs/checkout-bricks/additional-content/your-integrations/notifications/webhooks).

## 7. Aceptación de operadores UAT

Necesita operador designado real y suplente en al menos una práctica. Registrar evaluador/rol, fecha, versión, pasos, impedimentos y aceptación. La prueba del agente no cuenta como capacitación de una persona.

| Caso | Ejercicio | Criterio de evaluación |
| --- | --- | --- |
| UAT-01 | Operación normal | Operador recibe solicitud, revisa, asigna y sigue hasta conformidad; cliente y pro usan sus cuentas. Comparar registros y paneles. |
| UAT-02 | No hay técnico / ausencia | Oferta rechazada/vencida y ausencia; operador reprograma o cancela y comunica según política, sin editar SQL. |
| UAT-03 | Cancelación pagada | Finanzas inicia devolución y operaciones ofrece reemplazo; puede explicar al cliente el estado real del dinero. |
| UAT-04 | Adicional controvertido | Cliente rechaza o discute extra, operador contiene caso y evita completar con autorización inexistente. |
| UAT-05 | Fotos y mala conexión | Profesional en teléfono captura evidencia, pierde red, recupera borrador, reintenta y verifica cierre real. |
| UAT-06 | Garantía | Cliente reclama, operador verifica cobertura y calidad dispone revisita o resolución documentada con plazos. |
| UAT-07 | Conciliación y turno | Finanzas detecta discrepancia, operador sin permiso no devuelve; turno saliente entrega casos pendientes a suplente. |
| UAT-08 | Incidente | Alerta de caída o fuga simulada; responsable limita nuevas operaciones, sigue runbook, restaura aislado y comunica por canal aprobado. |


La conciliación muestra bruto, costo/comisión efectivamente conocido, neto y devolución, distinguiendo estimación de dato confirmado. No prometer neto garantizado calculado con provisión no validada.

## 8. Gates G01–G16 y evidencia de release

| Gate | Capacidad | Tareas fuente | Evidencia mínima |
| --- | --- | --- | --- |
| G01 | Fuente reproducible | T00 | Checkout limpio del snapshot aprobado; lockfile, vendor y migraciones presentes; sin secretos; build identificable. |
| G02 | Dependencias y secretos | T02 | Instalación reproducible, auditoría reciente, sin críticas/altas aplicables sin corregir; análisis documentado de aplicabilidad; escaneo de secretos. |
| G03 | Base reproducible y permisos | T03,T04 | Reset aislado y upgrade ensayados; historial y tipos alineados; pgTAP/RLS reales sin skips; protección public/private/storage. |
| G04 | Identidad y autorización | T06,T08,T09 | Pruebas anónimo/roles/propiedad/MFA/suspensión/revocación; verificaciones cercanas a datos y acciones. |
| G05 | Alta y cuentas | T07,T11 | Registro, verificación, recuperación, logout e invitación/alta/aprobación profesional persistentes con evidencias. |
| G06 | Solicitud hasta asignación | T05,T13,T14,T15,T16 | Presupuesto versionado, aceptación, disponibilidad y oferta concurrentes; ningún doble compromiso. |
| G07 | Integridad financiera | T17,T18 | Ledger y concurrencia reales; conciliación/refund/cancelación; importes, beneficiario e idempotencia protegidos. |
| G08 | Servicio y posventa | T10,T19,T20,T21,T22,T23,T25 | Adjuntos privados, visita, adicionales, informe, conformidad sin reseña, comprobante seguro e historial/reclamos reales. |
| G09 | Interfaces y APIs reales | T12,T26,T27,T28,T29 | Las 69 páginas iniciales y las 36 APIs tienen disposición verificada; nuevas rutas añadidas; sin datos demo en producción. |
| G10 | Calidad automatizada y móvil | T33,T34 | CI, dominio, unitarias, integración, DB y E2E pasan; regresiones críticas y accesibilidad verificadas; móvil real aprobado. |
| G11 | Operación técnica | T24,T30 | Worker durable, retries, alertas, permisos, rate limits, health y switches probados; fallos de entrega visibles. |
| G12 | Capacidad y costo | T35 | Carga aprobada, cuotas/costo unitario y mensual documentados, sin saturación DB y con límites operables. |
| G13 | Restauración y claves | T32 | Restauración DB+archivos/configuración verificada en entorno aislado dentro de RPO/RTO aprobados. |
| G14 | Staging y proveedor | T36 | Mismo candidato en runtime real, matriz MP completa conforme capacidades del proveedor, email/Storage/Auth/worker/callbacks aceptados. |
| G15 | Autorización y operación de lanzamiento | T31,T37 | Políticas aprobadas, operador y suplente formados, configuración de producción revisada, runbook y decisión firmada por responsables. |
| G16 | Resultados del piloto y mantenimiento | T38,T39 | Piloto real satisface muestra/tiempo y métricas aprobadas, cero bloqueantes abiertos; conciliación y traspaso de mantenimiento completos. |


**Targets:** `technical` exige G01–G13; `pilot` G01–G15; `general` G01–G16. Manifest incluye los 16 con estado, aunque target no requiera todos. `general` nunca se autoriza al terminar sólo pruebas técnicas.

**Reglas para T33:**

1. Catálogo obligatorio fijo, no sólo filtrar lo recibido. Rechazar lista vacía, gate desconocido/duplicado/ausente, evidencia sin artefacto y `pending/failed/skipped` en requerido.
2. Cada resultado referencia release ID, commit SHA, schema/migration set, entorno y fecha. Validar esquema, exit code y contadores; pass es derivado, no hardcoded.
3. Evidencia automatizada del commit exacto. Cambios invalidan pruebas afectadas; reutilización debe explicar dependencias, no aceptar automáticamente otra versión.
4. Vigencia propuesta para T33/D10: audit dependencias ≤72 horas antes de activar; smoke/health/config del deploy actual; restore ≤30 días y posterior a cambio incompatible; UAT/políticas para alcance vigente y reconfirmadas si cambia. Son parámetros explícitos propuestos.
5. Entorno compatible por gate: migración en DB descartable; E2E local/staging; proveedor en entorno apropiado; smoke producción; piloto casos reales. No exigir restore destructivo en producción.
6. Evidencia humana/proveedor requiere aprobador, fecha y referencia verificable. El agente registra decisión recibida; no suplanta responsable.
7. Sin ciclos: T33 puede probar rechazo de manifest incompleto aunque M2 siga bloqueado. T37 exige G01–G15 y deja G16 pendiente; T38 aporta piloto, T39 traspaso y evaluación general.

**Manifest propuesto (ejemplo incompleto, debe ser rechazado):**

```json
{
  "schemaVersion": 1,
  "releaseId": "candidate-id",
  "commit": "verified-git-sha",
  "migrationSetHash": "sha256-of-applied-set",
  "target": "pilot",
  "environment": "production",
  "gates": [
    {
      "id": "G01",
      "status": "pending",
      "evidence": [],
      "reviewer": null,
      "checkedAt": null
    }
  ]
}
```

El manifest real tiene G01–G16. El registro de avance del plan no es manifest ni habilita release.

## 9. Continuidad, datos y ambientes

- Desarrollo/CI usan DB descartables; staging tiene proyecto, correo y pagos de prueba aislados; producción credenciales exclusivas y responsables. Identificar por configuración explícita.
- Inventariar Auth, perfiles, documentos, direcciones, fotos, presupuestos, ledger, historial, casos, notificaciones y consentimientos. Definir propietario, retención, exportación/eliminación y permisos por clase. Preservar datos financieros/históricos conforme política aprobada.
- Restaurar archivos además de DB: backups Supabase incluyen metadatos, pero no objetos Storage. [Copias de seguridad de Supabase](https://supabase.com/docs/guides/platform/backups). Probar lectura autorizada de archivos, no sólo contar filas.
- Respaldar configuración y recuperar claves para descifrar tokens; custodiar secretos fuera del backup general y ensayar rotación. Desactivar envíos/cobros nuevos al restaurar aislado.
- Medir RPO desde último dato recuperable y RTO hasta smoke/conciliación. Backup diario no demuestra RPO de una hora. Registrar costo y alcance real.
- Rollback de app no revierte dinero externo. Volver DB atrás exige reconciliación de operaciones posteriores; preferir migración compatible/forward fix cuando corresponda.
- Verificar controles efectivos del proyecto/cuentas con el [checklist oficial Supabase](https://supabase.com/docs/guides/deployment/going-into-prod); checklist escrito no demuestra funcionamiento.
- Centralizar autorización cerca de datos y DTO mínimos según la [guía oficial Next.js](https://nextjs.org/docs/app/guides/authentication). Adaptar a versión instalada; no cambiar middleware/framework sólo por ejemplos de otra versión.

## 10. Interrupción y avance

Pausar solicitudes/checkouts nuevos ante acceso indebido, doble cobro, beneficiario incorrecto, datos perdidos o estado financiero indeterminable. Mantener webhooks, conciliación, soporte y clientes existentes cuando sea técnicamente seguro. Crear incidente, asignar responsable, preservar evidencia y seguir runbook; no borrar historial.

Un pendiente externo no detiene todo: elegir tarea con dependencias técnicas satisfechas. Estados: `pending/in_progress/implemented/verified/blocked_external`. `verified` requiere pruebas y aceptación satisfecha. Bloqueo conserva razón, responsable, fecha y siguiente acción; tiempo de espera no es aprobación.

