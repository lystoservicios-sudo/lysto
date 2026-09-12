# Operación diaria

## Responsabilidades y permisos

| Área | Permiso | Trabajo diario | Escalamiento |
| --- | --- | --- | --- |
| Operaciones | `operations` | solicitudes, asignaciones, trabajos, profesionales, clientes, equipos, catálogo y entregas | responsable de turno; dirección si el SLA vence |
| Finanzas | `finance` | cobros, conciliación, devoluciones y excepciones | titular financiero; proveedor ante estado incierto |
| Calidad | `quality` | reclamos, garantías, evidencia y resolución pública | responsable de calidad; seguridad física de inmediato |
| Titular | `owner` | permisos, configuración sensible y auditoría | segundo titular designado |

Cada persona usa su cuenta y MFA. No se comparten sesiones ni se resuelven casos ordinarios con SQL. La auditoría debe conservar actor, acción, entidad y momento.

## Apertura de turno

1. Confirmar `/api/health/ready`, estado del worker de notificaciones y alertas abiertas.
2. Abrir la cola operativa y priorizar SLA vencido, riesgo físico, pago incierto y visita del día.
3. Verificar que cada caso activo tenga responsable y próximo paso. Registrar el suplente del turno.
4. Finanzas revisa pagos en análisis y devoluciones pendientes; calidad revisa reclamos críticos y garantías.
5. No aceptar nuevas solicitudes o checkouts si el interruptor correspondiente está apagado.

## Trabajo de la cola

La cola muestra tipo, antigüedad, prioridad, vencimiento, estado, responsable y próximo paso. El responsable abre la entidad, ejecuta la acción autorizada y deja la transición persistida. Un caso que no avanza antes del vencimiento escala al responsable de turno. Riesgo físico se atiende de inmediato y detiene la visita si corresponde.

Para pagos inciertos, no repetir cobros. Consultar el ledger canónico y la conciliación. Para reclamos y garantías, usar la línea de tiempo del caso, guardar evidencia privada y publicar sólo la resolución destinada al cliente.

## Entrega de turno

El operador saliente revisa todos los casos propios abiertos y registra próximo paso, vencimiento y responsable entrante. El operador entrante confirma que puede abrir cada caso. Finanzas informa conciliaciones y devoluciones inconclusas; calidad informa reclamos críticos. Las fallas de comunicación quedan visibles y se reintentan mediante el outbox.

## Cierre de turno

1. Confirmar que no haya elementos sin responsable ni casos críticos sin escalar.
2. Registrar incidentes, pagos inciertos, reclamos críticos y notificaciones en dead letter.
3. Comparar el total operativo con los módulos de solicitudes, trabajos y soporte; investigar diferencias.
4. Entregar al siguiente turno o al suplente. Si no existe receptor, escalar antes de cerrar.

## Ejercicio de aceptación

Con datos sintéticos, operador A toma una solicitud y deja el próximo paso; operador B la retoma; finanzas concilia una excepción; calidad asigna y resuelve un reclamo. Cada participante debe comprobar que no ve herramientas ajenas, que la auditoría identifica al actor y que ninguna acción exige intervención de desarrollo. Registrar fecha, participantes, IDs sintéticos, resultado y defectos.

## Control diario del piloto

Mientras el piloto esté activo, el cierre agrega versión desplegada, estado de ambos interruptores, servicios iniciados/completos, pagos y devoluciones conciliados, diferencia monetaria, notificaciones fallidas, incidentes y capacidad del día. Finanzas firma la conciliación; operaciones firma la entrega y el suplente confirma recepción. Si aparece un criterio S0, cerrar entradas nuevas y activar el runbook de incidente sin interrumpir webhooks ni la atención de servicios existentes.
