# Mercado Pago Split en Lysto

## Qué quedó implementado

Checkout Pro usa el paquete del repositorio solicitado, fijado en `aeb07a24303edf701004ec1dbb8d4073dc8784af`. El paquete se instala desde `vendor/` con su cliente Prisma generado. Los complementos de Lysto están en `lib/payments/marketplace*.ts`; las migraciones se administran con Supabase, no con el migrador independiente del paquete.

1. Finanzas configura **Comisión Lysto (%)** en `/admin/calculadora` (por ejemplo, 18 para el 18%). Cada presupuesto conserva la comisión acordada. Cambiar la configuración afecta presupuestos nuevos; no cambia importes ya aceptados.
2. El cliente acepta el presupuesto. Operaciones propone el trabajo; el técnico lo acepta antes de habilitar el cobro.
3. Cada técnico aprobado vincula su propia cuenta desde `/pro/mercadopago`, autorizando la aplicación de Mercado Pago de Lysto.
4. El cliente paga desde el detalle de su trabajo. El servidor recupera precio, destinatario y comisión de los registros aceptados. No acepta estos valores desde el navegador.
5. Mercado Pago reparte el pago. El webhook consulta el pago auténtico y valida referencia, destinatario, moneda, ambiente, importe y comisión. El retorno del navegador nunca aprueba un pago.
6. La visita requiere pago inicial aprobado. Las fallas adicionales conservan su propuesta y aceptación separadas; se pueden pagar desde el mismo trabajo con comisión Lysto igual a cero.

El 30% de protección está incluido en el precio del presupuesto. No se aplica otra vez al pagar. Los cargos de Mercado Pago son del profesional y se muestran separados de la comisión Lysto. Un adicional de $50.000 tiene $0 de comisión Lysto: el profesional recibe $50.000 menos los cargos que aplique Mercado Pago. No hay una promesa de neto final fijo.

Con comisión Lysto de 18% y costo estimado de Mercado Pago de 6%, el neto profesional equivale al 98,8% del costo base calculado. Por eso la calculadora marca revisión y operaciones no puede aprobar una cotización nueva con costos estimados sin cubrir. Hay que verificar costos y ajustar la comisión o los valores base explícitamente; el sistema no cambia el precio automáticamente. El 6% es una provisión de prueba, no una tarifa vigente verificada.

## Configuración para activar

Aplicar, en orden, las migraciones de presupuestos y estas dos migraciones nuevas:

- `20260910204604_marketplace_split_checkout.sql`
- `20260910220000_marketplace_guards.sql`

La aplicación necesita Node.js 22.12 o posterior dentro de la rama 22. Instalar con `pnpm install --frozen-lockfile`. El servidor debe tener:

| Variable | Uso |
|---|---|
| `PAYMENTS_PROVIDER=mercadopago_split` | Activa la integración |
| `NEXT_PUBLIC_APP_URL` | URL pública HTTPS de Lysto, sin subruta |
| `MERCADOPAGO_MODE=test` o `live` | Ambiente explícito |
| `MERCADOPAGO_MARKETPLACE_CLIENT_ID` | Aplicación de la cuenta propietaria de Lysto |
| `MERCADOPAGO_MARKETPLACE_CLIENT_SECRET` | Secreto de esa aplicación, sólo servidor |
| `MERCADOPAGO_WEBHOOK_SECRET` | Firma de notificaciones de esa aplicación |
| `MERCADOPAGO_ENCRYPTION_KEY` | 32 bytes aleatorios codificados en base64, guardados de manera estable |
| `MERCADOPAGO_DATABASE_URL` | PostgreSQL de la misma base Supabase; conexión directa o pool de sesión, sólo servidor |

Los tokens OAuth se cifran con AES-256-GCM; perder la clave de cifrado impide recuperarlos. No rotar esta clave sin un procedimiento de recifrado. La conexión PostgreSQL necesita permisos sobre el almacenamiento del paquete y las tablas privadas; las credenciales nunca van al navegador. El rol `service_role` HTTP de Supabase no tiene acceso a las tablas de tokens.

En la aplicación de Mercado Pago de los dueños, habilitar la modalidad marketplace/split y registrar exactamente:

- Redirect OAuth: `https://TU-DOMINIO/api/mercadopago/oauth/callback`
- Webhook: `https://TU-DOMINIO/api/mercadopago/webhook`
- Eventos de pagos y órdenes comerciales, según la configuración disponible de la aplicación.

El cliente no debe entregar contraseñas ni tarjetas a Lysto: se ingresan en Mercado Pago. El split utiliza el token del técnico autorizado y `marketplace_fee` como importe monetario exacto para la aplicación propietaria. No requiere transferencias posteriores implementadas por Lysto.

