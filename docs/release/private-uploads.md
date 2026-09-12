# T10 — Archivos privados y verificados

Implementación local comprobada con archivos y almacenamiento reales del entorno descartable. La política de retención D08 y la ejecución programada T24/T36 siguen pendientes. No habilita producción ni servicios externos.

La API obtiene la identidad desde la sesión y solicita a la base un intento con UUID, destino autorizado, tamaño, tipo y SHA-256 esperados. Una foto previa a la solicitud queda vinculada a un borrador persistente del cliente. Ninguna ruta acepta un propietario, nombre de objeto o ubicación enviados por el navegador.

El navegador recibe una autorización de subida inmutable a `upload-quarantine`. El propietario tampoco puede leer ese original. Antes de finalizar, el servidor comprueba la firma binaria, el tipo real, el tamaño y el hash; Sharp 0.35.4 decodifica una sola imagen de hasta 20 millones de píxeles, con plazo de procesamiento de 10 segundos. Produce una copia WebP o JPEG sin metadata. Se aceptan JPEG, PNG y WebP; PDF y video permanecen bloqueados hasta disponer de inspección adecuada.

La base vuelve a comprobar identidad vigente, propiedad, asignación profesional, suspensión y vencimiento antes de vincular el resultado. Dos finalizaciones iguales conservan el mismo adjunto; datos diferentes no sustituyen la evidencia. El cliente anuncia éxito únicamente después de ese acuse. Los reintentos conservan el intento y una respuesta de vencimiento permite generar uno nuevo.

Las lecturas requieren un adjunto verificado y permisos vigentes. Las URL de descarga vencen a los 60 segundos y usan un nombre generado. Una URL ya emitida conserva su validez durante ese plazo; la suspensión bloquea nuevas emisiones. Los accesos de clientes, profesionales asignados y administración se comprueban separadamente. Finanzas no obtiene acceso general a fotos. Las políticas anteriores de subida directa privada y el finalizador sin inspección quedan cerrados.

La migración `20260911231948_server_only_attachment_read_signatures.sql` elimina la firma directa de lecturas desde el navegador: Storage no permite limitar la duración mediante RLS. La API comprueba el permiso con la sesión del usuario antes de firmar con el cliente del servidor y un vencimiento fijo. Una prueba HTTP reproduce y bloquea el intento de solicitar directamente un enlace de un año.

## Contrato de base

- `create_upload_intent`: kind, MIME, tamaño, SHA-256, entityId, draftId, phase y documentType; actor derivado de Auth.
- `get_upload_intent`: propietario del intento pendiente o lector autorizado de evidencia verificada.
- `finalize_verified_upload`: sólo servidor; recibe identidad verificada e inspección, revalida y vincula en una transacción.
- `private.attach_verified_draft`: helper interno para la futura transacción de creación de solicitudes; exige el mismo cliente y sólo archivos verificados.
- `claim_expired_upload_intents` y `complete_upload_cleanup`: arrendamiento de trabajo y acuse después del borrado real.

Las firmas de subida del proveedor duran dos horas. El intento vence a los 15 minutos, y la limpieza espera tres horas desde su creación. El trabajador procesa únicamente intentos vencidos, sin adjuntos verificados ni vínculos de evidencia. Una falla de almacenamiento deja el trabajo sin confirmar para recuperarlo después del vencimiento del arrendamiento. La evidencia verificada, incluidos originales privados conservados, se mantiene hasta definir y aplicar la política de retención; no se elimina por este trabajador.

Ensayo local de limpieza:

```powershell
node --experimental-strip-types scripts/cleanup-upload-orphans.mjs --local-workdir E:/Proyectos/GitHub/Lysto-production-db-check --apply
```

El script valida la identidad descartable. La ejecución programada en producción corresponde a T24/T36.

## Integraciones posteriores

T14 conserva los identificadores de las fotos verificadas seleccionadas dentro del presupuesto, los hereda en sus revisiones y los vincula atómicamente al aceptar la solicitud mediante `private.attach_quote_uploads`. Se comprueban cliente, borrador, objeto y estado; no se adjuntan archivos deseleccionados ni pendientes. T11 incorpora rutas limitadas para documentos de onboarding; la API general mantiene el requisito T06 de profesional habilitado. T12/T19/T20 reemplazan las fichas profesionales demostrativas por trabajos reales y enlazan estos adjuntos con el informe. Las fotos seleccionadas en la ficha demostrativa no habilitan una subida contra un trabajo ficticio.

La suite antigua de Storage que admitía firmas privadas y finalización sin inspección se sustituye por pruebas del cierre de esos contratos y del ciclo de intentos. Se conservan pruebas de avatares, identidad, rutas, permisos, aislamiento y prohibición de escritura arbitraria. Las pruebas HTTP ejercitan bytes reales; los fixtures SQL sólo representan el acuse confiable de una inspección.

Referencias: [autorizaciones de subida de Supabase](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl), [límites de entrada de Sharp](https://sharp.pixelplumbing.com/api-constructor/).
