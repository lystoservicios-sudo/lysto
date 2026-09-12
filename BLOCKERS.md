# Bloqueos de producción

Fecha: 2026-09-12. Estado: producción y piloto no habilitados.

| Bloqueo | Impacto | Condición de salida |
| --- | --- | --- |
| Runtime Docker/Supabase local indisponible | impide ejecutar migraciones nuevas, integración real y pgTAP de T15–T31 | recuperar runtime sin destruir datos del usuario; ejecutar protocolo fresh/upgrade y cero skips críticos |
| Staging/hosting D04 sin identificar | bloquea E2E remoto, carga, alertas, restore, dominio y smoke | dueño, proyecto `production:false`, dominio, secretos y evidencia del candidato |
| Mercado Pago D11 sin app/cuentas | bloquea MP01–MP12, conciliación y aceptación comercial | titular, cuentas oficiales, webhook y matriz proveedor aprobada |
| Decisiones D01–D12 pendientes | bloquea políticas, economía, soporte, continuidad, capacidad y alcance | decisiones fechadas por responsables con referencias verificables |
| Responsables y suplentes nominales pendientes | bloquea operación, incidentes y GO | completar ownership, turnos, capacitación y accesos mínimos con MFA |
| CI/promoción remota sin evidencia protegida | bloquea autenticación de gates | checks obligatorios, confianza protegida y run del commit exacto |
| Piloto real no iniciado | bloquea G16 y salida general | muestra/duración D01, conciliación, cero S0/S1 y aceptación de resultados |

Además faltan backup/restore medidos, ejecución completa E2E en Chromium/WebKit y móviles físicos, perfiles de carga en staging, remitente/scheduler/alertas y aprobación legal de políticas. Un archivo local no resuelve esos puntos.

No hay autorización para despliegue, migración remota, pago, devolución, correo externo o activación de tráfico. Al resolverse un bloqueo, actualizar el registro estructurado y adjuntar evidencia al manifest del candidato exacto.
