# Revisión previa a la apertura del 26 de octubre

Fecha: 25/10/2026, Argentina. Estado: **correcciones prioritarias publicadas; avisos internos restablecidos; pendientes y límites expresos más abajo**.

## Actualización del 26/10: buscador de direcciones

Se publicó el buscador territorial con ingreso manual y salida a ayuda para traslado no verificable. Suite completa **2.435/2.435**, compilación, dominio y formulario compartido publicados comprobados. El caso puntual de Berazategui se reemplazó por la corrección del flujo general; no se cambiaron coordenadas ni direcciones de clientes. [Informe de direcciones y límites](2026-10-26-address-search.md). La publicación vigente de esta actualización es `8cb1de60b434f9bc9e503d2af7e9c0c14b6ca742`; las verificaciones históricas siguientes conservan su fecha y versión.

## Actualización: correo automático resuelto

El titular autorizó continuar con los correos automáticos. Se aplicaron las migraciones 101/102: **seis emails vigentes Delivered en Resend, cuatro obsoletos suprimidos y cero pendientes en ambos canales**, con cinco ejecuciones automáticas consecutivas correctas. Se verificó el dominio remitente y se generó un respaldo cifrado actualizado a 102 migraciones en ambos discos. [Informe específico y límites de entrega/restauración](2026-10-25-automatic-email-activation.md). El destino de Berazategui fue confirmado por el titular. El pedido automático calcula desde el profesional asignado; no se requiere una dirección general de Lysto. La calculadora sin punto de salida mantiene el traslado pendiente de verificación.

## Publicación verificada

