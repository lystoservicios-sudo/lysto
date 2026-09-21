# Activación del registro de clientes en producción

## Decisión

Por instrucción expresa del titular del proyecto del 21 de septiembre de 2026, se habilita el alta pública de cuentas de clientes por correo electrónico. El acceso de personal y técnicos continúa separado y Google permanece deshabilitado.

## Diseño

Las páginas `/terminos` y `/privacidad` publican una versión identificable y vigente para la creación gratuita de una cuenta. Los textos describen el rol de Lysto, el uso de la cuenta, la contratación posterior de servicios, pagos, seguridad, datos tratados, finalidades, proveedores, conservación y derechos. Lysto se identifica por su nombre comercial y por el canal `/contacto`; no se inventan razón social, CUIT ni domicilio fiscal. Esos datos deberán incorporarse antes de presentar una oferta o contratación onerosa cuando corresponda.

La versión `2026-09-21` se registra en `private.account_legal_documents` con la URL pública, el SHA-256 del contenido canónico, fecha efectiva y la aprobación recibida. La fila única de `private.account_registration_policy` apunta a ambas versiones y se habilita en la misma transacción. El alta sigue exigiendo aceptación explícita y conserva la evidencia inmutable ya implementada.

## Flujo

1. `/registro` obtiene la política activa desde Supabase.
2. El cliente completa nombre, apellido, teléfono, correo y contraseña y acepta ambos documentos.
3. Supabase Auth crea una identidad con rol confiable `customer` y envía la confirmación por Resend.
4. El enlace de confirmación vuelve a Lysto y prepara el perfil del cliente.
5. `/login` acepta únicamente cuentas de cliente; técnicos y operadores conservan `/equipo/login`.

## Comprobación

Se comprueba primero con pruebas unitarias que las páginas ya no se presenten como borradores y muestren versión, vigencia y canal de derechos. Después se aplicará la transacción en el proyecto Supabase real, se desplegará `main` y se realizará un alta con una cuenta descartable autorizada, confirmación por correo e inicio de sesión. La cuenta de prueba se retirará al finalizar si el flujo permite hacerlo sin alterar evidencia necesaria.

