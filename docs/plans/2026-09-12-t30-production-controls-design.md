# T30 — Observabilidad, límites y controles

La aplicación usa estado compartido en Postgres para limitar autenticación, registro, recuperación, cotización, recibos, mutaciones privadas y webhooks. Las claves son HMAC opacas y la API responde `429` con `Retry-After`.

Cada solicitud recibe una correlación y los eventos estructurados incluyen release, ruta, estado y latencia. La redacción recursiva elimina credenciales, cookies y datos personales. Las cabeceras globales aplican CSP, aislamiento de marcos, política de referencia y restricciones de capacidades compatibles con Mercado Pago y Supabase.

`APP_ENV` distingue desarrollo, prueba, staging y producción. Producción exige proveedor split, secreto de límites y valores explícitos para aceptar solicitudes y checkouts. Ambos interruptores son independientes para conservar webhooks, conciliación y operaciones financieras existentes.

Las sondas `/api/health/live` y `/api/health/ready` separan vida del proceso de configuración y dependencia de base de datos. La sonda de preparación sólo publica estado y edades agregadas de colas.
