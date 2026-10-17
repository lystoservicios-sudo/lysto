# Sistema visual de correos Lysto

## Objetivo

Convertir todos los correos de Lysto en una familia visual reconocible, accesible y específica para el propósito de cada mensaje, sin cambiar sus reglas de destinatario ni de entrega.

## Dirección elegida

La línea base es cálida, residencial y profesional. Usa el logo oficial de Lysto, fondos marfil, azul de marca, verde suave, tipografía compatible con clientes de correo y espacios amplios. Los datos críticos siguen siendo fáciles de escanear.

## Familias

- **Visitas y hogar:** escena de servicio en el hogar; fechas, horarios, profesional y dirección dominan la jerarquía.
- **Solicitudes y presupuestos:** ilustración de planificación; énfasis en revisar alcance, vigencia y próximos pasos.
- **Pagos:** ilustración de comprobante seguro; estado e importes se presentan con semántica verde, ámbar o roja.
- **Seguridad y acceso:** ilustración sobria de hogar protegido; enlaces de confirmación, recuperación y cambio de correo.
- **Soporte:** ilustración de acompañamiento; seguimiento y cobertura sin prometer resolución.
- **Profesionales:** ilustración de incorporación técnica; credenciales, acceso y pasos del onboarding.

## Componentes compartidos

- Logo oficial horizontal con fondo transparente.
- Preheader oculto, encabezado de marca, etiqueta de categoría, título y texto de contexto.
- Ilustración de familia opcional.
- Panel de datos cuando el mensaje tiene información estructurada.
- Una llamada a la acción principal y hasta dos acciones secundarias.
- Nota contextual y pie que explica por qué se recibió el correo.
- Versión de texto plano equivalente.

## Restricciones

- HTML compatible con email: tablas de presentación, estilos inline, ancho máximo de 640 px y degradación segura.
- Las imágenes son decorativas; el contenido completo debe entenderse si no cargan.
- No se incluyen datos de contacto directo del profesional ni secretos fuera del correo de invitación autorizado.
- Los enlaces se construyen exclusivamente desde el origen validado de la aplicación.
- Supabase Auth usa la misma identidad visual mediante `SiteURL`.

## Verificación

- Pruebas unitarias para marca, familia visual, enlaces y escaping.
- Render visual de todas las plantillas representativas en 390 px y 720 px, claro y oscuro.
- Validación de texto plano y ausencia de overflow horizontal.

