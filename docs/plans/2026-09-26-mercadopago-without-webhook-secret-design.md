# Mercado Pago sin clave de Webhooks: diseño

## Contexto y objetivo

El proyecto tiene Client ID, Client Secret, Access Token y clave de cifrado de Mercado Pago, pero no la firma de Webhooks, que solo se revela en el panel de la aplicación de un tercero. La cuenta de base de datos específica para marketplace y su URL de conexión de producción ya fueron creadas. La migración `20260920171628_marketplace_orders.sql` no está aplicada, aunque el código actual consulta columnas que esa migración agrega. Todavía no hay checkouts en producción.

El objetivo es que un profesional vincule su cuenta por OAuth y que Checkout Pro reparta el cobro 1:1, sin atribuir autoridad a notificaciones sin firma ni depender del acceso al panel de la aplicación.

## Opciones consideradas

1. Webhooks firmados: son la mejor opción a largo plazo, pero requieren la clave que no está disponible. No se inventará ni se reutilizará otra credencial como firma.
2. Solo conciliación iniciada por cliente/admin: es segura, pero puede dejar un pago pendiente de registrar si nadie vuelve a abrir la pantalla.
3. IPN de cada preferencia como aviso, seguida de consulta canónica al API: no requiere configuración del panel. Es la opción elegida, con la conciliación manual existente como respaldo. IPN está anunciado por Mercado Pago como mecanismo próximo a descontinuarse; cuando exista la clave real se podrá regresar a Webhooks firmados.

## Flujo y límites de confianza

- OAuth usa `OAuthManager` y la cuenta profesional vinculada por su ID interno. No requiere secreto de Webhooks.
- La preferencia de Checkout Pro se crea con el access token OAuth del vendedor y `marketplace_fee` calculado en servidor. Se usa `SplitPaymentClient` directamente para no exigir una firma de Webhooks en operaciones que no la necesitan.
- La `notification_url` incorpora el ID del checkout y un HMAC calculado con la clave de cifrado de la integración. Se fuerza `source_news=ipn` únicamente cuando no hay firma real de Webhooks.
- El receptor IPN limita tamaño, forma y frecuencia, valida el HMAC y obtiene el checkout de la base. Trata `topic` e `id` como pistas, jamás como prueba de pago. Consulta el recurso con el token OAuth del vendedor, verifica `external_reference`, `collector_id`, monto, moneda, modo, comisión y estado, y solo entonces actualiza el ledger mediante la lógica de conciliación existente.
- Un pago no confirmado permanece pendiente. Errores o diferencias pasan a revisión; nunca se infiere aprobación por el retorno del navegador ni por el cuerpo de IPN.
- La consulta manual desde la pantalla de pagos permanece disponible como respaldo; en el retorno del checkout se solicita una conciliación para no depender de la entrega de IPN.

## Esquema, despliegue y pruebas

- Aplicar la migración pendiente a producción y marcarla en `supabase_migrations.schema_migrations`. `MERCADOPAGO_ORDERS_ENABLED` permanece desactivado, por lo que todo checkout nuevo sigue usando Preferences.
- Agregar `MERCADOPAGO_MODE=live`; habilitar `PAYMENTS_PROVIDER=mercadopago_split` solo después de que el código y la base estén alineados. La activación de `LYSTO_ALLOW_NEW_CHECKOUTS` permite una prueba controlada una vez superadas las verificaciones automatizadas, pero no demuestra que OAuth ni un split real hayan sido aceptados por Mercado Pago.
- Probar primero los casos de IPN inválido, repetido, pago ajeno, referencia/monto incorrectos y pago real canónico simulado; luego compilar, probar y verificar la conexión en producción sin exponer secretos. Una transacción real de prueba necesita intervención del usuario y no se ejecutará automáticamente.

## Referencias

- Mercado Pago Split 1:1 Checkout Pro: https://www.mercadopago.com.ar/developers/es/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace
- Mercado Pago IPN por `notification_url`: https://www.mercadopago.com.ar/developers/es/docs/woocommerce/additional-content/your-integrations/notifications/ipn
