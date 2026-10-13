# Servicios cliente: diseño aprobado

## Aprobación y alcance

El usuario aprobó el conjunto visual con «me gusta», después de pedir mantener la línea visual de Inicio y aprobar Servicios más tres variantes del detalle. Implementar dentro de la app existente, no una maqueta independiente. No desplegar, hacer commits, alterar tablas/políticas ni operar sobre datos de producción. Conservar los cambios previos de Inicio. Rama local de trabajo: `codex/customer-services`.

## Fuentes visuales

Cuatro vistas del mismo recorrido, en orden de presentación:

1. Servicios: `C:/Users/quime/.codex/generated_images/01a113b5-c26c-7343-bd9a-4e894c9a32af/exec-45896eb1-9dab-4cb2-a016-e384d78bbf5c.png`.
2. Antes de la visita: `C:/Users/quime/.codex/generated_images/01a113b5-c26c-7343-bd9a-4e894c9a32af/exec-8bdda5fc-401e-4ff2-a183-f7b2fd0f581d.png`.
3. Visita confirmada: `C:/Users/quime/.codex/generated_images/01a113b5-c26c-7343-bd9a-4e894c9a32af/exec-44dc9b36-eed3-474b-9a45-cf5cbaef6fe7.png`.
4. Resultado pendiente: `C:/Users/quime/.codex/generated_images/01a113b5-c26c-7343-bd9a-4e894c9a32af/exec-0b44372a-d31a-4373-a94c-3cda994871ca.png`.

Las imágenes contienen datos ilustrativos. La app debe mostrar exclusivamente datos propios del cliente autenticado. Mantener el logo real y App Shell existentes, aunque el generador haya conservado una marca de casa en las referencias.

## Lenguaje visual

Canvas blanco, azul `#075cff`, texto `#0d1830`, secundario `#5d6c84`, separadores `#e1e7f0`, superficie suave `#f0f5fd`. Títulos 24–28 px, texto 14–16 px, íconos Lucide de 20–24 px y blancos táctiles de 44 px. Destacar solo la primera acción pendiente; las demás nunca desaparecen: se muestran como filas. Agrupar listas con divisores, sin tarjetas anidadas. Entrada discreta y feedback de presión, respetando movimiento reducido.

## Servicios

Ruta principal `/app/trabajos`. Filtros Todos, En curso, Programados y Finalizados. El cliente debe poder consultar registros anteriores, no solamente filtrar los últimos 25. La solicitud es la identidad estable del caso: relacionar el trabajo por `request_id`, incluso si no está en una página reciente de jobs. Presupuestos aún no aceptados, sin solicitud, tienen su propia identidad y paginación; excluir revisiones sustituidas. No sumar totales de fuentes ni duplicar un presupuesto aceptado como otro servicio.

Un servicio muestra problema/tipo, equipo cuando esté registrado, estado comprensible, fecha confirmada cuando exista y una acción contextual. Cancelaciones no son Finalizados. Presupuestos vencidos no son Listos. No presentar borradores como recuperables: la recuperación todavía no está conectada. Estados de carga, vacío, error y consulta parcial deben ser explícitos.

## Detalle adaptativo

Usar las rutas operativas de trabajo/solicitud existentes y la ruta existente de presupuestos para los casos pre-job. No enviar una solicitud sin trabajo al GET que exige job. Las vistas enfocadas pueden abrirse dentro del mismo componente; no requieren páginas adicionales.

- Antes de la visita: problema, domicilio, equipo y presupuesto real. Revisar el presupuesto abre alcance, exclusiones, total, vigencia y aceptación. Aceptar no cobra; primero se asigna y confirma un profesional.
- Visita: fecha/franja, domicilio y profesional confirmados. Mostrar Pago aprobado solo desde checkout canónico. Reprogramar es una solicitud: la fecha actual sigue vigente hasta aceptación. No inventar fechas a partir de la creación del trabajo ni anunciar que nunca hubo agenda cuando el RPC deja de devolverla en etapas posteriores.
- Resultado: diagnóstico, trabajo, resultado informado, partes/fotos disponibles y próximos cuidados cuando corresponda. Informe recibido no significa servicio completado. Revisar y confirmar abre una decisión explícita; desacuerdo requiere motivo. Después de conformidad ofrecer valoración opcional. Pendientes de repuesto o segunda visita mantienen continuidad del mismo caso.
- Otros estados reales: asignación, aceptación profesional, pago en proceso/revisión/rechazado, diagnóstico presencial, adicionales, trabajo en curso, cancelación, disputa y garantía. Conservar sus acciones existentes; no forzarlos a uno de los tres ejemplos.

El destino actual de garantías no recibe un servicio seleccionado ni permite gestionar visitas o pagos pendientes. Por eso se muestra como «Garantías y reclamos», sin prometer ayuda contextual ni agregar un `jobId` que esa pantalla ignora. El acceso aparece en servicios completados o en garantía. Un canal de ayuda contextual requiere una etapa posterior; no inventar chat, contacto o seguimiento ya integrado.

## Decisiones y navegación

Conservar Inicio · Servicios · Pedir · Hogar · Más en lista y detalle ordinario. Ocultarla temporalmente al revisar/aceptar presupuesto, pagar, reprogramar, decidir alcance/adicionales y confirmar resultado. Restaurarla al volver o desmontar el flujo. No alterar Hogar, Más, Pedir ni las pantallas profesionales/administrativas.

Bloquear nuevos comandos mientras se envía una decisión o se consulta su resultado canónico. Un error de recuperación conserva el formulario y exige volver a consultar. Cambiar de servicio debe retirar las decisiones del anterior mientras carga el nuevo. No permitir volver/Escape mientras se prepara una redirección de pago.

## Verificación

El usuario indicó expresamente «No, dejar solo las pruebas automáticas» ante la propuesta de usar Chrome. No abrir navegadores ni tomar capturas. Hacer TDD, controles de tipos, lint, pruebas de estados/acciones/propiedad/paginación y revisión independiente. Registrar comparación gráfica como bloqueada; nunca presentar estas maquetas como capturas de la implementación.
