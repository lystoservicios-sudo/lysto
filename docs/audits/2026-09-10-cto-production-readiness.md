# Lysto — evaluación de preparación para producción

Fecha: 10 de septiembre de 2026, Buenos Aires. Evaluación del directorio de trabajo actual, incluidos cambios sin commit. Referencia Git: `6bbabd3`; el resultado NO describe únicamente ese commit.

**Dictamen: NO habilitar todavía la operación comercial con clientes reales.**

Lysto es un prototipo avanzado con un núcleo transaccional parcialmente conectado. Hay trabajo valioso en interfaz, reglas de negocio, base de datos y pagos. Sin embargo, el circuito completo de un servicio, la protección uniforme de accesos y la capacidad de resolver incidentes todavía no están demostrados. El siguiente hito debe ser un piloto operable y controlado.

No asigno un porcentaje global: contar pantallas o tests sobreestima la preparación. Un bloqueo en autenticación, cierre del servicio o recuperación del dinero impide lanzar aunque el resto esté construido.

| Modalidad | Decisión actual | Condición |
|---|---|---|
| Demostración interna supervisada | Viable en entorno controlado | Datos de prueba y funciones parciales identificadas |
| Piloto con clientes y dinero reales | No habilitado todavía | Completar los bloqueos de este informe y la aceptación en staging |
| Lanzamiento abierto y crecimiento | No habilitado | Piloto satisfactorio, operación de soporte y recuperación verificadas |

**Alcance y límites de la evidencia**

Revisé arquitectura, rutas, autenticación, persistencia, SQL, permisos, pagos, circuito del cliente y profesional, herramientas de operaciones, dependencias y configuración de calidad. Ejecuté compilación de producción, pruebas y consultas locales; comprobé pantallas en navegador y respuestas HTTP sin cookies.

No verifiqué la configuración efectiva de un despliegue remoto, backups remotos, cuentas comerciales ni credenciales de Mercado Pago. No ejecuté cobros reales, envié comunicaciones, apliqué migraciones remotas ni realicé una prueba de carga. Tampoco ejecuté la suite automatizada de navegador. Las inspecciones visuales fueron muestras, no una auditoría completa de accesibilidad o dispositivos. La falta de evidencia remota se registra como pendiente, no como prueba de que esos recursos no existan.

No hubo respuesta sobre volumen, fecha objetivo o dotación durante la revisión. Para planificar propongo, como hipótesis a validar, un piloto de 20–50 servicios, 3–5 profesionales, 1–2 operadores, una zona acotada y horario de atención definido.

**1. Lo que está construido y conviene conservar**

- Next.js, TypeScript y Supabase forman una base adecuada para este alcance. No encontré una necesidad que justifique reescribir el producto o pasar a microservicios antes del piloto.
- Hay reglas de estados, validaciones, presupuestos y transacciones reutilizables. Las funciones SQL importantes emplean comprobaciones de permisos y bloqueos para proteger cambios concurrentes.
- Los presupuestos nuevos conservan importes y aceptación en servidor. La asignación y respuesta del profesional tienen rutas conectadas a funciones de base de datos.
- La integración nueva de Mercado Pago contempla OAuth, cifrado de tokens, separación de prueba/producción, firmas, idempotencia, consulta canónica, conciliación manual y detección de discrepancias.
- En la base local inspeccionada, las 53 tablas de `public` tienen RLS activada. Esto es una condición positiva; no demuestra por sí solo que cada política sea correcta para todos los casos.
- Hay una inversión útil en pruebas de dominio, componentes, permisos y transacciones. Las pruebas específicas de pagos con PostgreSQL real también pasaron localmente.

**2. Madurez por capacidad**

