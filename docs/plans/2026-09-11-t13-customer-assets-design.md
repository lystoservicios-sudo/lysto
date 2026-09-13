# T13 — Persistencia de activos del cliente

Implementación de la tarea T13 del plan de 40 tareas ya autorizado. Mantiene identidad por sesión, RLS y las políticas de evidencia de T10; no cambia el alcance comercial pendiente de D01–D12.

## Contratos

- Perfil: lectura propia, edición de nombre/apellido/teléfono y preferencia de avisos. El correo se muestra como identidad confirmada de Auth; solicitar otro correo inicia la doble confirmación del proveedor, nunca un UPDATE libre de `profiles.email`. No se aceptan rol, permisos ni dueño en el body.
- Direcciones: lista paginada, alta, edición, selección predeterminada y archivado. Las mutaciones se serializan por cliente y usan versión esperada. Una dirección usada por un servicio se conserva; editarla crea una nueva versión de dirección y archiva la anterior. Los presupuestos conservan sus snapshots de dirección y costos.
- Equipos: alta y archivado propios, con marca/modelo/serie opcionales y relación validada con dirección/solicitud/trabajo. Las fotos siguen el circuito de evidencia privada verificada; un contador o URL arbitrarios no son evidencia. No se exponen ni editan notas privadas del técnico desde el perfil del cliente.
- Conflictos: versión antigua devuelve 409; recurso ajeno y recurso inexistente dan la misma respuesta. La UI sólo muestra éxito tras respuesta persistida y vuelve a leer el estado canónico.

## Persistencia y autorización

Agregar versión y archivado sin borrar historia. Las funciones expuestas son wrappers invoker de funciones privadas con identidad derivada de la sesión, parámetros validados, ownership y bloqueos dentro de la transacción. Revocar DML directo que permitiría saltarse versionado, archivado o separación de campos. Los SELECT conservan RLS y proyecciones explícitas.

Las actualizaciones de correo confirmadas por Auth sincronizan el campo informativo de perfil y avanzan su versión. La plantilla de cambio de correo apunta a una página de confirmación sin efectos por GET. El titular debe trasladar la configuración local al entorno real en T36.

## Interfaz y validación

Conectar `/app/perfil`, `/app/direcciones` y el registro de equipos a los servicios nuevos. El asistente carga direcciones reales y permite seleccionar una o completar una nueva, sin domicilio de demostración. Mantener errores, estados vacíos, datos sin guardar y reintentos accesibles.

Probar con usuarios reales: guardar/recargar; acceso horizontal; campos privilegiados; versiones simultáneas; direcciones históricas; archivado; equipos ajenos; evidencia; cambio de correo sin confirmación y después de confirmaciones reales. Cerrar con unitarias, integración completa, pgTAP, migración desde base previa/vacía, tipos, lint y build aislado. La aceptación externa no se sustituye por resultados locales.
