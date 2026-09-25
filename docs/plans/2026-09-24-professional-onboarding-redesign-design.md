# Rediseño del alta profesional

El administrador crea una convocatoria con nombre, apellido, correo y especialidad. La invitación se envía inmediatamente; un fallo de entrega queda visible y se puede reintentar desde el expediente, sin crear otra convocatoria. La pantalla de alta no contiene listados ni motivos de convocatoria.

El directorio reúne perfiles existentes e invitaciones aún no aceptadas. Cada fila muestra identidad, especialidad, estado, avance y acceso al expediente. Una invitación sin perfil sigue siendo un registro visible. El expediente muestra los datos disponibles, los requisitos pendientes y los trabajos vinculados cuando existan.

El enlace único abre la creación de contraseña (8 a 12 caracteres) sin pantalla intermedia de inicio de sesión. Al establecerla se acepta la invitación, se inicia la sesión y se continúa con un recorrido persistente: datos personales y domicilio, actividad y disponibilidad, documentación y foto, declaración y revisión, Mercado Pago. Cada paso guarda sus datos antes de avanzar. El inicio de sesión posterior retoma el avance. Si no se creó contraseña, administración debe reenviar la invitación. Tras Mercado Pago, se abre el panel profesional; la habilitación para recibir trabajos sigue sujeta a revisión documental.

La aceptación debe ser resistente a reintentos, no debe permitir apropiarse de una cuenta existente y nunca debe confiar en metadatos editables para autorizar roles. El token no aparece en listados ni registros. La API y la base validan entradas y permisos; el envío solo se considera exitoso cuando lo acepta Resend.

La interfaz reutiliza los componentes del sistema: jerarquía de expediente de oficio (convocatoria, documentación, cobertura, disponibilidad, cobros), el azul existente para acciones y estados claros. El progreso y el siguiente paso concreto son la señal distintiva, evitando un formulario único interminable.
