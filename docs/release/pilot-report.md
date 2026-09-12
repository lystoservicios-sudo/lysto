# Informe del piloto supervisado

Estado: **no iniciado**. Esta plantilla no representa días transcurridos, servicios reales ni aceptación de clientes. La referencia propuesta es 20 servicios completos durante al menos 14 días; sólo D01 puede reemplazarla.

## Identidad y alcance

| Campo | Valor |
| --- | --- |
| Release y manifest `pilot` aprobado | pendiente |
| Inicio / fin observados | pendiente / pendiente |
| Zona, horarios y cupo D01 | pendiente |
| Profesionales activos | pendiente |
| Operador, suplente y guardia | pendiente |
| Objetivos D02, D03 y D10 | pendiente |

## Muestra trazable

Registrar cada servicio con ID interno, fechas de solicitud/asignación/reserva/visita/cierre, profesional, estado final y referencias de pago, devolución, soporte y garantía. No copiar nombres, direcciones, teléfonos, credenciales ni datos de tarjeta al informe. La muestra debe permitir contrastar totales contra DB, ledger, proveedor y auditoría.

| Métrica | Objetivo aprobado | Observado | Evidencia |
| --- | --- | --- | --- |
| Servicios completos | D01; referencia 20 | pendiente | pendiente |
| Duración | D01; referencia ≥14 días | pendiente | pendiente |
| Tiempo solicitud → presupuesto | D10 | pendiente | pendiente |
| Tiempo presupuesto → asignación | D10 | pendiente | pendiente |
| Puntualidad / reprogramaciones | D03 | pendiente | pendiente |
| Cancelaciones | D03 | pendiente | pendiente |
| Revisitas y garantías | D03 | pendiente | pendiente |
| Pagos y devoluciones conciliados | 100% | pendiente | pendiente |
| Diferencia monetaria inexplicada | 0 | pendiente | pendiente |
| Incidentes críticos abiertos | 0 | pendiente | pendiente |
| Intervenciones SQL ordinarias | 0 | pendiente | pendiente |

## Revisión diaria

Por cada día operativo registrar fecha, versión, estado de switches, solicitudes bloqueadas, capacidad y asignaciones; pagos inciertos y conciliación; visitas y cierres; notificaciones fallidas; reclamos/garantías; incidentes; operador y suplente. Enlazar artefactos saneados y el acta de entrega de turno. Los días sin actividad se registran como tales y no cuentan como servicio completo.

## Incidentes y defectos

Resumir defectos desde `pilot-defects.md`, releases correctivas y regresiones ejecutadas. Un acceso indebido, doble cobro, evidencia perdida o estado monetario desconocido detiene entradas nuevas y activa el runbook de incidente. Conservar servicios existentes, webhooks, ledger y atención.

## Resultado y capacidad

Documentar resultados observados, limitaciones, aprendizaje, costo real, demanda, capacidad operativa y cupo máximo demostrado. Para proponer salida general deben existir cero diferencias monetarias inexplicadas, cero defectos bloqueantes abiertos, soporte sin dependencia habitual del desarrollador y aceptación autenticada de operaciones, finanzas, técnica y dirección para G16.

- Resultado: **PENDIENTE**
- Cupo o zonas recomendados: pendiente
- Riesgos aceptados y vencimiento: pendiente
- Operaciones: pendiente
- Finanzas: pendiente
- Técnica: pendiente
- Dirección: pendiente

Hasta completar la muestra y las firmas, el piloto no acredita GENERAL_PRODUCTION_READY.
