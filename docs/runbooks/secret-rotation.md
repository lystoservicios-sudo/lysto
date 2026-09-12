# Custodia y rotación de secretos

## Custodia

Cada ambiente usa secretos distintos en un gestor con auditoría, MFA y acceso mínimo. Designar titular y suplente para Supabase, hosting, Mercado Pago, correo, DNS y observabilidad. Los códigos de recuperación se guardan fuera de los equipos diarios. El repositorio conserva nombres, versión activa y fecha de rotación, nunca valores.

La clave `MERCADOPAGO_ENCRYPTION_KEY` requiere copia recuperable bajo doble control. Su pérdida vuelve ilegibles los tokens OAuth aun si la base fue restaurada. El manifiesto puede guardar un canary cifrado y el SHA-256 de su texto sintético para comprobar la clave sin revelar un token real.

## Rotación general

1. Inventariar consumidores, dueño, versión actual, vencimiento y rollback.
2. Crear el secreto nuevo en el proveedor y cargarlo como versión secundaria.
3. Probar en staging, rotar consumidores de a uno y observar errores.
4. Revocar la versión anterior sólo después de confirmar todos los consumidores y guardar evidencia sin valores.

## Clave OAuth

Pausar nuevos checkouts y conexiones OAuth, conservar webhooks y conciliación, y respaldar la tabla cifrada. En una transacción aislada, descifrar cada access/refresh token con la clave anterior y su contexto `sellerId/tokenType`, volver a cifrar con la nueva y verificar roundtrip antes de escribir. Si una fila falla, revertir todo. Desplegar la nueva clave, probar lectura de todas las cuentas y recién entonces retirar la anterior. Nunca registrar texto plano ni ejecutar una actualización masiva que no pueda volver a la copia previa.

Un ensayo usa tokens sintéticos y un destino descartable. La rotación real requiere ventana, dos responsables y plan de rollback; no se ejecuta como parte de tests automatizados.
