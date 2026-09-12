# Bloqueos de producción

Fecha: 2026-09-12. Estado: producción y piloto no habilitados.

| Bloqueo | Impacto | Condición de salida |
| --- | --- | --- |
| Identidad/acceso del Supabase remoto inconsistente | la app local apunta a `dqonlqcurvjnjgsczevu`, el MCP `supabase` a `zsqwagnozrnetlpluzpg` y ambos dominios no resuelven; `supabase-studioflow` apunta a `rmkngkkuglexnzzuvdgb`, que responde pero no autenticó | identificar cuál referencia pertenece a Lysto, autenticar acceso de sólo lectura, verificar entorno/backup y recién entonces ejecutar el protocolo remoto |
| Staging/hosting D04 sin identificar | bloquea E2E remoto, carga, alertas, restore, dominio y smoke | dueño, proyecto `production:false`, dominio, secretos y evidencia del candidato |
| Mercado Pago D11 sin app/cuentas | bloquea MP01–MP12, conciliación y aceptación comercial | titular, cuentas oficiales, webhook y matriz proveedor aprobada |
| Decisiones D01–D12 pendientes | bloquea políticas, economía, soporte, continuidad, capacidad y alcance | decisiones fechadas por responsables con referencias verificables |
| Responsables y suplentes nominales pendientes | bloquea operación, incidentes y GO | completar ownership, turnos, capacitación y accesos mínimos con MFA |
| CI/promoción remota sin evidencia protegida | bloquea autenticación de gates | checks obligatorios, confianza protegida y run del commit exacto |
| Piloto real no iniciado | bloquea G16 y salida general | muestra/duración D01, conciliación, cero S0/S1 y aceptación de resultados |

Además faltan backup/restore medidos, ejecución completa E2E en Chromium/WebKit y móviles físicos, perfiles de carga en staging, remitente/scheduler/alertas y aprobación legal de políticas. Un archivo local no resuelve esos puntos.

No se usará Supabase local ni Docker. La instrucción de usar el Supabase remoto autoriza orientar las pruebas hacia ese entorno, pero no permite aplicar migraciones a una referencia ambigua. Antes de escribir se debe demostrar identidad, clasificación del entorno, backup y alcance. No hay autorización para pago, devolución, correo externo o activación de tráfico.
