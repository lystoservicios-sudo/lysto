# Traspaso de producción y mantenimiento

Fecha de preparación: 2026-09-12. Estado final demostrado: **PREPARACIÓN LOCAL AVANZADA; PRODUCCIÓN NO HABILITADA**.

## Anexo de alta profesional (2026-09-22)

La ampliación de invitaciones copiables, políticas versionadas, avatar público inspeccionado, OAuth durante la postulación y condición de preparación para trabajos nuevos tiene **esquema aplicado sólo en Supabase staging**; la interfaz aún no está desplegada. El 2026-09-22 se aplicaron y registraron cuatro migraciones, incluida la activación previa del registro de clientes, con precondiciones de proyecto, historial y ausencia de expedientes. Pasaron 69 comprobaciones SQL de onboarding, asignación y registro de clientes después del commit, revertidas por transacción. Antes de publicar en producción: comparar instalación limpia y actualización con expedientes legados, aprobar requisitos documentales por especialidad con responsable nominal, y completar MP01a/MP01–MP12 en sandbox. No activar nuevas asignaciones pagas sin comprobar la cuenta vendedora del profesional y el cambio de política sobre los aprobados actuales. El registro de clientes debe repetir confirmación, aceptación legal y acceso tras la actualización.

## Versión y destino

La implementación está en la rama remota `codex/production-readiness`. El candidato runtime `67932c45e563849d5085abec5997bed220983186` está desplegado en staging protegido; el alias productivo no fue modificado. El Supabase remoto `dqonlqcurvjnjgsczevu` fue identificado como `PRODUCTION` y staging usa el proyecto aislado `obksyzasmfwcbbksesqt`.

El registro canónico es `docs/plans/2026-09-10-production-progress.json`. Registra 11 tareas verificadas, 26 implementadas con aceptación externa pendiente y 3 bloqueadas por dependencias externas. Las 40 tareas fueron trabajadas; ese contador no equivale a release. Staging remoto pasó 39/39 casos automatizados sin omitidos y T35 aprobó todos los perfiles de carga.

## Gates y decisión

G01–G16 permanecen `pending` porque no existe un manifest del candidato final con evidencia autenticada. D01–D12 también permanecen pendientes. Por lo tanto no se ha demostrado TECHNICALLY_READY, PILOT_ENABLED ni GENERAL_PRODUCTION_READY. El manifiesto se genera con `pnpm release:manifest` y debe validarse contra la confianza protegida; una evidencia local o este traspaso no firma gates.

La CI del runtime `67932c45` aprobó ambos jobs, incluidos Windows, lint, tipos, 174 pruebas de dominio, 526 pruebas unitarias, 698 pruebas SQL en 28 suites, 275 pruebas integrales y la compilación de 81 páginas. Playwright ejecutó y aprobó 39/39 casos en siete suites y tres proyectos contra staging remoto; la limpieza posterior dejó cero identidades sintéticas.

## Trabajo entregado

- Arquitectura de aplicación, autorización, almacenamiento privado, workflows del servicio, dinero, soporte, mantenimiento, notificaciones, observabilidad y consola operativa implementados o preparados según el registro. La confirmación de visita, el recordatorio opcional de reseña a las dos horas y las acciones del cliente están activos en staging.
- Supabase Cron invoca cada minuto al worker autenticado del preview; las últimas cinco ejecuciones terminaron con HTTP 200. Resend está habilitado solo en staging y aceptó las dos plantillas autorizadas para el buzón designado; falta confirmar la bandeja y verificar un dominio remitente propio.
- Suite E2E de siete recorridos descubierta en tres proyectos, perfil de carga seguro y matrices de staging/proveedor preparadas.
- Runbooks de operación, incidente, recuperación, despliegue, piloto, privacidad y capacitación preparados.
- Calendario y mapa de propiedad preparados sin inventar titulares nominales.

## Bloqueos para el piloto

1. Pasar el Supabase productivo a un plan con backup restaurable y protección HIBP; demostrar una restauración completa en un proyecto aislado y promover 59/63 a 63/63. Staging ya está en 63/63, con 65/65 tablas públicas bajo RLS y la nueva suite de notificación aprobada 17/17 con rollback. No usar Supabase local ni Docker en este equipo.
2. Designar responsables nominales de hosting/staging, remitente, scheduler y destinos de alertas; conectar un dominio y buzón Resend aprobados y completar T32/T36. T34, el scheduler de staging y la implementación técnica de T35 ya están ejecutados.
3. Identificar la aplicación y cuentas Mercado Pago, completar MP01–MP12 y cualquier prueba financiera real expresamente autorizada.
4. Resolver D01–D12, aprobar políticas, economía, soporte, RPO/RTO, capacidad y responsables/suplentes nominales.
5. Construir el candidato exacto, completar G01–G15, firmar GO y abrir sólo el cupo autorizado con interruptores controlables.

## Bloqueos para salida general

Ejecutar el piloto real durante la muestra y duración de D01, con conciliación diaria, soporte independiente, cero diferencias monetarias inexplicadas y cero defectos bloqueantes. Luego completar G16, revisar capacidad demostrada y firmar el traspaso. No ampliar zonas o cupos por estimación sin esos resultados.

## Operación y custodia

Usar `docs/runbooks/daily-operations.md` para turnos, `docs/release/production-runbook.md` para lanzamientos, `docs/runbooks/incident-response.md` para incidentes y `docs/runbooks/disaster-recovery.md` para restauración. Los custodios nominales se registran en `docs/architecture/ownership-map.md`; actualmente están pendientes. Los costos y límites propuestos están en `docs/release/performance-and-cost.md` y aún requieren D10.

## Backlog aceptable después de G16

Sólo pueden postergarse mejoras no bloqueantes registradas con responsable, vencimiento y riesgo aceptado. Seguridad, aislamiento, integridad monetaria, trazabilidad, soporte, backups, funciones nucleares y cualquier S0/S1 quedan fuera de ese backlog.

Próxima revisión: al asegurar un backup recuperable y responsables nominales, o al identificar la aplicación y cuentas oficiales de Mercado Pago, lo que ocurra primero. Hasta entonces mantener ambos interruptores de entrada apagados en cualquier entorno que pudiera recibir tráfico real.
