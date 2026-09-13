# Matriz final de alcance

Fecha: 2026-09-12. Estado de release: NO-GO.

| Bloque | Tareas | Preparación actual | Cierre pendiente |
| --- | --- | --- | --- |
| B01 Fuente y reproducibilidad | T00–T04,T33,T37,T39 | controles, inventario y manifest preparados | CI protegida y evidencia del candidato |
| B02 Seguridad e identidad | T02,T04–T10,T33,T34,T37 | auth, MFA, roles, RLS y sesiones implementados | integración DB completa, staging y UAT |
| B03 Flujo cliente | T05,T07,T12–T16,T20–T23,T27,T34,T38 | páginas y servicios conectados | DB/E2E remoto y piloto real |
| B04 Flujo profesional | T05,T11,T13,T16,T19,T20,T24,T25,T28,T34,T38 | onboarding, ofertas, trabajo y pagos conectados | DB/E2E remoto, políticas y piloto |
| B05 Operación admin | T09,T14–T18,T23,T26,T29,T34,T37 | consola real y permisos por módulo | integración, turnos y UAT con operadores |
| B06 Persistencia | T03–T06,T08,T10,T13–T30,T32,T37 | migraciones y repositorios preparados | fresh/upgrade, pgTAP, backup y restore |
| B07 Archivos | T04,T08,T10,T13,T19,T22,T32,T37 | Storage privado y evidencia implementados | validación remota y restore de bytes |
| B08 Dinero | T01,T14,T16–T18,T35–T38 | ledger, checkout, webhook y excepciones implementados | MP01–MP12, conciliación y autorización |
| B09 Calidad | T23,T30,T33–T38 | suites, controles y runbooks preparados | E2E/carga/UAT/alertas/piloto ejecutados |
| B10 Operación sostenible | T00–T04,T30–T39 | runbooks, calendario y traspaso preparados | nombres, suplentes, gates y piloto |

Las funciones nucleares no se consideran excluibles. Sólo D12 puede aprobar opciones accesorias con comportamiento visible, riesgo y vencimiento. El detalle de cada tarea está en el registro estructurado.
