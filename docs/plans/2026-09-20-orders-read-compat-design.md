# Lectura compatible durante el despliegue de Orders

## Decisión

Los cobros nuevos usan Checkout Pro mediante la API de Orders. Los cobros históricos siguen siendo `preferences`; este cambio no vuelve a crear Preferences ni activa pagos reales.

La publicación de código puede preceder a la migración de la base. La lista de checkouts intentará la consulta que incluye Orders. Sólo si PostgreSQL informa que falta una columna (`42703`) o relación (`42P01`) de esa consulta, reintentará con la consulta histórica de Preferences. Cualquier otro error se propagará. Cuando la migración exista, la consulta nueva mostrará ambos protocolos y sus observaciones; cuando no exista, la consulta histórica seguirá funcionando.

## Alternativas consideradas

- Ejecutar la migración de producción antes del código: evita la compatibilidad temporal, pero exige respaldo, restauración probada y aceptación operativa antes del despliegue.
- Vincular la lectura a `MERCADOPAGO_ORDERS_ENABLED`: es más simple, pero al apagar la creación de Orders también ocultaría las observaciones de Orders ya existentes. Se descarta.
- Reintentar sólo ante ausencia comprobada de objetos SQL: mantiene la lectura de órdenes existentes después de apagar la creación y permite publicar código antes del esquema. Es la opción elegida.

## Verificación y salida

Una prueba reproducirá una base sin la migración y comprobará la lectura histórica; otra comprobará que una base migrada usa la consulta Orders sin reintento. Una tercera comprobará que errores ajenos al esquema no se ocultan. La integración en `main` requiere pruebas completas y revisión. El despliegue conservará pagos y nuevas solicitudes apagados; no se aplicará la migración ni se cargarán credenciales nuevas en producción en este paso.