| Capacidad | Evidencia actual | Falta para operar |
|---|---|---|
| Acceso y cuentas | Login real; controles de sesión en APIs nuevas | Protección de paneles y APIs antiguas, registro, recuperación, cierre de sesión y ciclo de permisos |
| Solicitud y presupuesto | Guardado, revisión, aceptación y creación de trabajo reales | Integrar el flujo con identidad/direcciones reales y evidencia adjunta; retirar valores de demostración |
| Asignación | Propuesta secuencial y aceptación/rechazo persistentes | Cola principal real, capacidad y agenda confiables, reasignación y excepciones |
| Trabajo en domicilio | Avance real hasta `in_progress`; adicionales aceptables | Informe final, evidencia, conformidad del cliente y cierre conectados |
| Cobro | Integración y pruebas locales sustanciales | Aceptación en cuenta del proveedor, ambientes, conciliación operativa y procedimiento de devolución |
| Administración | Panel amplio y módulo real de calculadora/presupuestos | La mayoría de listados y métricas siguen siendo demostrativos |
| Profesionales | UI móvil y propuestas reales | Alta e invitación persistentes; agenda, perfil, historial y cierre operativos |
| Garantías y reclamos | Reglas, esquema y pantallas | Gestión persistente, responsables, plazos, escalamiento y seguimiento |
| Notificaciones | Plantillas y base para inbox/outbox | Consumidor de cola, proveedor, reintentos, deduplicación y alertas de entrega |
| Mantenimiento técnico | Build, tipado, lint y pruebas locales aprobados | Release reproducible, pruebas integrales, observabilidad, restore y responsables |

**3. Bloqueos antes del primer cliente**

**B01 — Protección de accesos inconsistente. Prioridad crítica.**

El middleware devuelve `NextResponse.next()` incluso en rutas protegidas. Los layouts indican un rol visual pero no verifican una sesión. En la compilación local, sin cookies, `/admin/dashboard`, `/pro/dashboard` y `/app` devolvieron HTTP 200. El navegador mostró el dashboard administrativo completo con datos demostrativos.

Las APIs nuevas `/api/pricing/quotes` y `/api/mercadopago/checkouts` devolvieron correctamente 401. Por tanto, no afirmo que se haya demostrado acceso anónimo a datos financieros reales: el problema es la protección incompleta y la convivencia de contratos distintos.

Acción: centralizar sesión, rol y propiedad del recurso; aplicar controles en las lecturas y mutaciones del servidor y protección de navegación. Separar explícitamente la demostración. Verificar usuarios anónimos, cliente A contra cliente B, profesional ajeno/suspendido y operador sin permiso financiero. Incorporar MFA para administración dentro de la preparación del piloto.

