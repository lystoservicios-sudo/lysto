# Bloqueos de producción

Fecha: 2026-09-12. Estado: producción y piloto no habilitados.

| Bloqueo | Impacto | Condición de salida |
| --- | --- | --- |
| Supabase de producción sin backup restaurable | `dqonlqcurvjnjgsczevu` está activo y el esquema remoto ya fue promovido y verificado en 58/58 migraciones; el plan Free no ofrece backups y tampoco permite protección HIBP de contraseñas | pasar a un plan con backups y HIBP, producir un backup recuperable y demostrar una restauración aislada con RPO/RTO medidos |
| Staging/hosting D04 sin identificar | bloquea E2E remoto, carga, alertas, restore, dominio y smoke | dueño, proyecto `production:false`, dominio, secretos y evidencia del candidato |
| Mercado Pago D11 sin app/cuentas | bloquea MP01–MP12, conciliación y aceptación comercial | titular, cuentas oficiales, webhook y matriz proveedor aprobada |
| Decisiones D01–D12 pendientes | bloquea políticas, economía, soporte, continuidad, capacidad y alcance | decisiones fechadas por responsables con referencias verificables |
| Responsables y suplentes nominales pendientes | bloquea operación, incidentes y GO | completar ownership, turnos, capacitación y accesos mínimos con MFA |
| CI/promoción remota sin evidencia protegida | bloquea autenticación de gates | checks obligatorios, confianza protegida y run del commit exacto |
| Piloto real no iniciado | bloquea G16 y salida general | muestra/duración D01, conciliación, cero S0/S1 y aceptación de resultados |

Además faltan backup/restore medidos, ejecución completa E2E en Chromium/WebKit y móviles físicos, perfiles de carga en staging, remitente/scheduler/alertas y aprobación legal de políticas. Un archivo local no resuelve esos puntos.

No se usará Supabase local ni Docker. La identidad, acceso permanente, promoción de 58 migraciones y 28 suites SQL reversibles están documentados en `docs/release/remote-supabase-audit-2026-09-12.md`. No hay autorización para pago, devolución, correo externo o activación de tráfico.
