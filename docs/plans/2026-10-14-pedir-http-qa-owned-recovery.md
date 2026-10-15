# Recuperación acotada de la prueba HTTP de Pedir

Solo el run `0f3d5c73-1789-40e2-a240-f45251449195` del proyecto QA `obksyzasmfwcbbksesqt`. No modifica producción ni reintenta la prueba, no arranca Next, no ejecuta proveedores, no borra sesiones ni detiene procesos. El registro original conserva `app-mutation` como resultado incierto; la recuperación tiene un recibo separado.

1. Agregar pruebas locales de alcance exacto, transportes, identidad, incertidumbre y restauración; comprobar RED.
2. Implementar un helper independiente, inerte por defecto, con confirmación explícita del run reconciliado y hash del manifiesto original.
3. Antes de leer claves y antes de cada DELETE Auth: comprobar puerto 3175 cerrado, cero sesiones y cero RPC de Hogar pendientes, las parejas Auth/perfil/cliente exactas y el baseline normalizado sin otras filas. Las 412 filas históricas de rate limit deben conservar cantidad y hash completos.
4. Obtener la clave QA solamente en memoria mediante el wrapper Owner original; comprobar ref/rol/expiración. GET y DELETE Auth solo admiten los dos UUID conocidos, verificando email y app_metadata. Cualquier resultado incierto detiene la secuencia.
5. Después de comprobar las cascadas propias ausentes, eliminar solo los dos HMAC registrados dentro de una transacción con comprobación previa de la instantánea. Comparar la instantánea final completa con el baseline original de 78 migraciones.
6. Ejecutar pruebas locales y revisión independiente. No ejecutar el helper ni obtener claves hasta autorización separada del agente raíz tras revisar su código.

Esta recuperación no convierte la prueba HTTP fallida en una prueba aprobada. La corrección del RPC y una nueva prueba necesitan su propio ciclo de revisión.

## Estado final

El run original se recuperó, con recibo separado `restored`; manifiesto y SHA intactos. La revisión posterior identificó otro run sin mutaciones de inventario (`9a576d98-a029-415f-8e70-d4117ce77fd8`, baseline 79) y un run con hogar/aire propios (`eceb84f1-e9a9-44ba-a2b7-4858359299a1`). Cada uno tuvo reconciliación de UUIDs/metadata/sesiones/actividad y recuperación independiente, nunca una reinterpretación del run anterior. Las revocaciones SQL exactas se revisaron/ejecutaron separadamente por root; ningún CLI de recuperación las ejecuta automáticamente.

La ejecución nueva `4642522b-d042-4466-8f7d-2ed8fe825399` sí terminó 17/17 con limpieza normal y resultado `cleaned`. Una consulta Owner independiente confirmó baseline 79 completo idéntico, cero cuentas/sesiones/inventario de pruebas y las 412 filas históricas con hash intacto. Esto acredita únicamente la prueba parcial Auth/HTTP; no una compra ni un pago real de Mercado Pago.
