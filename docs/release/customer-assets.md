# T13 — Activos persistentes del cliente

Implementación local en verificación. No habilita producción ni modifica decisiones comerciales D01–D12.

## Comportamiento

- `/app/perfil` carga la identidad propia y guarda nombre, apellido, teléfono y preferencia de notificaciones. El correo es de sólo lectura en este formulario. Un conflicto conserva la edición; recargar es una acción explícita.
- El cambio de correo usa Supabase Auth y confirmación en ambos buzones. Los GET del enlace no consumen el token; la confirmación requiere POST del mismo origen. Un trigger sincroniza `profiles.email` sólo cuando Auth cambia el correo confirmado. No se modifica el rol ni metadata del usuario.
- `/app/direcciones` permite alta, edición, selección de principal y archivado. El asistente empieza sin una dirección de ejemplo y permite copiar una dirección propia guardada, incluidos sus accesos.
- Cada mutación exige versión y propiedad; las operaciones de un mismo cliente se serializan. Una dirección usada por una solicitud o equipo se conserva y una edición crea otra fila. La ubicación y los accesos de un presupuesto aceptado siguen protegidos incluso frente a escrituras privilegiadas.
- `/app/equipos` registra tipo, nombre y dirección opcional; marca, modelo, serie y capacidad son opcionales. El backend acepta vínculos a solicitudes/trabajos propios y rechaza relaciones ajenas o una solicitud ya vinculada a otro equipo.
- Equipos archivados siguen disponibles en `/app/equipos/archivo`; el detalle presenta intervenciones persistentes, paginadas, sin notas privadas del técnico. No se crean garantías ni mantenimientos ficticios.
- Las fotos usan intenciones privadas, hash, inspección y normalización de T10. `equipment_media` sólo recibe evidencia finalizada. El cliente dueño, el profesional aprobado asignado y operaciones/calidad autorizados pueden leer según su acceso actual; las URLs duran 60 segundos. Archivar conserva la evidencia e impide nuevas subidas.

## Límites y recuperación

El guardado de una preferencia de notificaciones no activa envíos. SMTP del entorno real, documentos legales y retención requieren sus decisiones y tareas correspondientes. El circuito Auth real debe conservar `double_confirm_changes = true`, la plantilla `email_change` y el redirect de la aplicación. Esta configuración fue ensayada sólo en el proyecto desechable local.

No revertir con borrados de tablas, equipos ni fotos. Para una contingencia, desactivar la interfaz de escritura conservando las relaciones, los controles SQL y las lecturas históricas. La limpieza de archivos usa el flujo de T10; su ejecución programada y retención siguen en T24/T36/D08.

## Migraciones

1. `20260912005741_customer_assets_workflows.sql`: versiones, archivado, único principal y escritura por RPC.
2. `20260912011452_customer_asset_identity_and_evidence.sql`: compatibilidad con `office` y sincronización del correo confirmado.
3. `20260912011853_verified_equipment_photos.sql`: evidencia verificada de equipos, RLS y finalizador interno bajo la sesión de T08.
4. `20260912012604_preserve_quoted_address_archival.sql`: permite campos administrativos de archivado/versión sin alterar la ubicación aceptada.
5. `20260912013847_equipment_request_location_binding.sql`: toma la ubicación del servicio al vincular un equipo y rechaza ubicaciones incompatibles.

Las correcciones se agregaron en migraciones nuevas. No se reescribieron las anteriores después de aplicarlas al entorno de prueba.

## Evidencia

El registro consolidado `customer-assets-verification.json` se completa al finalizar las comprobaciones. Incluye pruebas HTTP/Auth/Storage reales, navegador, errores de red y concurrencia; instalación desde cero y actualización con datos testigo; tipos, lint y build aislado. Los tokens, códigos de correo y URLs privadas no se incluyen en el registro de aceptación.

La API de actualización de identidad y los tipos de confirmación fueron contrastados con la documentación oficial de [updateUser](https://supabase.com/docs/reference/javascript/auth-updateuser) y [verifyOtp](https://supabase.com/docs/reference/javascript/auth-verifyotp). La prueba local verifica el comportamiento de la versión instalada.
