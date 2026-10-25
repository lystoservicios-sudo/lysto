# Revisión previa a la apertura del 26 de octubre

Fecha: 25/10/2026, Argentina. Estado: **NO-GO para apertura general; correcciones verificadas, sin publicar**.

## Versión realmente revisada

La carpeta inicial estaba en `9596a95`, anterior a producción, y tenía cambios ajenos. Se conservaron. La consulta autenticada de Vercel identificó `dpl_DSDRbRpmyXctuGzdKfEuGidExXBA`, `READY`, rama `codex/customer-quote-unblock`, runtime `f8bd22c9728806d03e4b7c3fcb3a81e63d034d52`. El código base de la corrección es `b79eb2b77f746260ae2e764bf9dff099571a6a26`, que agrega la documentación de esa publicación.

Las correcciones están preparadas en un worktree propio, rama `codex/launch-readiness-20261025`, en `C:/Users/quime/.codex/worktrees/launch-readiness-20261025/Lysto`. No se revirtió ni se mezcló el trabajo local de la carpeta inicial. Las pruebas parciales de aquel checkout no acreditan el candidato publicado.

## Comprobado en producción

| Área | Resultado de esta revisión |
| --- | --- |
| Sitio público | La página de inicio carga y ofrece acceso a los servicios. |
| Cliente | Inicio, Servicios, Más y Pagos/comprobantes cargan. Se muestran cuatro movimientos existentes; desaparecieron los errores de información parcial de la auditoría anterior. |
| Presupuesto legado | El presupuesto aceptado de $1.000 abre y explica los datos no registrados, sin recalcular importes ni romper la pantalla. |
| Pedido | Equipo guardado → ubicación → detalles → orientación → visita → presupuesto. El caso de prueba de San Cristóbal para el 28/10, 10–12, ofrece $195.000 y habilita Mercado Pago. No se pulsó el botón de pago. El caso usa la ubicación de origen del profesional; no valida un viaje distinto de cero. |
| Separación de roles | Cliente → `/admin/dashboard` y `/pro/dashboard`: 404, sin contenido ajeno. |
| Profesional | Sesión MFA conservada; dashboard, cobros existentes y diagnóstico del trabajo asignado cargan. No se enviaron informes ni se cambiaron estados. |
| Administrador | El usuario volvió a iniciar sesión; dashboard, Gestión de pagos, enlaces al trabajo y Entrega de notificaciones cargan. El trabajo completado permite consultar el informe y diagnóstico aceptados de la prueba E2E anterior. La pantalla de avisos confirma 67 eventos: 65 en cola, dos procesados y ninguno muerto. |
| Supabase | Acceso real demostrado con `select 1`; proyecto `dqonlqcurvjnjgsczevu`, 97 migraciones, última `20261025195946`, 72 tablas públicas y cero tablas públicas sin RLS. |
| Advisors | 33 advertencias de seguridad y 38 de rendimiento, sin avisos de nivel error. Incluyen funciones privilegiadas expuestas, extensión en `public` y protección contra contraseñas filtradas no habilitada. No se alteraron permisos indiscriminadamente para eliminar advertencias. |
| Permisos de pagos | La regresión SQL comprueba las columnas que necesita el rol real `lysto_marketplace`; aprobada sin cambiar permisos ni impersonarlo. |
| Serialización de avisos | Regresión SQL de pendiente/aceptado/suprimido aprobada, sin insertar ni enviar eventos. |
| Registro y correo de acceso | Dashboard Owner: registro habilitado, confirmación de email obligatoria, acceso anónimo deshabilitado y SMTP personalizado habilitado. No se envió un correo de confirmación o recuperación durante esta pasada; configuración no equivale a entrega. |

Las sesiones usadas se conservan cifradas fuera del repositorio. Las capturas privadas de esta revisión están en `E:/Proyectos/GitHub/Lysto/output/launch-audit-2026-10-25/`; pueden mostrar datos de las cuentas y no deben publicarse indiscriminadamente.

## Bloqueos actuales

1. **Actualización de seguridad aún no publicada.** La auditoría del candidato público encontró Next 15.5.27 con un aviso crítico y otro alto, y Zod vulnerable en dos rutas. La mitigación sharp 0.35.5 ya estaba instalada para el aviso de imágenes; el aviso de Server Actions requiere actualizar Next. El candidato local usa Next y eslint-config-next 15.5.28 y Zod 4.6.6, también dentro del SDK de pagos. Su auditoría de dependencias de producción devuelve cero avisos conocidos.
2. **Notificaciones sin procesamiento acreditado.** La consulta SQL y la pantalla administrativa confirman 65 pendientes: 55 internos y diez emails. Todos tienen `available_at <= now()` y cero intentos; no son simplemente avisos programados para el futuro. El aviso interno más antiguo es del 25/09/2026 y el email más antiguo del 19/10/2026. Vercel devuelve `crons: []`; en la base inspeccionada no existe `cron.job`. Se necesita decidir y configurar el scheduler, revisar los destinatarios y la vigencia de la cola anterior, y comprobar una entrega autorizada. No se activó el worker ni se enviaron correos a terceros durante esta revisión. El SMTP de acceso de Supabase es un sistema distinto de esta cola de avisos del servicio.
3. **Recuperación sin demostrar.** La consulta autenticada de backups devuelve `backups: null`, `physical_backup_data: {}` y `pitr_enabled: false`. Esto no acredita un respaldo recuperable ni una restauración probada. Se necesita una estrategia de backup/restore comprobada antes de abrir al público.
4. **Cobertura y pruebas completas pendientes.** El incidente de geocodificación para una dirección numerada de Berazategui sigue documentado en la revisión del 25/10; no se reprodujo ese domicilio durante esta pasada. Tampoco se ejecutó un nuevo pago, webhook, devolución ni una visita real. Revisar esos límites antes de anunciar cobertura general.

