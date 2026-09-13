# T25 — Historial y mantenimiento

## Resultado implementado

Cada cierre con recomendación crea o actualiza un plan ligado al registro técnico, trabajo, equipo y cliente. La fecha se deriva de la regla del servidor y no del navegador. `none` no crea plan. El informe final y el registro de servicio siguen siendo hechos históricos: editar o archivar la ficha del equipo no los reescribe.

Los recordatorios viven en una tabla privada con clave de deduplicación, canal, intentos y estado de entrega. Reprogramar cancela el recordatorio pendiente anterior antes de crear el nuevo. Las preferencias separan email, avisos internos y recordatorios comerciales; estos últimos permanecen desactivados mientras D12 siga pendiente.

Un reclamo activo de calidad o garantía suprime el plan y cancela el aviso pendiente. Al resolverlo, el plan vuelve a estar disponible. Archivar un equipo cancela el plan. La pantalla del cliente consulta datos reales y muestra el historial anexado.

Cambiar la fecha sólo modifica la recomendación. Iniciar mantenimiento exige confirmar una dirección vigente y crea una solicitud en borrador ligada al equipo; no reserva capacidad ni crea un pago.

## Verificación pendiente

Dominio, UI focalizada, tipado y lint pasan localmente. La integración `maintenance-history.test.ts` y pgTAP `maintenance_reminders.test.sql` esperan el entorno Supabase desechable, actualmente bloqueado por Docker. El envío comercial automatizado queda sujeto a D12 y a una ejecución real posterior del worker.
