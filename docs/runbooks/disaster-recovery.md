# Recuperación ante desastre

Estado: procedimiento preparado; el ensayo completo requiere destino aislado, backup real y aprobación D09. Objetivos propuestos: RPO máximo 60 minutos y RTO máximo 4 horas. No se consideran aprobados hasta medir un restore completo.

## Alcance del respaldo

El inventario debe incluir PostgreSQL completo (`public`, `private`, `auth`, `storage`, historial de migraciones y roles), objetos de Storage, configuración de Auth y redirects, variables y versiones del gestor de secretos, configuración del runtime y scheduler, DNS, correo, outbox, eventos de webhook, ledger, devoluciones y tokens OAuth cifrados. Un dump de DB no contiene necesariamente los bytes de Storage ni los secretos que permiten descifrar tokens.

Cada copia de Storage lleva bucket, ruta, tamaño y SHA-256 del derivado verificado. El manifiesto de recuperación registra fechas de backup y último punto recuperable, destino `production:false`, historial esperado, mínimos por tabla y objetos testigo. No contiene passwords, claves ni tokens.

## Restauración aislada

1. Designar responsables, backup y destino distinto de producción. Preservar el origen.
2. Configurar `APP_ENV=test|staging`, proveedor de pagos `mock`, correo y workers apagados, y ambos interruptores de entradas en `false`.
3. Restaurar DB, roles/Auth, Storage y configuración. Cargar secretos desde el custodio; nunca desde el repositorio o el manifiesto.
4. Ejecutar migraciones faltantes sólo después de comparar historial. No reparar historial para ocultar diferencias.
5. Ejecutar `node scripts/verify-restore.mjs --manifest <manifest> --output <evidencia-nueva>`. La operación exige autorización explícita y allowlist del project ID.
6. Verificar login sintético, aislamiento de roles, archivos privados, canary de descifrado, integridad referencial, colas y ledger sin contactar Mercado Pago.
7. Medir RPO/RTO reales. Un resultado fuera del objetivo bloquea G13 aunque todos los datos visibles parezcan correctos.

## Reanudación

Antes de habilitar tráfico, conciliar eventos del proveedor posteriores al punto recuperado. Mantener nuevos checkouts y solicitudes apagados mientras se aplican webhooks faltantes por su clave idempotente. Revisar outbox restaurado para evitar mensajes ya entregados y conservar IDs de proveedor. Activar primero lecturas y conciliación, luego solicitudes, y por último checkouts. Producción requiere una decisión de lanzamiento separada.

## Rollback de release y restore

Un rollback de aplicación vuelve a un artefacto compatible y no revierte automáticamente migraciones. Es la primera opción ante un defecto de código porque conserva operaciones, auditoría, ledger, outbox y eventos recibidos. Si el esquema nuevo no admite la aplicación anterior, mantener entradas cerradas y aplicar un forward fix probado.

Un restore reemplaza estado y sólo corresponde a corrupción o pérdida confirmada. Requiere incidente declarado, responsable, destino, punto recuperable, autorización y conciliación posterior de webhooks, pagos, outbox y archivos. Nunca ejecutar restore como atajo de despliegue ni borrar eventos recibidos durante la pausa.
