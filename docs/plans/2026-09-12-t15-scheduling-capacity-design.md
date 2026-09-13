# T15 — Agenda, capacidad y reprogramación verificables

## Resultado operativo

La fecha y franja de una solicitud son una preferencia del cliente. Una visita pasa a estar reservada solamente cuando existe una reserva persistida para un profesional aprobado, dentro de su disponibilidad y sin solaparse con otra reserva o ausencia. La base de datos arbitra concurrencia.

## Modelo

- `jobs.scheduled_date` y `scheduled_time_window` conservan la preferencia original y no prueban capacidad.
- `job_schedule_reservations` guarda inicio y fin UTC, fecha local de visita, zona horaria, duración, margen de traslado, estado, versión y vencimiento del hold.
- La exclusión de rangos por profesional incluye el margen de traslado. Sólo `hold` y `confirmed` consumen capacidad.
- `professional_absences` bloquea intervalos puntuales. La disponibilidad semanal existente sigue siendo la fuente de horarios habituales.
- `job_reschedule_requests` conserva propuesta, motivo, actor, versión observada y aprobaciones. Aplicar una reprogramación crea una nueva versión y libera la anterior, sin alterar presupuesto, alcance ni pagos.

## Autorización

- Cliente y profesional sólo pueden leer disponibilidad sin identidad privada de terceros.
- Cliente, profesional asignado u operaciones pueden proponer una reprogramación.
- Una propuesta iniciada por cliente requiere aprobación profesional; una iniciada por profesional requiere aprobación del cliente; operaciones requiere ambas salvo que registre un motivo de emergencia y su auditoría.
- Toda mutación compara versión, estado del trabajo y actor actual en la misma transacción.

## Límites y fallos

- Duración: 30 a 480 minutos. Margen de traslado: 0 a 180 minutos.
- Consultas: rango máximo de 31 días; no se usa un `limit` arbitrario que pueda ocultar reservas.
- Los holds vencidos dejan de consumir capacidad mediante una función idempotente invocable por operación programada.
- Conflictos, versión vencida, técnico suspendido, ausencia y horario habitual inválido fallan cerrados.
- La aplicación convierte fechas locales únicamente en el borde y persiste instantes UTC junto a la fecha local explícita.

## Rollback

Se pausa la creación de reservas y reprogramaciones. Las reservas ya emitidas se conservan para operación manual auditada; no se eliminan ni se reconstruyen a partir de preferencias.