El usuario autorizó publicar la corrección y priorizar los problemas importantes para la apertura de mañana. Se publicó [lystohogar.com](https://lystohogar.com) con el deployment `dpl_Fhmdge6SozEjBijBvPaSByU2Zwbv`, estado READY/PROMOTED y commit runtime `ad231c2bf17b3528dc4582fdc757d2f623a6e908`. La respuesta pública de `/api/health/live` devuelve ese commit y HTTP 200; `/api/health/ready` devuelve ready/production y HTTP 200.

La primera auditoría partió del runtime `f8bd22c`. Durante el trabajo otra publicación actualizó producción a `d7ac08d56f2630964a59259867671ddc98356a65`. Se canceló el primer candidato sin promoverlo y se integraron las correcciones sobre esa nueva base, conservando las mejoras de búsqueda de direcciones e invitaciones. El checkout inicial `E:/Proyectos/GitHub/Lysto`, con cambios ajenos, no se revirtió ni se mezcló. El trabajo propio está en `C:/Users/quime/.codex/worktrees/launch-readiness-20261025/Lysto`, rama `codex/launch-readiness-20261025`.

## Comprobado después de publicar

| Área | Resultado |
| --- | --- |
| Sitio y salud | Dominio público y versión exacta comprobados; live y ready HTTP 200. Solicitudes y checkouts nuevos mantienen sus interruptores anteriores habilitados. |
| Cliente | Pagos muestra cuatro movimientos existentes. El pedido guardado se pudo recalcular: mantenimiento de 3.000 frigorías para el 28/10, 10–12, precio de **ARS 195.000** y botón Mercado Pago habilitado. No se completó un pago nuevo. El domicilio de esta prueba coincide con el origen del profesional; no acredita traslado distinto de cero. |
| Profesional | Cobros carga con la sesión guardada. Los pagos aprobados conservan su estado y el reparto 18/82; los enlaces vencidos ahora se muestran correctamente como «Enlace vencido». |
| Administrador | Gestión de pagos y Entrega de notificaciones cargan. Estados, importes y enlaces al trabajo son visibles sin iniciar cobros, conciliaciones, cancelaciones ni devoluciones. Estas pantallas se comprobaron en la publicación anterior. En la comprobación final la sesión del navegador integrado correspondía al cliente; /admin devolvió 404 sin datos y se continuó desde /app. La interfaz administrativa final no se volvió a comprobar: sus cambios de código y guards SQL sí tienen regresiones y revisión independiente. |
| Separación de roles | Antes de publicar, cliente → admin/pro devolvió 404 sin datos de otro rol. No se modificaron las reglas de autorización. |
| Supabase | Acceso real por CLI Owner; proyecto `dqonlqcurvjnjgsczevu`. Hay **104 migraciones** tras activar el correo automático y proteger la confirmación administrativa posterior al pago. El inventario inicial tenía 72 tablas públicas y cero sin RLS; el ensayo de restauración también verificó cero tablas públicas sin RLS. |
| Advisors posteriores | **33 WARN de seguridad y 38 de rendimiento; cero ERROR**. Incluyen 31 funciones privilegiadas expuestas, extensión en public, protección contra contraseñas filtradas no habilitada y políticas permisivas múltiples. No se revocaron permisos legítimos para ocultar avisos. |
| Regresiones SQL | Pasaron `scripts/qa/notification-delivery-boolean.sql` y `scripts/qa/customer-payment-read-permissions.sql` sobre producción, sin insertar pruebas ni cambiar permisos. |
| Errores de ejecución | Escaneo del deployment publicado, nivel error, últimos 15 minutos, límite 100: **cero entradas**, comando exit 0. Es una ventana acotada y no acredita alertas externas o ausencia de todo error futuro. |

Las capturas de la auditoría inicial son privadas: `E:/Proyectos/GitHub/Lysto/output/launch-audit-2026-10-25/`. Las sesiones se conservan cifradas fuera del repositorio.

## Correcciones de código

- Next y eslint-config-next pasan de 15.5.27 a **15.5.28**. Se mantienen sharp 0.35.5 y PostCSS 8.5.26. La mitigación de imágenes con sharp ya existía; la actualización de Next incorpora el arreglo de Server Actions.
- Zod pasa a **4.6.6**, también en la dependencia del SDK de pagos. Se adaptaron APIs incompatibles preservando objetos estrictos, UUID, importes, permisos, errores, metadatos opcionales de ORS y diccionarios parciales. Se completó la compatibilidad del nuevo proveedor GeoRef incorporado por la publicación concurrente.
- Administración y profesionales distinguían mal un checkout ready cuya fecha había pasado. Ahora indican «Enlace vencido»; aprobados y pendientes conservan su estado. Dos regresiones fallaron antes del cambio y pasaron después; también se comprobó visualmente el resultado publicado.
- POST del worker admite el modo interno explícito `inAppOnly:true`. No configura transporte de correo ni reclama emails en ese modo. GET y POST normal, y las invitaciones síncronas profesionales, conservan su comportamiento. La nueva propiedad se admite sólo en outbox: el parser compartido de devoluciones la sigue rechazando antes de ejecutar trabajo financiero. Se observaron las regresiones fallando antes del arreglo y pasando después.
- Se corrigieron fixtures antiguos sin relajar el producto: UUID sintéticos inválidos, una fecha anterior al mínimo de tres días hábiles, un mock de guardado incierto afectado por el autocompletado y tres pruebas que buscaban los campos retirados por el buscador unificado. Las pruebas del recorrido siguen usando cotización/preparación reales y verifican el reparto 18/82, identidad canónica y locationProof. Producción tiene cero UUID fuera de formato en trabajos, categorías y tipos de problema.
- La revisión independiente no dejó hallazgos bloqueantes pendientes en los cambios revisados. Se conservó la publicación concurrente de asignación directa y aprobación de documentos; respecto de ese runtime sólo cambió la calculadora sin punto de salida, que queda en revisión y no habilita oferta/aceptación sin traslado verificado. El flujo automático conserva el origen del profesional.

## Avisos internos recuperados

La auditoría inicial encontró 65 eventos vencidos sin intentos: 55 internos y diez emails. Hubo nuevos eventos internos durante el trabajo. Faltaba un scheduler desplegado.

Se aplicó y registró la migración `20261025235512_launch_notification_scheduler.sql`. Usa Supabase Cron y HTTP síncrono dentro del esquema privado `private_outbox_http`, con destino fijo `https://lystohogar.com/api/internal/outbox`, cuerpo `{batchSize:5,inAppOnly:true}`, timeout total de 55 segundos y conexión de diez. La credencial nueva exclusiva del worker está en Vercel como Sensitive y en Vault; no se imprimió, incorporó al código ni guardó en argumentos de procesos. No se rotó CRON_SECRET.

La alternativa pg_net se descartó antes de aplicarla porque sus tablas gestionadas permitían leer headers y el rol postgres del proyecto no podía quitar esos grants. La solución publicada no persiste una cola HTTP con credenciales. La función del scheduler y el esquema HTTP son inaccesibles para anon, authenticated, service_role y lysto_marketplace. Vault sigue inaccesible para los tres roles de aplicación no privilegiados; service_role conserva su acceso privilegiado preexistente.

El job `lysto-production-outbox-v1`, id 1, se instaló pausado y se activó sólo después de publicar y verificar la ruta protegida. Se comprobaron **seis ejecuciones consecutivas exitosas**, del 25/10 a las 21:27–21:32 de Argentina. La función sólo retorna éxito tras HTTP 200. Además se verificó el resultado en la base y la consola:

- **Cero avisos internos pendientes**, cero dead letters y cero leases vencidos.
- Los recursos o destinatarios ya no válidos se suprimieron mediante el flujo existente, sin borrar ni reescribir masivamente la cola.
- En el control inicial quedaron diez emails sin intentos. La activación posterior procesó seis vigentes, suprimió cuatro obsoletos y dejó cero pendientes, sin cambiar el interruptor global ni afectar invitaciones síncronas.

Procedimiento de activación, comprobación y pausa: [scheduler de producción](../runbooks/production-outbox-scheduler.md). No se contrató Vercel Pro ni otro plan.

## Respaldo e integridad

Se generó un archivo PostgreSQL nativo completo mediante pg_dump 17.11 contra PostgreSQL 17.6, con conexión de sesión y cifrado directo AES-256-GCM. El archivo custom mide **2.109.837 bytes**; pg_restore leyó 3.021 entradas y confirmó datos Auth, Storage, trabajos, outbox, Vault cifrado e historial de **99 migraciones**. Se guardaron además roles sin contraseñas y un suplemento cifrado con la migración 100 y su configuración. El dump es anterior a la activación del scheduler; los eventos posteriores deben conciliarse al recuperar.

También se descargaron y cifraron **41/41 archivos reales de Storage, 25.710.314 bytes**, verificando tamaños y SHA-256. Se verificó el descifrado autenticado del dump y los objetos. Los metadatos de Storage no cambiaron entre las comprobaciones inicial y final de esta copia. No se confunde este intervalo con un snapshot atómico conjunto de DB y archivos.

Hay dos copias en discos físicos distintos del mismo equipo, con 58 archivos contrastados por checksum:

- Manifiesto principal: `C:/Users/quime/.codex/private/lysto-backups/2026-10-25-235352-874a32d2/backup-manifest.json`.
- Espejo cifrado: `E:/Backups/Lysto/2026-10-25-235352-874a32d2/backup-manifest.json`.

El ensayo real en PostgreSQL 17.11 aislado, sólo en loopback, terminó con pg_restore exit 0 y comprobó **15 usuarios Auth, 15 perfiles, tres trabajos, 41 objetos Storage y 99 migraciones**, cero tablas públicas sin RLS y cero trabajos huérfanos. Se usaron roles locales NOLOGIN y se excluyeron diez entradas de Vault incompatibles con PostgreSQL portable. El servidor de ensayo quedó detenido.

Esto **no acredita una restauración integral G13**: no se probaron los servicios Auth/Storage, el servido de archivos desde la copia, el descifrado de Vault, privilegios globales ni un RPO/RTO continuo. La clave de recuperación depende del perfil Windows mediante DPAPI; las dos copias no resuelven perder todo el equipo. Tampoco se activó un servicio de backups automáticos/PITR.

La revisión automática rechazó eliminar la carpeta temporal de restauración con el motivo literal **«blocked by policy»**. No se intentó otra vía de borrado. Quedó retenida en `C:/Users/quime/.codex/private/lysto-backups/2026-10-25-235352-874a32d2/restore-local`, con PostgreSQL detenido y ACL comprobada exclusivamente para el usuario actual y SYSTEM.

## Actualización del respaldo a 104

Se creó un snapshot independiente de 104 migraciones tras corregir la confirmación administrativa posterior al consentimiento/pago. Manifiestos en `C:/Users/quime/.codex/private/lysto-backups/20261026T022149Z-snapshot104-3f1821/backup-manifest.json` y `E:/Backups/Lysto/20261026T022149Z-snapshot104-3f1821/backup-manifest.json`; 16 archivos contrastados, fuentes 100–104 exactas y los 41 objetos de Storage coincidentes. Los respaldos 99/102 permanecen intactos. No se restauró este archivo completo y se conservan los límites de recuperación anteriores. [Detalle del correo y respaldo 104](2026-10-25-automatic-email-activation.md).

## Verificación final del candidato

| Comprobación | Resultado |
| --- | --- |
| Suite unitaria completa | **2.357/2.357 pruebas, 265/265 archivos**, cero fallos, omitidas o pendientes; exit 0. |
| Dominio | **174/174**. |
| Herramientas | **165/165**, sin omisiones; incluye los cuatro contratos del scheduler. |
| Tipos y lint | Aprobados. |
| Build de producción | Deployment final READY con el commit exacto; live/ready y navegación verificados antes y después de promover. |
| Dependencias de producción | **Cero avisos conocidos** de cualquier severidad en la auditoría final. |
| Runtimes de pagos e imágenes | Comprobaciones nativas aprobadas durante el arreglo. La de pagos hizo cero consultas DB y cero solicitudes al proveedor. |

La primera pasada sobre la base concurrente detectó tres pruebas del formulario anterior; se corrigieron y sus 25 casos pasaron antes de repetir toda la suite final. Los grupos enfocados no se suman al total unitario.

La corrida final publicada corresponde a `output/mail-release-final-unit.json`: 2.357 casos en 265 archivos, sin omitidas ni pendientes; tipos, lint, 174 controles de dominio y 165 de herramientas aprobados. Los 80 casos enfocados posteriores al ajuste de cálculo también pasaron antes de repetir toda la suite. La compilación ad231c2 se preparó sin dominio, se verificó live/ready, se promovió y se contrastó de nuevo con el dominio público. El pedido automático del cliente se recalculó después de publicar: HTTP 200/status ready/$195.000 y pago habilitado, sin pulsarlo. Ida/vuelta 0 km; no acredita el traslado a Berazategui. La captura automática falló por timeout del navegador; la evidencia conservada es la respuesta de red y el estado visible de la interfaz.

Evidencia final ignorada: `output/mail-release-final-public-health.json`, `mail-release-final-customer-smoke.json`, `mail-admin-104-active-observation.json`, `mail-admin-104-verify.json` y `mail-release-final-errors.jsonl`.

Evidencia local ignorada: `output/launch-final-acceptance.json`, `output/launch-final-acceptance.log`, `output/launch-final-acceptance-typecheck.log`, `output/launch-final-acceptance-audit.json`, `output/launch-publish-domain.log`, `output/launch-publish-tooling.log`, `output/launch-final-staged-smoke.json`, `output/launch-scheduler-observation.json`, `output/launch-production-inapp-recovery.json` y `output/launch-production-error-scan.log`.

## Pendientes expresos para la apertura

1. **Correo del servicio: resuelto.** Se verificaron dominio/DNS y seis entregas en Resend; el procesamiento automático está activo. Delivered no demuestra lectura ni ubicación en la bandeja principal. Ver el informe específico.
2. **Recorrido financiero real:** falta una nueva prueba de cobro, webhook y devolución en esta revisión. Las pantallas consultaron los pagos autorizados anteriores; las pruebas automáticas no sustituyen una operación real. No se hizo un cobro nuevo ni se modificaron sus importes.
3. **Cobertura geográfica:** el titular confirmó el punto censal de Calle 23 5871 y el servidor lo resolvió correctamente. La prueba administrativa detectó que el fallback Obelisco no era un origen válido. El pedido automático usa el origen del profesional asignado; se retiró la solicitud de una base general. La calculadora sin punto de salida mantiene el traslado sin verificar y el presupuesto en revisión, con alternativa de ruta manual verificada. Falta acreditar ida/vuelta reales distintas de cero en el recorrido automático; no es un fallo del destino confirmado.
4. **Recuperación completa y operación:** faltan restauración integral de servicios, custodia independiente del equipo, automatización de copias, RPO/RTO aceptados y alertas externas verificadas. Los advisors WARN siguen documentados. La suite integral protegida requiere un entorno aislado; no se ejecutó contra producción ni se falsificó evidencia de gates humanos/proveedor.

## Referencias oficiales

- [Next: Server Actions DoS](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r).
- [Next: imágenes y mitigación con sharp](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw).
- [Zod: consumo de recursos](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), [parche del proveedor](https://github.com/colinhacks/zod/pull/6652), [migración](https://zod.dev/v4/changelog).
- [Supabase Cron](https://supabase.com/docs/guides/cron), [HTTP síncrono](https://supabase.com/docs/guides/database/extensions/http), [Vault](https://supabase.com/docs/guides/database/vault), [backups y límites](https://supabase.com/docs/guides/platform/backups).
- [Funciones privilegiadas expuestas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
