# Traspaso de producción y mantenimiento

Fecha de preparación: 2026-09-12. Estado final demostrado: **PREPARACIÓN LOCAL AVANZADA; PRODUCCIÓN NO HABILITADA**.

## Versión y destino

La implementación está en la rama local `codex/production-readiness`. El candidato definitivo debe crearse después de todos los cambios desde un checkout limpio; este documento no fija un deployment ni un dominio. No existe staging o producción identificado y aprobado en la evidencia del plan.

El registro canónico es `docs/plans/2026-09-10-production-progress.json`. En el cierre de preparación registra 11 tareas verificadas, 6 implementadas con verificación externa pendiente, 19 en progreso por pruebas DB/staging/proveedor y T36–T39 bloqueadas por dependencias externas. Las 40 tareas fueron trabajadas; ese contador no equivale a release.

## Gates y decisión

G01–G16 permanecen `pending` porque no existe un manifest del candidato final con evidencia autenticada. D01–D12 también permanecen pendientes. Por lo tanto no se ha demostrado TECHNICALLY_READY, PILOT_ENABLED ni GENERAL_PRODUCTION_READY. El manifiesto se genera con `pnpm release:manifest` y debe validarse contra la confianza protegida; una evidencia local o este traspaso no firma gates.

La verificación local final aprobó lint, tipos, 174 pruebas de dominio, 503 pruebas unitarias en 78 archivos, 24 controles de tooling, build de 81 páginas, auditoría productiva sin vulnerabilidades conocidas y verificadores de pagos e imágenes sin llamadas externas. Playwright descubrió 36 casos en siete suites y tres proyectos; no se ejecutaron porque requieren Supabase descartable o staging.

## Trabajo entregado

- Arquitectura de aplicación, autorización, almacenamiento privado, workflows del servicio, dinero, soporte, mantenimiento, notificaciones, observabilidad y consola operativa implementados o preparados según el registro.
- Suite E2E de siete recorridos descubierta en tres proyectos, perfil de carga seguro y matrices de staging/proveedor preparadas.
- Runbooks de operación, incidente, recuperación, despliegue, piloto, privacidad y capacitación preparados.
- Calendario y mapa de propiedad preparados sin inventar titulares nominales.

## Bloqueos para el piloto

1. Identificar y autenticar el Supabase remoto conectado, comprobar entorno y backup, y ejecutar allí las migraciones e integraciones pendientes de T15–T31 con pgTAP. No usar Supabase local ni Docker.
2. Designar staging/hosting, project ref, dominio, secretos, remitente, scheduler y destinos de alertas; ejecutar T32, T34, T35 y T36 allí.
3. Identificar la aplicación y cuentas Mercado Pago, completar MP01–MP12 y cualquier prueba financiera real expresamente autorizada.
4. Resolver D01–D12, aprobar políticas, economía, soporte, RPO/RTO, capacidad y responsables/suplentes nominales.
5. Construir el candidato exacto, completar G01–G15, firmar GO y abrir sólo el cupo autorizado con interruptores controlables.

## Bloqueos para salida general

Ejecutar el piloto real durante la muestra y duración de D01, con conciliación diaria, soporte independiente, cero diferencias monetarias inexplicadas y cero defectos bloqueantes. Luego completar G16, revisar capacidad demostrada y firmar el traspaso. No ampliar zonas o cupos por estimación sin esos resultados.

## Operación y custodia

Usar `docs/runbooks/daily-operations.md` para turnos, `docs/release/production-runbook.md` para lanzamientos, `docs/runbooks/incident-response.md` para incidentes y `docs/runbooks/disaster-recovery.md` para restauración. Los custodios nominales se registran en `docs/architecture/ownership-map.md`; actualmente están pendientes. Los costos y límites propuestos están en `docs/release/performance-and-cost.md` y aún requieren D10.

## Backlog aceptable después de G16

Sólo pueden postergarse mejoras no bloqueantes registradas con responsable, vencimiento y riesgo aceptado. Seguridad, aislamiento, integridad monetaria, trazabilidad, soporte, backups, funciones nucleares y cualquier S0/S1 quedan fuera de ese backlog.

Próxima revisión: al recuperar la base descartable o al designar staging, lo que ocurra primero. Hasta entonces mantener ambos interruptores de entrada apagados en cualquier entorno que pudiera recibir tráfico real.
