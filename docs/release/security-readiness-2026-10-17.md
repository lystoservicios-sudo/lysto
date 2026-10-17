# Seguridad y preparación operativa — 17 de octubre de 2026

Estado: **NO-GO para apertura comercial**. Este informe no reemplaza el acta ni las evidencias de release. Las correcciones de código están en `codex/production-readiness`; no atribuirlas a producción hasta registrar migración y despliegue verificados.

## Hallazgos corregidos en el candidato

- **SEC-01 / alto — autorización de agenda con NULL.** Los RPC de lectura/escritura comparaban el profesional solicitado con un identificador que puede ser NULL. PostgreSQL no ejecuta un rechazo `IF` cuando la condición resulta NULL. Se reprodujo la lectura sin sesión mediante una transacción revertida y un UUID ficticio, sin consultar datos de personas. La migración `20261017022141_production_authorization_hardening.sql` exige autorización explícitamente verdadera en cuatro RPC y conserva las implementaciones privilegiadas en el esquema privado, detrás de funciones públicas invoker. Incluye pruebas de permisos y de clientes/profesionales suspendidos.
- **SEC-02 / medio — lectura sin límite efectivo del webhook.** La ruta de Mercado Pago leía todo el cuerpo antes de limitar caracteres; UTF-8 y transferencias sin Content-Length podían superar el límite en bytes. Ahora se limita la lectura real a 65.536 bytes, con plazo de 3 segundos, cancelación y control de frecuencia antes de leer. Las pruebas comprueban UTF-8, flujo excesivo y flujo detenido. No cambia la firma ni el procesamiento financiero.
- **REL-01 / medio — bloqueos invertidos al reprogramar.** Una propuesta bloqueaba trabajo → solicitud; una respuesta hacía solicitud → trabajo. Se unifica trabajo → solicitud y se relee la solicitud bajo bloqueo. La regresión usa conexiones independientes y comprueba que el respondedor no retenga la solicitud mientras espera el trabajo.
- **REL-02 / alto para el flujo — Hogar rechazaba direcciones válidas.** El controlador y la recuperación persistente usaban el contrato antiguo, que rechazaba `locationProof`. Ahora preservan el comprobante; un reintento incierto lo renueva sin cambiar datos ni clave idempotente. La renovación fallida conserva el comando. Se prueban comprobantes A → B, aislamiento de cuenta y rechazo de comprobantes ausentes, falsos o incompatibles.
- **REL-03 / medio — errores de ubicación silenciosos.** Hogar/Más exigen selección confirmada para nuevas ubicaciones. Los campos de clientes y técnicos explican un fallo del proveedor y permiten reintentar, sin aceptar respuestas obsoletas ni quitar la validación.

## Comprobaciones y límites

- Acceso real de lectura a Supabase `dqonlqcurvjnjgsczevu` comprobado con el perfil dedicado del Owner. Todas las tablas del esquema público inspeccionadas tienen RLS. No se imprimieron ni copiaron secretos.
- Auditoría de dependencias, lint, tipos, pruebas unitarias, pruebas de dominio en Windows y Ubuntu, y pruebas de esquema/permisos pasaron en el primer candidato `cb1a343` (run `38994789330`). La integración completa falló; no equivale a aceptación del candidato final.
- La revisión independiente encontró REL-01 y revisó la idempotencia. Ninguna revisión estática certifica la ausencia de otras vulnerabilidades.
- Antes de la migración, el asesor de seguridad devolvió 37 avisos y 0 errores: 35 funciones definer expuestas, citext en public y protección contra contraseñas filtradas no habilitada. No se revocaron indiscriminadamente funciones legítimas. Repetir asesores después de aplicar cambios.

## Pendientes externos: no resueltos con código

1. **Direcciones:** falta `GOOGLE_MAPS_SERVER_API_KEY` en producción. El usuario confirmó no tenerla. La implementación actual usa Georef y Google Geocoding; sin ese proveedor no puede confirmar domicilios nuevos. No se deshabilitó la comprobación. Elegir/configurar otro proveedor requiere otra integración.
2. **Avisos automáticos:** faltan programación y credenciales del worker/outbox. Se observaron cinco eventos pendientes, todos `in_app`, sin eventos muertos; no se encontró una cola pendiente de emails reales. Plantillas publicadas no prueban entrega automática.
3. **Alojamiento:** Vercel está en Hobby. El usuario pospuso el aumento de planes. Hobby limita cron a una vez al día y está destinado a uso personal no comercial; no se contrató ni cambió el plan. Fuentes: [cron](https://vercel.com/docs/cron-jobs/usage-and-pricing), [Hobby](https://vercel.com/docs/plans/hobby).
4. **Recuperación:** la consulta autenticada devolvió `backups: []` y `pitr_enabled: false`. No hay evidencia disponible de un respaldo recuperable o una restauración comprobada. El usuario pospuso aumentar planes. No se exportaron datos de producción al repositorio. [Documentación de respaldos](https://supabase.com/docs/guides/platform/backups).
5. **Pago real y entrega real:** conectar la cuenta o crear una preferencia sin pagar no certifica pago → webhook → comisión/neto → devolución. Sigue pendiente prueba autorizada con importe, pagador, destinatario y política de devolución concretos, y entrega de correo a un destinatario autorizado.
6. **Apertura:** mantener `docs/release/go-no-go.md` como NO-GO y no habilitar interruptores de admisión/cobro por inferencia. No se emitieron aprobaciones humanas ni del proveedor.

## Registro de publicación

Pendiente: commit final, CI completo, migración aplicada, asesores posteriores y despliegue confirmado. Actualizar con evidencias reales antes de afirmar que estas correcciones están publicadas.
