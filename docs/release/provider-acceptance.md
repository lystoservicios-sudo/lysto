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

No ejecutar un cobro o devolución live sin autorización explícita sobre importe y destinatarios. No registrar access tokens, client secrets, clave de cifrado, firma completa, cookies ni datos de tarjeta.
