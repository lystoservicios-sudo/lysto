# Aceptación de Mercado Pago y proveedores

Estado: **pendiente de D04, D06, D10 y D11**. Ejecutar con aplicación y cuentas oficiales de prueba identificadas. Ningún caso se marca aprobado por simulación local.

| ID | Caso | Evidencia esperada | Estado |
| --- | --- | --- | --- |
| MP01 | OAuth válido | profesional correcto, seller ID, token test cifrado, callback limpio | pendiente |
| MP02 | OAuth inválido | state vencido/incorrecto/reutilizado y sesión ajena rechazados sin filtrar token | pendiente |
| MP03 | refresh/revocación | concurrencia, vencimiento, revocación y reconexión coherentes | pendiente |
| MP04 | checkout canónico | ARS, monto, collector, fee, referencia, URLs y doble click | pendiente |
| MP05 | pendiente/rechazado | retorno no acredita ni habilita visita; reintento permitido sólo cuando corresponde | pendiente |
| MP06 | aprobado | webhook firmado más consulta; una transición; bruto/costo/comisión/neto conciliados | pendiente |
| MP07 | firma/manipulación | firma, cuenta, moneda, monto y referencia inválidos rechazados o en cuarentena | pendiente |
| MP08 | duplicado/desorden | concurrencia no duplica ni degrada estado | pendiente |
| MP09 | timeout/incertidumbre | lease e idempotencia recuperan la misma intención antes de reintentar | pendiente |
| MP10 | webhook ausente | conciliador recupera una vez con seguimiento operativo | pendiente |
| MP11 | reembolso | parcial/total, replay, timeout, fallo y excedente confirmados con proveedor | pendiente |
| MP12 | tardío/disputa/desconexión | excepción durable preserva historial y resolución financiera | pendiente |

Para cada fila guardar fecha, ejecutor, cuenta/aplicación saneada, ID interno, ID del proveedor parcialmente redactado, request/correlation ID, resultado esperado/observado, limitación sandbox y artefacto. La recepción en navegador no prueba pago y la aceptación HTTP del email no prueba entrega a bandeja.

También verificar buzones de prueba, firma del webhook, renovación OAuth, scheduler, alertas y capacidad de detener checkouts nuevos sin detener webhooks, conciliación, devoluciones o reclamos. Un caso que el sandbox no permite queda `pending_provider`; se adjunta la prueba local relacionada sin convertirla en evidencia remota.

## Email transaccional

| ID | Caso | Evidencia esperada | Estado |
| --- | --- | --- | --- |
| EM01 | Confirmación de visita | una entrega por versión de agenda, fecha/dirección mínima y enlaces autorizados | pendiente de remitente Resend |
| EM02 | Solicitud de reseña | recepción no antes de dos horas después de confirmar el servicio y un solo CTA | pendiente de remitente Resend |
| EM03 | Supresión | no enviar con agenda vieja, email ausente, disputa, reseña existente o estado inelegible | lógica/SQL aprobada; proveedor pendiente |
| EM04 | Ejecución periódica | cron cada minuto, secreto en Vault, worker acotado y respuestas consecutivas | staging técnico aprobado: cinco HTTP 200; alertas pendientes |

El proveedor de email continúa apagado en staging. Para cerrar EM01–EM03 se necesita un dominio remitente verificado, una API key guardada como secreto y un buzón de prueba designado; registrar ID saneado del mensaje, hora de recepción y resultado observado sin guardar contenido sensible.

No ejecutar un cobro o devolución live sin autorización explícita sobre importe y destinatarios. No registrar access tokens, client secrets, clave de cifrado, firma completa, cookies ni datos de tarjeta.
