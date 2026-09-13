# T11 — Invitación y revisión de profesionales

Continuación de la hoja de ruta aprobada. Reutiliza identidad y MFA de T06/T08, permisos/auditoría de T09, archivos inspeccionados de T10 y outbox existente. Las rutas de invitación, onboarding y aprobación todavía responden como funciones no habilitadas; la página actual usa datos de demostración y hereda un layout que exige estar aprobado.

## Límites de identidad

El enlace de invitación habilita postularse, no operar trabajos ni cobrar. La aceptación exige simultáneamente un token vigente, un correo confirmado en Auth que coincida con el destinatario y una sesión persistida activa. La identidad se toma de Auth. Nunca se acepta un `professionalId`, rol o correo de otro usuario como autoridad.

El registro específico de postulantes puede crear una identidad Auth pendiente de confirmación. No crea un perfil de cliente ni otorga el rol profesional desde metadata editable. Tras validar la invitación, una transacción de base crea/vincula el perfil profesional y fija el rol confiable; el servidor debe refrescar la sesión para usar ese rol. Una cuenta con un perfil de cliente o administrador existente no se convierte silenciosamente: el modelo actual tiene un rol por identidad. Un profesional ya vinculado sólo continúa su propia postulación.

El acceso de onboarding se implementa en un grupo de rutas separado del layout profesional aprobado. Cada lectura/escritura conserva su propia guarda específica. El resto de `/pro` y los comandos de trabajo/cobro mantienen sus verificaciones actuales. No se reutiliza la excepción de inscripción MFA como autorización de negocio.

## Secuencia

1. Operaciones/owner con MFA crea una invitación con correo, especialidad vigente y motivo. La base genera un token aleatorio, guarda su hash, vencimiento, actor y versión; escribe auditoría y evento privado de outbox en la misma transacción. La respuesta administrativa no revela el token. El estado inicial refleja que la entrega está pendiente.
2. Se permite cancelar o reemplazar una invitación bajo control de versión. Cancelación, vencimiento y consumo se comprueban al aceptar; reintentos no crean dos profesionales. El token de entrega sólo queda disponible al proceso privado que debe enviarlo. La entrega se verifica en T24/T36; crear el evento no se presenta como correo enviado.
3. El destinatario registra/inicia sesión y confirma su correo. Una vista previa o GET no consume el enlace. La aceptación explícita vincula invitación y cuenta una sola vez. La aceptación real de documentos vigentes se registra al enviar la postulación en el paso 5; D08 sigue pendiente para el entorno real.
4. El postulante guarda un borrador versionado con datos personales, experiencia, herramientas, especialidades, zonas y disponibilidad. Los archivos se suben mediante el circuito privado de cuarentena/inspección, limitado al propietario y a una postulación vigente. No se inventan documentos, matrícula ni aprobación.
5. Enviar a revisión valida campos, relaciones del catálogo y evidencia requerida. Una observación permite corregir y volver a enviar; finalizar el formulario no habilita trabajos. Los revisores ven documentación privada sólo con permiso de operaciones/owner y registran resultado, motivo y vigencia.
6. Aprobar/rechazar exige versión actual, estado permitido y revisión documental atribuible. Las transiciones escriben auditoría atómica y outbox; un fallo revierte el cambio. La suspensión reutiliza los controles T08, conserva trabajos y pagos y elimina autoridad operativa inmediatamente.

## Pruebas y cierre

Primero demostrar las rutas pendientes y los fallos de acceso en integración. Cubrir invitación válida, vencida, cancelada, reutilizada, correo distinto, cuenta de rol incompatible, sesión revocada, datos/documentos incompletos, autoaprobación, edición concurrente y reversión por fallo de auditoría. Probar que el postulante puede corregir únicamente su expediente y no operar como aprobado.

El recorrido de navegador debe persistir borrador, envío, revisión y estado al recargar. Ejecutar los controles de regresión, protocolo T03 fresh/upgrade con datos existentes, tipos generados y build aislado. Registrar por separado las decisiones documentales D08 y la entrega externa T24/T36; no imputar esa aceptación a pruebas locales.
