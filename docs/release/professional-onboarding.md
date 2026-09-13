# T11 — Alta y habilitación de profesionales

Implementación verificada localmente. La hoja de ruta conserva las 40 tareas y la salida de producción sigue bloqueada por sus puertas de aceptación.

## Operación

1. Desde **Administración → Profesionales → Invitaciones**, operaciones/owner con MFA registra correo, especialidad activa y motivo. La invitación comienza **en cola de entrega**. No se muestra el token al operador ni se afirma que el correo fue enviado.
2. El destinatario abre el enlace, registra o ingresa a su cuenta y confirma su correo. El GET no consume la invitación. **Aceptar invitación** exige correo verificado coincidente, token vigente, sesión activa y ausencia de un rol incompatible. Un perfil de cliente o administrador existente no se convierte.
3. En `/pro/onboarding`, el profesional guarda datos personales, experiencia, herramientas, especialidades, zonas y disponibilidad. Esa superficie está separada del layout operativo aprobado. La sesión puede renovarse conservando las cookies y las cabeceras privadas.
4. Adjunta los documentos exigidos por la política de cada especialidad mediante cuarentena, inspección y almacenamiento privado T10. Enviar requiere documentos inspeccionados, campos completos y aceptación explícita de versiones legales vigentes. Guardar un borrador no habilita trabajos.
5. Operaciones abre el expediente real, consulta enlaces documentales de 60 segundos y registra revisión, motivo y fecha de vencimiento cuando corresponda. Cada documento conserva responsable y fecha. Sólo pueden revisarse los documentos incluidos en el envío actual.
6. El operador aprueba o solicita correcciones con un motivo. Se comprueban versión, estado y política actual; los documentos necesarios deben estar aprobados y vigentes. Ante correcciones, el postulante edita y vuelve a enviar. La resolución conserva su motivo visible para el postulante.
7. La suspensión usa el circuito T08, con auditoría y alertas sobre trabajos activos. Conserva trabajos, pagos y antecedentes. La habilitación se comprueba en cada acceso operativo, asignación y autorización de archivos de trabajos; un vencimiento documental retira esa autoridad aunque el estado histórico sea «aprobado».

Las listas de profesionales e invitaciones tienen paginación por cursor. Los cambios versionados rechazan escrituras sobre una versión anterior. Un fallo de auditoría revierte la aprobación en la misma transacción.

## Configuración y límites

- **D08 / T36:** el responsable debe aprobar requisitos reales por especialidad y documentos legales. No se insertan políticas documentales de producción ni matrículas, seguros o consentimientos inventados. Las pruebas utilizan políticas explícitamente `test_only`, aceptadas por el servidor sólo en un entorno de prueba local.
- **T24:** entregar la invitación desde el outbox, conciliar el resultado con el proveedor y probar sandbox. El worker deberá revisar estado/vencimiento antes de enviar y omitir invitaciones canceladas; un evento persistido no acredita entrega. La confirmación de registro Auth sí se ensaya con correo local real.
- **T36:** inventariar profesionales aprobados previamente por infraestructura sin invitación. La compatibilidad mantiene esas aprobaciones históricas; no acredita que hayan pasado la revisión documental nueva.
- **T28 / operación posterior:** un aprobado con documentación vencida puede consultar su expediente, pero no sustituir evidencia aprobada por su cuenta. El circuito de renovación/reactivación deberá definirse y verificarse antes de habilitarlo; la suspensión no permite reactivación automática.
- Las notificaciones de revisión se registran en outbox. Su entrega y recepción operativa se cierran con T24. La aceptación real del entorno y la revisión humana no se deducen de los ensayos sintéticos.

## Límites técnicos

El hash de invitación permanece en una tabla sin lectura de esa columna para usuarios. El token de entrega está limitado al outbox privado. La validación previa de registro sólo devuelve si coinciden token y correo: el wrapper público es `security invoker`, y el único helper anónimo vive en el esquema no expuesto `invitation_gateway`. `anon` conserva el bloqueo de acceso al esquema `private` y a sus tablas.

Registro y confirmación sólo preparan una identidad Auth. La metadata editable se usa como destino de navegación; la transacción de aceptación valida la invitación antes de crear el perfil y asignar el rol confiable. El servidor refresca el JWT después del cambio.

Las escrituras directas de estado profesional, revisión documental y relaciones del formulario están revocadas para clientes. Los RPC derivan identidad, permisos y revisor de la sesión vigente, con locks y auditoría. Los snapshots privados conservan formulario, requisitos, documentos y aceptación legal de cada envío.

## Evidencia

`professional-onboarding-verification.json` reúne los controles finales y distingue pruebas locales de aceptación externa. El protocolo T03 compara instalación limpia y actualización desde T09, con datos preexistentes, permisos, historial y los esquemas `public`, `private` e `invitation_gateway`. No se alteran historiales remotos ni se resetea la base original.
