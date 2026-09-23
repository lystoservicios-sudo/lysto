# T11 — Alta y habilitación de profesionales

Implementación verificada localmente y en staging. La hoja de ruta conserva las 40 tareas y la salida de producción sigue bloqueada por sus puertas de aceptación.

## Verificación de staging — 2026-09-23

La versión `dpl_9k6zwABQq8s5xhLtGtuXj9LBsmEc` está publicada en [la vista previa protegida](https://lysto-staging-preview.vercel.app) contra Supabase staging `obksyzasmfwcbbksesqt`. Pasaron 48/48 recorridos de Playwright en Chromium escritorio, Chromium móvil y WebKit móvil; las cuentas sintéticas se limpiaron sin fallos. También pasaron lint, tipos, 174 pruebas de dominio y 680 pruebas Vitest. No se utilizó Docker ni se modificó producción.

La ampliación E2E comprueba que Operaciones crea un enlace de invitación que se muestra sólo una vez, desaparece de la lista al recargar y no permite transformar una cuenta de cliente con otro correo. Una ejecución anterior detectó de forma intermitente dos respuestas 400 de Next.js al iniciar sesión en WebKit móvil (`Invalid URL`, entrada `null`); la repetición completa pasó sin ese fallo. Se conserva como observación de estabilidad para seguimiento, no como aceptación de correo ni de Mercado Pago.

La regresión de clientes descubrió y corrigió que staging ocultaba el formulario porque sus enlaces legales oficiales están en `lystohogar.com`, mientras la aplicación de prueba usa otro origen. La excepción quedó limitada a esas dos rutas exactas sólo en staging; producción mantiene la validación de origen propio. El formulario y consentimiento ya se verificaron en el navegador. El alta por correo *no* quedó aprobada de extremo a extremo: Supabase rechazó la dirección ficticia `.test` y luego aplicó `over_email_send_rate_limit` (429) a un intento con `example.com`; no se creó usuario ni se acreditó recepción del mensaje. El error técnico queda registrado por código y estado, sin correo ni texto del proveedor.

Los ensayos E2E incluyen rechazo de invitación por visitante anónimo y por cliente con otro correo, pero no sustituyen la recepción del correo, la aceptación de un enlace real, la revisión de documentos por Operaciones ni el OAuth de un vendedor de prueba. Esos casos siguen pendientes de aceptación externa.

## Ampliación: invitación, foto, cobros y trabajos nuevos (2026-09-22)

Esta ampliación está implementada en una rama aislada. El 2026-09-22 se aplicaron y registraron sus tres migraciones en Supabase staging `obksyzasmfwcbbksesqt`, además de la migración de registro de clientes, tras un ensayo transaccional con rollback. Pasaron 17 comprobaciones SQL nuevas, 20 de onboarding existente, 16 de asignación y 16 de registro de clientes después del commit, sin conservar fixtures. La interfaz se publicó como vista previa Vercel y el build remoto quedó READY; la versión vigente se identifica arriba. No se utilizó Docker ni se modificó producción. La aceptación real de Mercado Pago sigue pendiente.

1. Operaciones/owner con MFA crea la invitación individual por correo. En esa respuesta puede copiar el enlace; al actualizar, el enlace desaparece del panel y la lista no devuelve el token. El correo y el enlace son dos vías de entrega del mismo token, con el mismo vencimiento y consumo único.
2. En **Administración → Profesionales → Requisitos**, Operaciones crea un borrador versionado por especialidad. Puede exigir DNI como imagen única o frente y dorso, matrícula, seguro o constancia fiscal, además de vigencia, herramientas, experiencia y número de matrícula. Antes de activar ve cuántos aprobados serán afectados y documenta el motivo. No hay requisitos de producción precargados: el titular de la operación debe aprobarlos expresamente.
3. El postulante guarda nombre, DNI/CUIL, matrícula si la política lo exige, zonas, herramientas y horarios; adjunta los documentos exactos de la política vigente. El DNI y la matrícula siguen privados. La foto pública se carga por separado: se inspecciona en cuarentena, se reprocesa sin metadatos y se vincula al perfil. Nunca usar una foto del DNI como avatar.
4. El postulante puede vincular Mercado Pago desde el onboarding, aun antes de la aprobación documental. Lysto no recibe su contraseña. Si el entorno carece de credenciales de split, la pantalla informa que los cobros esperan configuración de Lysto.
5. **Aprobado** significa decisión documental humana. **Listo para trabajos nuevos** requiere además documentación vigente, foto canónica y vendedor Mercado Pago habilitado. La selección de candidatos y toda asignación nueva fallan cerradas cuando falta alguno. Desvincular Mercado Pago no borra trabajos ni expediente ya existentes; cualquier cobro posterior sigue sujeto a la protección financiera del checkout.

### Operación y soporte

- Invitación vencida/cancelada/consumida: crear una invitación nueva al correo correcto; no reenviar el token anterior. El estado de entrega del correo no prueba recepción. No registrar enlaces completos en tickets o telemetría.
- Documento observado: dejar motivo concreto y fecha de vencimiento cuando corresponda; el postulante corrige y vuelve a enviar. Una política nueva conserva el envío histórico, pero invalida la habilitación documental anterior cuando sus requisitos difieren.
- Foto ausente o incorrecta: el profesional puede reemplazarla desde el expediente. Sólo la foto reprocesada y registrada por el servidor cuenta como requisito cumplido.
- Fallo de limpieza de foto: la aplicación reintenta retirar objetos reemplazados o de cuarentena y registra `professional_avatar.cleanup_failed` si Storage continúa fallando. Operaciones debe revisar objetos huérfanos del bucket `public-avatars` y de `upload-quarantine` en un entorno autorizado antes de borrarlos; nunca eliminar una ruta que figure en `private.professional_avatars`.
- Mercado Pago desconectado: no crear nuevas ofertas. Revisar pagos activos antes de intentar desvincular o reemplazar la cuenta. Operaciones coordina los trabajos ya asumidos; no se revoca su acceso operativo sólo por la desconexión.
- Profesionales aprobados antes del circuito de invitación: inventariarlos y revisar manualmente documentación, foto y conexión de cobros antes de activar las nuevas reglas en producción. La compatibilidad documental legada no equivale a una nueva revisión humana.

## Operación

1. Desde **Administración → Profesionales → Invitaciones**, operaciones/owner con MFA registra correo, especialidad activa y motivo. La invitación comienza **en cola de entrega**. El enlace se muestra una sola vez en la respuesta de creación para copiarlo; no reaparece en la lista ni se afirma que el correo fue enviado.
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
