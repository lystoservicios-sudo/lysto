# Recuperación de contraseña de clientes: regla 6–12

## Objetivo

Aplicar en la recuperación de contraseña de clientes la misma regla vigente en el registro: mínimo 6 y máximo 12 caracteres.

## Alcance

- Actualizar los límites visibles de ambos campos de nueva contraseña.
- Actualizar el texto de ayuda y el mensaje de validación del servidor.
- Compartir la regla de validación de clientes para evitar que registro y recuperación vuelvan a divergir.
- Agregar pruebas para aceptar exactamente 6 y 12 caracteres, y rechazar 5, 13 y contraseñas que no coinciden.

## Fuera de alcance

- Contraseñas de profesionales y administradores.
- Cambios en el envío o la vigencia del correo de recuperación.
- Cambios en las sesiones existentes.

## Verificación

La prueba de regresión debe fallar con la regla actual de 12–128, pasar después del cambio y acompañarse con las pruebas completas de autenticación, revisión de tipos y compilación de producción.
