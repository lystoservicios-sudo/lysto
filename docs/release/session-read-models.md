# T12 — Lecturas de datos por sesión

Las fábricas `createCustomerQueries`, `createProfessionalQueries` y `createAdminQueries` reciben el cliente autenticado de la petición. Cada operación verifica la identidad con Auth y obtiene nuevamente el contexto de base. No emplean una clave de servicio ni caché compartida. Las consultas conservan RLS; los filtros de propietario se derivan del contexto verificado y también se aplican a los conteos.

## Contratos

`list(resource, { pageSize, cursor, status })`, `detail(resource, id)` y `metrics()` cubren solicitudes, trabajos, pagos, equipos, profesionales y reclamos. Los DTO de `read-contracts.ts` seleccionan campos explícitos; las respuestas se validan antes de proyectarlas.

| Recurso | Cliente | Profesional aprobado | Administración |
| --- | --- | --- | --- |
| Solicitudes y trabajos | Propios | Asignados, según RLS | Operaciones, calidad o finanzas |
| Pagos | Importe propio | Importe a recibir | Finanzas: importe y distribución |
| Equipos | Propios | Relacionados con trabajos asignados | Operaciones o calidad |
| Profesionales | No disponible | Su perfil | Operaciones |
| Reclamos | Propios | Relacionados con trabajos asignados | Calidad |

El permiso owner incluye los alcances administrativos. Un recurso no permitido provoca un error explícito. Los detalles ajenos no devuelven filas. Se comprueba nuevamente la suspensión y los permisos al solicitar otra página.

Ningún DTO incluye tokens OAuth, claves de checkout, respuestas del proveedor, datos Auth, DNI, CUIL, nacimiento, notas privadas, rutas de Storage ni fotos originales. Las listas de pagos tampoco solicitan `provider_payment_id`, cuya lectura directa está revocada incluso para la sesión de finanzas. La conciliación detallada utilizará su contrato específico en T17/T18. El puntaje interno de un profesional sólo forma parte de la proyección administrativa autorizada.

## Paginación y consistencia

El máximo es 100 filas, por defecto 25. El orden descendente combina `created_at` e `id`, conserva la precisión de microsegundos de PostgreSQL y obtiene una fila adicional para determinar si existe otra página. El cursor opaco se valida estrictamente y está vinculado al perfil, rol, recurso y filtro. No constituye autorización: RLS se vuelve a evaluar en cada consulta.

El total aplica los mismos filtros y permisos que la lista, sin aplicar la posición del cursor. Conteo y página son consultas separadas: una mutación concurrente puede modificar el total entre ambas, y las páginas sucesivas no son una fotografía congelada. No se infieren totales contando una página. Volver a leer desde el inicio después de una mutación, cambio de filtros o permisos; no reutilizar un cursor de otra consulta.

`loadReadPage` distingue error, vacío y resultado. Una página agotada con total positivo no se presenta como ausencia de registros. No hay listas vacías como sustitución de errores de base. Los modelos puros de cliente, profesional y administrador reciben DTO; el nuevo resumen del cliente recibe agregados completos y conserva la navegación de las páginas.

## Evidencia local

- Paginación con 137 registros propios y 7 ajenos en cinco recursos, incluyendo fechas idénticas, filtros, detalles y cursores cruzados.
- Proyecciones de pagos por rol, permisos administrativos, profesionales suspendidos y conteos fuera de la primera página.
- Errores de base y filas inválidas producen errores explícitos con mensajes que no exponen detalles internos.
- EXPLAIN ANALYZE con RLS real sobre más de 10.000 filas sintéticas; cada ensayo se revierte por transacción.
- La migración `20260911234506_owner_read_page_indexes.sql` agrega tres índices por cliente, fecha e ID, respaldados por los planes de solicitudes, trabajos y equipos. Los planes antes/después están en `output/production-readiness/t12-explain-{baseline,indexed}.json`.

En las muestras locales, los tres planes utilizaron los nuevos índices para obtener la página ordenada y redujeron el trabajo respecto de los índices anteriores. Son mediciones locales, no un objetivo de servicio ni una prueba de carga de producción. Cada nueva ejecución conserva además una copia del plan identificada por su runId. Los índices se añaden sin cambiar datos o permisos; evaluar su ventana de creación antes de aplicarlos a una base persistente grande.

## Integración de pantallas pendiente

T27–T29 conectan los consumidores a estas consultas y completan sus flujos. Las pantallas profesionales anteriores siguen siendo demostraciones explícitas: su dependencia está identificada en `lib/mock/pro-scope.ts`, fuera de los modelos puros. Esto no las convierte en pantallas productivas ni cierra B03. Eliminar esas referencias al conectar cada pantalla; jamás usar sus datos como fallback del repositorio. Los detalles de direcciones, historial, onboarding y conciliación se completan en sus tareas de dominio.

Esta verificación local no habilita el lanzamiento ni resuelve los pendientes externos de las otras tareas.
