# Registro de defectos del piloto

Estado: preparado, sin defectos reales registrados porque el piloto no inició.

## Reglas

Cada defecto usa un ID único y registra fecha, release, recorrido, rol, entidad interna saneada, pasos reproducibles, resultado esperado/observado, severidad, evidencia, responsable y estado. No incluir secretos ni datos personales. Corregir por una release trazable con regresión pertinente; no usar cambios SQL invisibles como operación habitual.

| Severidad | Definición | Respuesta |
| --- | --- | --- |
| S0 bloqueante | acceso indebido, doble cobro, evidencia perdida, corrupción o estado monetario desconocido | cerrar solicitudes y checkouts; declarar incidente inmediato |
| S1 crítica | impide completar un recorrido esencial o atender un caso dentro del SLA | no ampliar piloto; responsable y mitigación inmediata |
| S2 mayor | degrada el recorrido con alternativa segura y operable | priorizar en la siguiente release del piloto |
| S3 menor | impacto acotado, cosmético o de conveniencia | backlog con decisión y vencimiento |

## Casos

| ID | Fecha | Release | Recorrido | Severidad | Estado | Responsable | Evidencia / regresión |
| --- | --- | --- | --- | --- | --- | --- | --- |
| pendiente | pendiente | pendiente | pendiente | pendiente | pendiente | pendiente | pendiente |

Estados permitidos: `open`, `mitigated`, `fixed`, `verified`, `accepted`. Sólo `verified` acredita una corrección cerrada. `accepted` requiere riesgo, motivo, vencimiento y aprobador, y nunca se aplica a S0.

## Cierre

Antes de G16, confirmar cero S0/S1 abiertos, reejecutar regresiones de cada corrección, conciliar cualquier impacto monetario y reflejar limitaciones S2/S3 en el informe. La ausencia de filas no demuestra ausencia de defectos si no existe evidencia de la muestra del piloto.