La cuenta de Vercel consultada usa plan Hobby. No se contrataron planes ni se crearon compromisos de pago.

## Corrección local y validación

- Actualización puntual de Next y su configuración de ESLint. Se mantienen sharp 0.35.5 y PostCSS 8.5.26.
- Migración a Zod 4.6.6 preservando objetos estrictos, UUID, importes, permisos, mensajes, campos opcionales del proveedor y diccionarios parciales de tarifas/restauración.
- Una regresión nueva reprodujo el rechazo de respuestas válidas de ORS sin metadatos opcionales. El arreglo pasa. Otras regresiones verifican el corte de colecciones sobredimensionadas antes de recorrer sus elementos y los UUID válidos. Un audit limpio no demuestra que cualquier colección sin límite sea resistente a abuso.
- Corrección de una prueba inestable de recuperación de direcciones: las búsquedas de autocompletado ya no consumen el fallo simulado del PUT ni alteran el conteo de operaciones de guardado. No se cambió el comportamiento del producto para resolver ese fallo de prueba.
- Corrección de la etiqueta de enlaces de pago vencidos: administración y profesionales mostraban «Listo para pagar» para un checkout `ready` cuya fecha ya pasó. La vista ahora indica «Enlace vencido»; conserva aprobados/pendientes y no modifica datos ni inicia operaciones. Dos regresiones fallaron antes del cambio y las seis del panel pasan después, junto con retorno de pagos y espacio profesional (25 pruebas).
- Ocho comprobaciones antiguas del traductor de errores RPC usaban una visita dos días después del reloj fijo, anterior al mínimo de tres días hábiles. Se ajustó exclusivamente la fecha del fixture; las 44 comprobaciones del archivo pasan y siguen probando autorización, conflictos y privacidad de errores.
- La pasada completa identificó dos fixtures con UUID sin versión/variante válida: un trabajo sintético de pagos y una categoría sintética. Antes de corregirlos, se consultó producción: cero identificadores fuera del formato RFC en trabajos, categorías y tipos de problema. Se corrigieron exclusivamente esos dos fixtures; sus 41 pruebas pasan. No se relajó la validación ni se reescribieron identificadores de producción.
- Las herramientas regeneraron el inventario de API para reflejar las rutas ya existentes; no se agregaron endpoints.
- Revisión independiente del diff: sin hallazgos bloqueantes pendientes en los cambios revisados.

Resultados finales confirmados:

| Comprobación | Resultado |
| --- | --- |
| Suite unitaria completa del candidato | **2.271/2.271 pruebas, 251/251 archivos**, cero fallos, omitidas o pendientes; proceso terminó con código 0. |
| Dominio | **174/174**. |
| Herramientas | **160/160**, sin omisiones. |
| Tipos y lint | Aprobados. |
| Compilación final de producción | Aprobada, **115 páginas**, incluida la corrección de la etiqueta de pago. |
| Dependencias de producción | Auditoría con **cero avisos conocidos** después de la actualización. |
| Pagos e imágenes | Comprobaciones nativas aprobadas. La comprobación de pagos no hizo consultas a la base ni solicitudes al proveedor. |

Además pasaron las comprobaciones enfocadas durante el arreglo: 72 de compatibilidad/recuperación, 44 de errores RPC, 25 de pagos/espacio profesional y 41 de pagos/permisos con UUID válidos. Esos grupos se solapan con la suite completa y no se suman a su total. La evidencia local final está en `output/launch-unit-acceptance.json`, `output/launch-unit-acceptance.log`, `output/launch-build-final.log`, `output/launch-domain.log`, `output/launch-tooling.log` y `output/launch-audit-patched.json`; estos archivos de salida no se publican.

La validación del código no resuelve los bloqueos operativos anteriores. No se publicó el candidato ni se activó la cola de notificaciones. La apertura general requiere resolver esos puntos y comprobar los recorridos reales pendientes.

No se ejecutó la suite integral contra producción: sus protecciones requieren un entorno aislado. No se sustituyen esas evidencias por navegación de lectura ni por pruebas unitarias.

## Referencias oficiales

- [Next: Server Actions DoS](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r).
- [Next: imágenes y mitigación con sharp](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw).
- [Zod: consumo de recursos](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), [parche del proveedor](https://github.com/colinhacks/zod/pull/6652).
- [Migración de Zod](https://zod.dev/v4/changelog).
- [Funciones privilegiadas expuestas en Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [protección de contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
