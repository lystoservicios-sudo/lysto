# Bloqueos de producción

Fecha: 2026-09-12. Estado: producción y piloto no habilitados.

| Bloqueo | Impacto | Condición de salida |
| --- | --- | --- |
| Supabase de producción sin backup restaurable | `dqonlqcurvjnjgsczevu` está activo en 59/62 migraciones; el plan Free no ofrece backups y tampoco permite protección HIBP de contraseñas | pasar a un plan con backups y HIBP, producir un backup recuperable, demostrar una restauración aislada y promover las tres migraciones pendientes con RPO/RTO medidos |
| Staging carece de servicios operativos externos | app y base aisladas existen y pasaron 36/36 E2E; faltan remitente, scheduler, alertas, backup/restore y responsables nominales | configurar y demostrar esos servicios con custodios y evidencia saneada |
| Mercado Pago D11 sin app/cuentas | bloquea MP01–MP12, conciliación y aceptación comercial | titular, cuentas oficiales, webhook y matriz proveedor aprobada |
| Decisiones D01–D12 pendientes | bloquea políticas, economía, soporte, continuidad, capacidad y alcance | decisiones fechadas por responsables con referencias verificables |
| Responsables y suplentes nominales pendientes | bloquea operación, incidentes y GO | completar ownership, turnos, capacitación y accesos mínimos con MFA |
| Protección de rama y aprobación de promoción pendientes | CI completa del candidato pasa, pero `main` aún no tiene ruleset/protección ni firma humana de promoción | configurar checks obligatorios, confianza protegida y responsables aprobadores |
| Piloto real no iniciado | bloquea G16 y salida general | muestra/duración D01, conciliación, cero S0/S1 y aceptación de resultados |

Además faltan backup/restore medidos, móviles físicos, remitente/scheduler/alertas y aprobación legal de políticas. La ejecución automatizada remota pasó 36/36 en Chromium desktop/mobile y WebKit mobile; T35 aprobó carga sostenida, doble pico, ráfaga y recuperación.

No se usará Supabase local ni Docker en este equipo. La identidad, acceso permanente, estado productivo 59/62, staging 62/62 y 28 suites SQL reversibles están documentados en `docs/release/remote-supabase-audit-2026-09-12.md`. No hay autorización para pago, devolución, correo externo o activación de tráfico productivo.