Evidencia: [middleware.ts](E:/Proyectos/GitHub/Lysto/middleware.ts:5), [AppShell](E:/Proyectos/GitHub/Lysto/components/layout/page-shell.tsx:14), [sesión de precios](E:/Proyectos/GitHub/Lysto/lib/pricing/server.ts:8), [respuestas HTTP](E:/Proyectos/GitHub/Lysto/output/cto-audit-http.json). La [guía oficial de Next.js](https://nextjs.org/docs/app/guides/authentication) exige verificar autorización en los accesos de servidor y tratar los handlers como endpoints públicos.

**B02 — Alta y gestión de cuentas incompletas. Prioridad crítica.**

El formulario de registro no tiene envío ni acción de creación; el botón es visual. El login sí llama a Supabase y busca un perfil, pero no encontré un circuito implementado de recuperación de contraseña ni una acción de logout accesible al usuario. La invitación profesional genera un token de muestra y devuelve instrucciones de persistencia; el onboarding y la aprobación antiguos también son contratos parciales.

Acción: asegurar alta de cliente, identidad/perfiles consistentes, recuperación y salida; invitación de un solo uso, vencimiento, documentos, aprobación/suspensión y asignación de permisos administrativos. Un alta manual para el piloto es admisible sólo con procedimiento auditable, cuentas individuales y sin contraseñas compartidas.

Evidencia: [registro](E:/Proyectos/GitHub/Lysto/app/(auth)/registro/page.tsx:7), [login](E:/Proyectos/GitHub/Lysto/app/(auth)/login/actions.ts:33), [invitación](E:/Proyectos/GitHub/Lysto/app/api/admin/invite-professional/route.ts:4).

**B03 — Las pantallas principales no representan la operación real. Prioridad crítica.**

Los listados del cliente usan `customerDemoFixtures`; los administrativos y profesionales dependen de `lib/mock/lysto-data`. Los detalles distinguen registros reales de demostración según la forma del identificador: UUID frente a identificadores como `job_...`. Los registros reales se gestionan por módulos nuevos separados.

Consecuencia: un cliente puede tener una operación real y encontrar un historial demostrativo; un operador puede mirar métricas que no reflejan la carga real. El formato de un ID no debe decidir el origen de datos de producción.

Acción: conectar primero solicitud, trabajo, cliente, profesional, pago y cola diaria a una única fuente de datos; habilitar estados vacíos, errores, filtros y paginación. Retirar de producción los módulos que no estén conectados. La API de propuestas limita a 50 y la de pagos a 100 sin paginación: no asumir que esos listados incluyen toda la operación.

Evidencia: [trabajos cliente](E:/Proyectos/GitHub/Lysto/app/(customer)/app/trabajos/page.tsx:3), [modelo profesional](E:/Proyectos/GitHub/Lysto/components/pro/pro-model.ts:1), [listados admin](E:/Proyectos/GitHub/Lysto/components/admin/admin-lists.tsx:6), [detalle real/demo](E:/Proyectos/GitHub/Lysto/app/(customer)/app/trabajos/[id]/page.tsx:9), [propuestas](E:/Proyectos/GitHub/Lysto/app/api/pricing/offers/route.ts:7).

**B04 — Servicio sin cierre completo conectado. Prioridad crítica.**

El flujo nuevo avanza desde confirmado hasta trabajo en curso. `JobQuotePanel` no ofrece una operación persistente para informe final, conformidad y cierre. `/api/jobs/final-report` responde `accepted: true` y `ready_for_transactional_persistence`; no guarda el informe. Existe una función SQL y un adaptador de cierre aprovechables, pero falta integrarlos con el recorrido nuevo.

Acción: unir diagnóstico presencial, materiales, evidencia anterior/posterior, equipo, informe, estados pendientes, conformidad o disputa y cierre. Resolver cancelación, falta de repuesto, cliente ausente, rechazo, reasignación y pérdida de conexión. Probar reintentos sin duplicar acciones. Verificar cómo conviven el pago inicial y los adicionales con las condiciones de cierre.

Evidencia: [panel del trabajo](E:/Proyectos/GitHub/Lysto/components/pricing/job-quote-panel.tsx:47), [avance SQL](E:/Proyectos/GitHub/Lysto/supabase/migrations/20260910195050_service_quotes_and_onsite_extras.sql:212), [API de cierre](E:/Proyectos/GitHub/Lysto/app/api/jobs/final-report/route.ts:4), [adaptador de cierre](E:/Proyectos/GitHub/Lysto/lib/data-access/supabase/job-writes.ts:25).

**B05 — Comprobante público no valida su token. Prioridad crítica.**

La página `/comprobante/[token]` no recibe ni consulta el token. Muestra un servicio, profesional, fecha y garantía fijos. El esquema tiene una función de consulta de comprobantes que la página no utiliza.

Consecuencia: una URL arbitraria puede presentar un servicio de muestra como realizado. No se demostró filtración de datos reales; sí un problema de integridad y confianza.

Acción: consultar el comprobante real en servidor, limitar los campos publicados, exigir token válido y devolver ausencia para tokens inexistentes/revocados. Aclarar con el responsable contable la diferencia entre comprobante de servicio y documento fiscal.

Evidencia: [comprobante](E:/Proyectos/GitHub/Lysto/app/comprobante/[token]/page.tsx:6).

**B06 — APIs antiguas devuelven éxito sin persistir. Prioridad crítica.**

Hay 36 archivos de rutas API. En 19 encontré marcadores explícitos de persistencia pendiente; es un inventario textual, no un porcentaje de funcionalidad. Incluye cierre, reviews, garantías, equipos, invitaciones, notificaciones y acciones administrativas. Sin autenticar, `/api/jobs/update-status` devolvió 200 con un estado calculado y una instrucción para guardarlo después.

Acción: retirar, deshabilitar o conectar cada contrato. Una respuesta de éxito sólo debe representar una operación efectivamente registrada. La identidad del actor y el estado anterior deben obtenerse en servidor. No conectar directamente a la base las rutas que hoy confían en `adminProfileId`, `ownerId`, `currentStatus` o `paid` enviados por el cliente.

Evidencia: [actualización de estado](E:/Proyectos/GitHub/Lysto/app/api/jobs/update-status/route.ts:5), [asignación antigua](E:/Proyectos/GitHub/Lysto/app/api/admin/assign-professional/route.ts:42), [reviews](E:/Proyectos/GitHub/Lysto/app/api/reviews/submit/route.ts:13), [garantías](E:/Proyectos/GitHub/Lysto/app/api/warranty/claim/route.ts:1).

**B07 — Dependencias con avisos críticos. Prioridad crítica antes de exposición pública.**

La auditoría de dependencias de producción informó 9 avisos: 2 críticos, 4 altos y 3 moderados. Next.js instalado es 15.5.23. Los avisos críticos del mantenedor afectan servidores Windows y optimización de AVIF, respectivamente; ambos indican corrección en 15.5.24 dentro de esa rama. La aplicabilidad depende del alojamiento y de las funciones utilizadas; no ejecuté exploits ni demostré compromiso.

Acción: actualizar dentro de una rama compatible, revisar Next/Sharp/PostCSS/UUID, regenerar el lockfile y repetir build y pruebas. No hace falta migrar de versión mayor para corregir los avisos citados. Documentar la exposición residual de cualquier excepción.

Evidencia: [audit completo](E:/Proyectos/GitHub/Lysto/output/cto-audit-dependencies.json), [aviso oficial Windows](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36), [aviso oficial AVIF](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4).

**B08 — Pagos implementados localmente, aceptación comercial pendiente. Prioridad crítica.**

No corresponde describir la integración nueva como un simple mock: hay controles y pruebas locales reales. Tampoco corresponde declararla lista para dinero real. Faltan pruebas del proveedor con las cuentas y el dominio elegidos, comprobación de permisos/cargos efectivos y operación de incidentes. Las devoluciones se ejecutan en Mercado Pago y se sincronizan; eso puede servir al piloto con responsable y trazabilidad.

Acción: demostrar OAuth, vencimiento/renovación, pago aprobado, pendiente y rechazado, duplicados y eventos desordenados, caída de webhook, conciliación posterior, devolución parcial/completa y contracargo. Probar además el caso de reasignación tras generar un checkout: la base lo bloquea deliberadamente y se necesita un procedimiento de resolución. Separar prueba y producción también en registros y restauración de tokens.

La política inicial combina recargo del 30%, comisión del 18% y provisión de cobro del 6%. En el ejemplo documentado, el neto estimado del profesional queda por debajo del subtotal de costos. La provisión del 6% no es una tarifa confirmada del proveedor. Finanzas debe aprobar costos, netos y reglas antes de habilitar presupuestos; un margen calculado no acredita rentabilidad.

Evidencia: [integración](E:/Proyectos/GitHub/Lysto/lib/payments/marketplace.ts:1), [guards de asignación/pago](E:/Proyectos/GitHub/Lysto/supabase/migrations/20260910220000_marketplace_guards.sql:40), [operación de pagos](E:/Proyectos/GitHub/Lysto/docs/mercadopago-split.md), [operación de precios](E:/Proyectos/GitHub/Lysto/docs/pricing-operations.md).

**B09 — Evidencia, comunicaciones y posventa pendientes. Prioridad alta para el piloto.**

El endpoint de subida retorna `signedUrl: null`; el asistente informa que las fotos no se adjuntan. Las notificaciones generan plantillas, pero no encontré un proceso de aplicación que consuma la outbox ni un envío conectado. Garantías y reclamos tienen reglas y superficies, sin el circuito completo de atención persistente.

Acción: archivos privados con permisos por participante, límites, validación del contenido y limpieza de huérfanos; expediente de soporte con responsable, estado y tiempos. Elegir un canal inicial de comunicación con entrega verificable. La coordinación manual es aceptable durante el piloto si queda registrada y alguien controla cada pendiente. Automatizar recordatorios de mantenimiento puede esperar.

Evidencia: [subidas](E:/Proyectos/GitHub/Lysto/app/api/uploads/sign/route.ts:5), [notificaciones](E:/Proyectos/GitHub/Lysto/app/api/notifications/emit/route.ts:4), [outbox SQL](E:/Proyectos/GitHub/Lysto/supabase/migrations/202608190007_outbox_and_idempotency.sql).

**B10 — Release, recuperación y soporte técnico sin evidencia suficiente. Prioridad alta para el piloto.**

La CI configura lint, tipado, pruebas y build, pero no ejecuta pgTAP, las pruebas de pagos con PostgreSQL configurado, la suite E2E ni auditoría de dependencias. El único test E2E existente recorre una versión anterior del asistente: espera el título “Solicitar técnico de aire”; la página actual muestra “Solicitar servicio”. No lo conté como aprobado ni como suite ejecutada.

La base local tiene las tablas nuevas y los tests pasan, pero `supabase_migrations.schema_migrations` sólo enumera las siete versiones de agosto. Los tres archivos de septiembre no figuran allí. Esto exige reconciliar el estado y demostrar instalación/migración desde cero en un entorno descartable; no significa que sus objetos falten. No hice un reset destructivo de la base de trabajo.

No encontré configuración de observabilidad de aplicación, alertas operativas, healthcheck ni tareas programadas en el código revisado. No hay evidencia de una restauración ensayada. El directorio contiene muchos cambios sin commit, incluidas migraciones y el paquete vendorizado de pagos: el build local no demuestra que un checkout limpio de Git pueda reproducir este sistema.

Acción: release identificado e instalable desde cero; staging separado; migraciones versionadas y comprobadas; recuperación ante deploy fallido; alertas; backups y simulacro de restore. El respaldo debe incluir base, archivos y custodia de la clave que descifra OAuth. Supabase aclara que [los backups de base no incluyen los objetos de Storage](https://supabase.com/docs/guides/platform/backups).

Evidencia: [CI](E:/Proyectos/GitHub/Lysto/.github/workflows/ci.yml:1), [E2E actual](E:/Proyectos/GitHub/Lysto/tests/e2e/customer-flow.spec.ts:3), [gates declarativos](E:/Proyectos/GitHub/Lysto/lib/release/release-gates.ts:37), [guía de producción de Supabase](https://supabase.com/docs/guides/deployment/going-into-prod).

**4. Qué necesita una persona de operaciones cada día**

El objetivo de aceptación es que una persona capacitada pueda operar sin editar SQL ni pedir a desarrollo que complete una acción habitual.

| Necesidad | Entrega mínima verificable |
|---|---|
| Saber qué atender | Cola real con responsable, prioridad, antigüedad, próximo paso y vencimiento |
| Coordinar profesionales | Disponibilidad confirmada, asignación/rechazo, propuesta vencida y sustitución documentada |
| Resolver cambios | Reprogramar/cancelar con motivo, impacto de cobro y comunicación a las partes |
| Gestionar dinero | Estado canónico, desglose, pagos pendientes/discrepantes, conciliación y devolución trazable |
| Atender un reclamo | Expediente con evidencia, responsable, plazo, decisión y seguimiento |
| Auditar decisiones | Actor real, fecha, motivo y cambios previos/nuevos; acceso según permiso |
| Entregar el turno | Pendientes transferibles y alertas que otra persona pueda continuar |

Antes del piloto deben existir procedimientos breves para: cliente que pagó pero no tiene técnico; técnico ausente; cancelación con cobro; diferencia entre precio y alcance; adicional rechazado; trabajo sin conformidad; garantía; caída del sistema y sospecha de acceso indebido.

Asignar responsables concretos para producto/operación, técnica, finanzas/conciliación, calidad de profesionales y soporte. Una persona puede asumir varias funciones al inicio; cada función necesita suplente y criterio de escalamiento. Revisar con los responsables legales y contables términos, privacidad, garantía, cancelaciones, relación con profesionales y facturación antes de prometerlos públicamente. Este informe no acredita cumplimiento legal.

**5. Cómo mantener la aplicación durante los próximos meses**

Conservar un monolito modular. Consolidar el recorrido de servicio alrededor de las transacciones verificadas; reducir duplicación entre `lib/use-cases`, `lib/application`, `lib/workflows`, rutas antiguas y flujo nuevo. Definir para cada estado y cálculo cuál es la implementación autoritativa. El historial de pruebas antiguas no debe mantener contratos obsoletos por accidente.

Separar UI, autorización, operaciones de aplicación y persistencia. Usar respuestas tipadas y campos mínimos por rol. Sacar etiquetas compartidas de módulos de datos ficticios. Mejorar la legibilidad de los módulos densos de pagos/precios y registrar decisiones de arquitectura que afecten dinero, asignaciones y garantías.

| Frecuencia propuesta | Rutina | Responsable |
|---|---|---|
| Cada jornada operativa | Revisar servicios bloqueados, pagos discrepantes, entregas fallidas y reclamos | Operaciones + finanzas |
| Cada cambio | Revisión de código y controles obligatorios; identificar versión desplegada | Técnica |
| Semanal | Dependencias/avisos, errores repetidos, capacidad de DB y costo de proveedores | Técnica |
| Mensual | Accesos, cuentas suspendidas, costos por servicio y capacidad de soporte | Técnica + operación |
| Trimestral y antes del lanzamiento | Restauración completa y ensayo de incidentes, con tiempos medidos | Técnica + responsable de negocio |

Como objetivos iniciales de diseño, proponer detección de caída/error crítico en menos de 5 minutos, recuperación en menos de 4 horas y pérdida máxima de datos aceptable de 1 hora. Son metas a acordar y probar, no capacidades actuales ni compromisos comerciales. El negocio puede requerir mayor protección para pagos. Documentar también qué atención sigue siendo posible durante una caída.

Medir latencia y errores de APIs, conexiones de base, retraso de webhooks/outbox, trabajos sin profesional, tiempo hasta asignación, cancelaciones, revisitas, devoluciones y costo variable por servicio. Evitar datos personales/tokens en logs. Agregar límites de uso para login, presupuestos, consultas de mapas y otros endpoints que puedan generar abuso o costos.

El costo operativo debe incluir hosting, base, almacenamiento/transferencia de fotos, mapas, email/mensajería, monitoreo, backups, atención humana y excepciones. No estimar sólo la cuota de alojamiento. Revisar específicamente los pools de PostgreSQL y Prisma en el ambiente elegido; un build correcto no demuestra capacidad bajo concurrencia.

**6. Plan propuesto y esfuerzo**

Estimación de planificación, no compromiso de fecha. Supone reutilizar UI/SQL, alcance de aire acondicionado, decisión rápida del negocio y disponibilidad de cuentas externas. Días-persona de ingeniería; los rangos ya contemplan integración y revisión básica.

| Paquete | Prioridad / dependencia | Responsable | Esfuerzo orientativo | Criterio de salida |
|---|---|---|---|---|
| A. Release reproducible y dependencias | Primero | Técnica | 3–5 días | Instalación limpia, migraciones consistentes y riesgos críticos corregidos |
| B. Identidad, permisos y cuentas | Primero | Técnica | 5–8 días | Matriz de acceso negativa y altas/recuperación demostradas |
| C. Unificar pantallas y circuito real | Después de A/B | Full stack + operaciones | 10–15 días | Servicio completo hasta cierre, expediente e historial real |
| D. Pagos y excepciones | En coordinación con C | Backend + finanzas | 4–7 días | Casos del proveedor y conciliación/devolución aceptados |
| E. Archivos, avisos y herramientas de soporte | Con C | Full stack + operaciones | 5–8 días | Evidencia privada, comunicación y cola atendible |
| F. Staging, E2E, alertas y restore | A lo largo del plan; cierre al final | Técnica + QA | 6–10 días | Ensayo integral y recuperación con evidencia |

Total orientativo: **33–53 días-persona de ingeniería**. Para comprometer agenda reservaría **8–12 semanas con una persona senior dedicada**, o **5–8 semanas con dos desarrolladores con experiencia y apoyo parcial de QA/operaciones**, más un piloto supervisado de unas dos semanas. Hay trabajo paralelo, pero también dependencias; sumar personas no divide automáticamente el plazo. Validar estos rangos con una planificación detallada tras consolidar los cambios actuales. Aprobaciones externas pueden alargar el calendario.

Primera semana: consolidar versión, corregir riesgos de dependencias, definir origen único de datos, cerrar acceso anónimo, inventariar contratos parciales y acordar el recorrido mínimo con operaciones. No invertir esa semana en ampliar dashboards.

Se pueden diferir: matching automático avanzado, IA, nuevos rubros/zonas, analítica sofisticada, capacitación integrada y recordatorios automáticos. Pueden apoyarse manualmente en el piloto: revisión de profesionales, selección de técnico, coordinación telefónica y devolución desde el proveedor, siempre con permisos y registro. No se difieren autenticación, datos reales, integridad monetaria, cierre/evidencia, soporte responsable ni recuperación.

**7. Condiciones para autorizar el piloto**

- [ ] Una versión identificada se instala y migra en staging desde un checkout limpio.
- [ ] Usuarios anónimos o de otro rol/propietario no acceden a datos ni acciones privadas; operador sin finanzas no administra dinero.
- [ ] Cliente nuevo y profesional invitado pueden obtener acceso; recuperación, suspensión y revocación están probadas.
- [ ] Una solicitud real recorre presupuesto revisado, aceptación, asignación, pago, visita, adicionales, informe y cierre; reaparece correctamente en los tres roles tras recargar.
- [ ] Cancelación, técnico ausente, pendiente de repuesto, rechazo, disputa y reintento por mala conexión tienen salida operativa.
- [ ] Evidencia privada y comprobante por token funcionan; un token inventado no muestra un servicio válido.
- [ ] Mercado Pago acepta los casos acordados; no se aprueba por retorno del navegador ni se duplica un cobro por reintentar.
- [ ] Operaciones resuelve un caso normal y tres excepciones sin intervención de un desarrollador.
- [ ] Pruebas E2E de los tres roles y regresión de permisos/dinero se ejecutan como requisito de release.
- [ ] Alertas llegan al responsable; una restauración de base, archivos y material de cifrado fue ensayada.
- [ ] Tarifas, condiciones comerciales, soporte, cancelaciones y garantías tienen responsable y aprobación del negocio.
- [ ] El piloto tiene cupo, cobertura, horario, profesional suplente y mecanismo para detener nuevos cobros/solicitudes.

Para ampliar el piloto propongo exigir 20 servicios completos trazables, cero diferencias monetarias sin explicar, cero incidentes de acceso pendientes, ningún bloqueo crítico abierto y dos semanas de operación con revisión diaria. Son umbrales iniciales de gestión; no sustituyen pruebas de carga ni autorizan crecimiento ilimitado. Si hay acceso indebido, cobro duplicado o imposibilidad de recuperar el estado de servicios/pagos, detener nuevas operaciones y resolver el incidente.

**8. Resultado de las verificaciones de esta auditoría**

| Verificación ejecutada | Resultado | Límite de la conclusión |
|---|---|---|
| `corepack pnpm lint` | Aprobado, salida 0 | Calidad estática |
| `corepack pnpm typecheck` | Aprobado, salida 0 | Consistencia de tipos |
| `corepack pnpm test` | 124/124 dominio; 263 unitarios aprobados, 8 omitidos | Los omitidos requerían PostgreSQL configurado |
| Vitest de marketplace con DB local | 40/40 aprobados | Incluye los 8 omitidos antes; 32 ya estaban en la suite general. Proveedor externo sustituido en tests |
| `supabase test db --local` | 416/416, 9 archivos | Base local existente; no prueba instalación limpia ni staging |
| Build en directorio separado | Aprobado, salida 0; Next 15.5.23 | No demuestra despliegue remoto o bajo carga |
| HTTP anónimo contra build local | Paneles 200; APIs nuevas 401; contrato antiguo 200 | Confirma inconsistencia de acceso, sin acreditar fuga de datos reales |
| Navegador | Dashboard y solicitud accesibles sin login; interfaz demostrativa | Muestra de dos pantallas |
| Auditoría de dependencias productivas | 2 críticos, 4 altos, 3 moderados | Avisos de versiones; explotabilidad condicionada a la superficie |
| E2E automatizado, carga, proveedor real, restore | No ejecutados | Pendientes de aceptación |

Las pruebas unitarias emitieron una advertencia de actualización React fuera de `act` en el panel de cuenta de pagos. No hizo fallar la suite; conviene corregirla para que los tests asíncronos sean confiables.

Evidencia conservada: [build](E:/Proyectos/GitHub/Lysto/output/cto-audit-build.log), [base de datos](E:/Proyectos/GitHub/Lysto/output/cto-audit-database.log), [pagos](E:/Proyectos/GitHub/Lysto/output/cto-audit-marketplace.log), [HTTP](E:/Proyectos/GitHub/Lysto/output/cto-audit-http.json), [dependencias](E:/Proyectos/GitHub/Lysto/output/cto-audit-dependencies.json).

**Decisión de dirección técnica:** priorizar integridad, operación y recuperación. El activo existente es reutilizable. El trabajo pendiente requiere completar y verificar el producto operativo antes de abrirlo a clientes.
