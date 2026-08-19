# Diseño: acceso móvil funcional

## Objetivo

El visitante debe llegar primero al ingreso, autenticarse con Supabase y entrar al panel correspondiente a su rol. En celular, el acceso debe ser compacto, claro y sin contenido vacío.

## Problemas confirmados

- El CTA móvil `Solicitar` apunta a `/registro` mientras `Ingresar` está oculto.
- Los CTA públicos principales también apuntan directamente al registro.
- El botón `Ingresar` no ejecuta ninguna acción.
- La tarjeta secundaria combina texto blanco con un fondo blanco impuesto por el componente `Card`, por lo que parece vacía.
- Dos tarjetas apiladas generan una página innecesariamente larga en teléfonos.

## Flujo aprobado

1. Los CTA públicos de entrada llevan a `/login`.
2. El formulario valida email y contraseña.
3. Supabase Auth autentica al usuario y establece la sesión mediante cookies seguras.
4. El perfil confiable de base de datos determina el destino:
   - cliente → `/app`;
   - técnico aprobado → `/pro/dashboard`;
   - administrador → `/admin/dashboard`.
5. Los errores se muestran junto al formulario, sin borrar el email.
6. Durante el envío, el botón muestra progreso y bloquea envíos repetidos.
7. `Crear cuenta cliente` lleva a `/registro`.

## Diseño responsive

- Mobile-first, una sola columna y un único formulario protagonista.
- Encabezado compacto con un CTA `Ingresar` visible.
- Controles de al menos 48 px para uso táctil.
- La explicación de roles se muestra sólo en escritorio; en móvil se reemplaza por una línea breve de confianza.
- Sin alturas mínimas artificiales, tarjetas vacías ni desplazamiento adicional.
- Se conserva la identidad azul, blanca y azul tinta de Lysto, con verde sólo para estados de confianza.

## Estados y accesibilidad

- Campos con `name`, `type`, `required`, `autocomplete` y etiquetas asociadas.
- Mensajes de validación y autenticación con región anunciable.
- Foco visible y navegación completa por teclado.
- Estados inicial, enviando, credenciales inválidas y error inesperado.

## Verificación

- Pruebas unitarias para validación, autenticación, rol y redirección.
- Prueba de contrato para los enlaces públicos login/registro.
- Prueba visual y funcional en anchos de teléfono y escritorio.
- Build de producción y nuevo despliegue en Vercel.
