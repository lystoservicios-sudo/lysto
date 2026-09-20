# Bloqueos de producción

Actualizado: 2026-09-20. Estado: producción y piloto no habilitados. Las 37 tareas implementadas/verificadas no sustituyen las aceptaciones externas ni el piloto real.

| Bloqueo | Impacto | Condición de salida |
| --- | --- | --- |
| Supabase de producción sin backup restaurable | `dqonlqcurvjnjgsczevu` estaba en 59/63 migraciones del candidato base y en plan Free; no hay restore completo medido ni RPO/RTO aprobados | autorizar un plan con backup y protección HIBP, demostrar restauración aislada de DB, Storage y secretos, y promover migraciones aprobadas tras preflight |
| Aceptación externa de staging incompleta | el candidato base pasó 39/39 E2E y staging llegó a 63/63 migraciones; Cron respondió cinco veces con HTTP 200 y Resend aceptó dos envíos, pero no se confirmó la bandeja ni el dominio remitente propio | verificar recepción, remitente, alertas y Storage privado con evidencia; asignar custodios y completar restore medido |
| Mercado Pago D11 sin aplicación/cuentas oficiales | la implementación de Checkout Pro Orders está en `codex/mercadopago-orders`, con migración sólo en staging y Preview con checkout desactivado; no hay OAuth, pago, webhook ni devolución de proveedor probados | identificar titular y cuentas de prueba, configurar secretos y webhook aprobados, ejecutar MP01–MP12 y conciliar resultados |
| Acceso remoto de verificación no disponible en esta sesión | `supabase projects list` del 2026-09-20 no enumera ninguno de los dos proyectos Lysto; no se ejecutaron pruebas ni migraciones contra otra base | conectar una identidad con acceso explícito a staging y, para promoción aprobada, a producción; confirmar el project ref antes de cualquier escritura |
| Decisiones D01–D12 pendientes | bloquea políticas, economía, soporte, continuidad, capacidad y alcance | decisiones fechadas por responsables con referencias verificables |
| Responsables y suplentes nominales pendientes | bloquea operación, incidentes y GO | completar ownership, turnos, capacitación y accesos mínimos con MFA |
| Protección de rama y aprobación de promoción sin acreditar | la CI del candidato anterior pasó; al 2026-09-13 `main` no tenía ruleset/protección y hoy la conexión GitHub no permite confirmar el estado actual; no existe firma humana de promoción | verificar o configurar checks obligatorios, confianza protegida y responsables aprobadores |
| Piloto real no iniciado | bloquea G16 y salida general | muestra/duración D01, conciliación diaria, cero S0/S1 y aceptación de resultados |

Además faltan móviles físicos, destinos de alertas, aprobación legal de políticas y firmas del GO. T35 aprobó carga sostenida, doble pico, ráfaga y recuperación, pero eso no prueba capacidad comercial autorizada. La rama Orders registró un bloqueo adicional: siete versiones antiguas de migración en staging impiden el `db push` normal; la migración nueva se aplicó y registró allí con precondiciones, sin alterar producción. Resolver el historial antes de la próxima promoción.

No se usará Supabase local ni Docker en este equipo. La auditoría remota inicial está en `docs/release/remote-supabase-audit-2026-09-12.md`; los resultados posteriores de staging y proveedor están en `docs/release/staging-acceptance.md` y `docs/release/provider-acceptance.md`. No hay autorización registrada para pago/devolución live, correos externos indiscriminados ni activación de tráfico productivo.
