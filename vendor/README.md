# Mercado Pago Split vendorizado

- Fuente solicitada: https://github.com/waltergaltieri/mercadopago-split-node
- Revisión: `aeb07a24303edf701004ec1dbb8d4073dc8784af`
- Paquete: `@waltergaltieri/mercadopago-split`, versión `0.1.0`.
- Archivo: `waltergaltieri-mercadopago-split-0.1.0.tgz`.
- SHA-256: `484bc749154d70b6ce4c81fda2f93ba2a832d12e1ef952b339b2688dcd1990ef`.
- Licencia declarada por el paquete: `UNLICENSED`. Se incorpora por solicitud del propietario para este sistema; no se publica en un registro público.

Empaquetado con `npm ci --ignore-scripts` y `npm pack` en una copia de la revisión indicada. `prepack` genera Prisma y compila TypeScript. El archivo preserva el README, metadatos, distribución y migraciones del paquete; las adaptaciones específicas de Lysto están fuera del archivo, en `lib/payments/` y las migraciones de Supabase.

Para actualizar, revisar la nueva revisión y sus migraciones, generar otro paquete, actualizar el archivo y lockfile, y repetir las pruebas OAuth/Prisma, contratos monetarios, webhook y compilación Next.js. No ejecutar el migrador del paquete sobre tablas ya administradas por Supabase.
