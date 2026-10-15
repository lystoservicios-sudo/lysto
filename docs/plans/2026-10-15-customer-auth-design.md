# Acceso cliente: diseño aprobado

Referencia: tercera imagen mostrada en el chat, `exec-85b1e4e1-c2fb-48a1-ac93-acfa0f17fa2a.png`.

## Alcance

Login, registro, revisar/confirmar correo, recuperar/restablecer contraseña y completar los datos existentes. No cambiar proveedores, credenciales, permisos, política de contraseñas, redirecciones seguras, controles de origen, límites ni reglas del negocio. Sin publicación automática en producción en esta etapa.

## Sistema visual

Cabecera azul hielo con marca y el ambiente semirrealista que ya usa Lysto; cuerpo blanco sin navegación de marketing ni navegación inferior autenticada. Inter, títulos de 26 px, controles de al menos 48 px, radios de 10–12 px, cuadrícula de 4 px, azul #075cff, tinta #0d1830, secundario #5d6c84. Reutilizar la imagen existente, no generar una ilustración diferente. Escritorio conserva cabecera horizontal y formulario legible de ancho limitado.

El cliente quiere entrar para pedir o seguir un servicio; la identidad visual conecta hogar, ambientes, climatización, visitas y cuidado. Blancos de paredes, madera, azul del aire/cielo, verde de plantas y tinta de controles aparecen en el recurso aprobado. La firma es el mismo ambiente con el aire instalado. Sustituir el hero comercial, los formularios interminables y las animaciones decorativas por cabecera compacta, registro progresivo y movimiento que comunica cambios de estado.

## Interacción

Registro: Tus datos (nombre, apellido, teléfono) → Tu acceso (email, contraseña, repetición y documentos vigentes). Mantener valores al avanzar/volver; validar el paso actual antes de continuar; no enviar al servidor hasta confirmar el segundo paso. No persistir contraseñas en almacenamiento. Completar cuenta sigue siendo un formulario corto de datos faltantes. Éxito comunica revisar correo sin revelar la existencia de cuentas.

Login permite mostrar contraseña y conserva el destino seguro. Recuperación y reenvío mantienen respuestas genéricas. Confirmación conserva POST explícito, CSRF, cookies, no-store y CSP restrictiva. Fallos muestran una acción útil, no simulan éxito.

Transiciones de aproximadamente 180–220 ms, botones con feedback, foco visible y movimiento reducido. Al enfocar un campo en móvil se compacta la cabecera y queda disponible el desplazamiento natural para el teclado.

## Verificación

Pruebas de progresión y vuelta, datos conservados, validación, consentimiento, contraseñas, error/éxito, destinos y contratos actuales. Tipos, lint y build. Revisión en navegador integrado si está disponible; nunca abrir navegadores personales ni Docker. Si se bloquea la comprobación visual, documentar el límite y no declararla aprobada.