En pruebas, OAuth solicita `test_token=true` y comprueba `live_mode=false` tanto al conectar como al renovar tokens. El cobro exige un token `TEST-` y usa exclusivamente `sandbox_init_point`; no cae a una URL de producción. Si una modalidad de pruebas de Mercado Pago devuelve credenciales diferentes, la integración las rechaza y se debe revisar esa modalidad antes de habilitarla. Cambiar a `live` requiere credenciales, autorizaciones y pagos de prueba validados para esa aplicación. No reutilizar registros del ambiente de pruebas como pagos reales.

## Operación y recuperación

- Cliente: `/app/pagos` y detalle del trabajo.
- Técnico: `/pro/mercadopago`, `/pro/pagos/mercadopago` y detalle del trabajo.
- Finanzas: `/admin/pagos/split`. Sólo administradores con permiso `finance` o `owner` pueden consultar todos los cobros y renovar enlaces.
- **Consultar estado en Mercado Pago** recupera datos canónicos aunque el webhook haya demorado. Las consultas manuales repetidas tienen un intervalo mínimo de 30 segundos.
- **Renovar enlace vencido** vuelve a consultar los pagos y extiende la misma preferencia por 30 minutos. No crea una segunda preferencia. Se bloquea si hay pagos pendientes, cobrados, discrepancias o un cambio de asignación. Un intento incierto cuya preferencia no pudo recuperarse se conserva para revisión; no se cobra otra vez con una clave nueva.
- Un pago rechazado puede reintentarse con el mismo enlace mientras siga vigente. Un pago pendiente no habilita otro intento desde Lysto.
- Dos pagos aprobados para la misma intención quedan en revisión. Los reembolsos parciales, completos y contracargos se registran con su estado auténtico. Las devoluciones se ejecutan desde Mercado Pago y se sincronizan; esta entrega no agrega un botón que emita devoluciones automáticas.
- La cuenta y el profesional quedan ligados a los cobros emitidos, incluso después de un rechazo. Se permite renovar autorización de la misma cuenta. Cambiar el destinatario o borrar/desconectar una cuenta con historial requiere una operación administrativa de cierre/migración que preserve la conciliación; no se ofrece como cambio inmediato.
- Un evento desordenado no reemplaza uno más reciente. Una diferencia de dinero o estado no dispara cumplimiento automático; queda en revisión. Se preservan los movimientos originales.

## Adaptaciones respecto del repositorio

- Integración Node externa en Next.js para conservar el cliente Prisma y los archivos de migraciones.
- RLS y permisos explícitos para que el almacenamiento de OAuth no sea visible mediante Supabase.
- OAuth ligado a usuario/profesional y cookie HttpOnly con HMAC; estado de un solo uso del paquete.
- Ambiente OAuth validado antes de guardar tokens; URL sandbox sin alternativa de producción.
- Vencimiento real de Checkout Pro con `expires`, `expiration_date_from` y `expiration_date_to`, y webhook configurado en la preferencia.
- Intención de pago persistente, importes inmutables, clave de idempotencia estable y bloqueo temporal de creación.
- Conciliación por `date_last_updated`, control del destinatario, cero comisión para adicionales y observación de costos/reembolsos.
- Se ignoran acciones `mp-connect` para desconectar cuentas: la firma autentica el identificador del recurso, no el texto arbitrario `action`. La desvinculación de Lysto es una acción autenticada y protegida por la base de datos.

## Validación reproducible

`pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build` y `pnpm exec supabase test db --local`. Si hay un servidor de desarrollo abierto, usar `LYSTO_BUILD_DIR=.next-verify` al compilar y al iniciar la revisión de producción para separar los archivos generados.

Los tests de ledger con PostgreSQL se ejecutan con `LYSTO_TEST_DATABASE_URL` apuntando exclusivamente a localhost y `pnpm exec vitest run marketplace`. Los fixtures se revierten. Los demás tests de pagos corren sin credenciales externas. Para consultar el puerto local: `docker port supabase_db_lysto 5432`.

La validación local no sustituye la aceptación en la cuenta de Mercado Pago. Esta entrega no creó pagos reales, no obtuvo consentimientos de técnicos y no aplicó migraciones a una base remota.

La ejecución remota MP01–MP12 y sus campos de evidencia se registran en `docs/release/provider-acceptance.md`. Ninguna fila pendiente puede habilitar Mercado Pago live por inferencia.

## Referencias oficiales consultadas

- [Configuración del split y descuento de cargos](https://www.mercadopago.com.ar/developers/es/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace)
- [OAuth y tipos de token](https://www.mercadopago.com.ar/developers/es/reference/authentication/oauth/_oauth_token/post)
- [Vigencia de una preferencia](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/additional-settings/term-of-preference)
- [Notificaciones y firma](https://www.mercadopago.com.ar/developers/en/docs/your-integrations/notifications/webhooks)
- [Búsqueda de pagos](https://www.mercadopago.com.ar/developers/es/reference/online-payments/subscriptions/search-payments/get)
- [Paquetes externos de servidor en Next.js](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages)
