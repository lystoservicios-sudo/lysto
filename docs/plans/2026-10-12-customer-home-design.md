# Inicio contextual del cliente

## Objetivo

Convertir `/app` en una pantalla operativa compacta: primero muestra decisiones y actividad reales; después mantiene accesos estables para pedir aire acondicionado y consultar el historial. El App Shell y la navegación inferior actual no cambian.

## Fuentes reales

- Solicitudes: `createCustomerQueries(...).list('requests')`.
- Trabajos: `listCustomerJobsLive`, vinculados por `requestId`.
- Presupuestos: `service_quotes`, limitados al cliente autenticado y a los registros recientes.
- Pagos: `marketplace_checkouts`, limitados al cliente autenticado; un trabajo no se presenta como pagable si el checkout inicial ya está aprobado.
- Visitas: RPC `get_job_visit`; solamente una respuesta confirmada puede producir “Próxima visita”.
- Hogares y equipos: `listCustomerAddresses` y `listCustomerEquipment`.
- Mantenimiento: `list_customer_maintenance`, conservando el trabajo que originó el plan para respetar bloqueos.
- Garantía y soporte: `list_support_cases`, sin exponer notas internas en la vista.

Cada fuente secundaria se carga de forma independiente. Un error parcial genera un aviso localizado y no se transforma en un estado vacío ni en una invitación falsa.

## Selección y prioridad

Una función pura normaliza el estado en elementos de Inicio. La clave de deduplicación usa las relaciones reales: trabajo → solicitud, presupuesto → solicitud y caso → trabajo. Para una misma contratación conserva solamente el elemento de mayor prioridad.

1. Decisiones: presupuesto listo, pago habilitado, diagnóstico/adicional, confirmación final o caso esperando al cliente.
2. Visita confirmada y actividad del trabajo.
3. Solicitud o presupuesto en revisión.
4. Borrador real. Mientras no exista recuperación, se informa como no recuperable y no se ofrece una acción falsa.
5. Mantenimiento y novedades de soporte.
6. Una sola invitación: domicilio primero; equipo después.

Las invitaciones se ocultan cuando hay una decisión o un borrador. “Ahora no” guarda por siete días una marca local con una clave compuesta por el identificador opaco del perfil y el tipo de invitación.

## Composición visual

- Sin saludo personal ni encabezado redundante: el contenido empieza por la actividad real, o por servicios cuando no hay actividad.
- Decisiones con estado ámbar discreto y acción azul; visitas con fecha y franja destacadas en una ficha de calendario. Los demás estados tienen menor peso visual.
- Acceso a aire acondicionado sobre una superficie azul suave, con iconografía de climatización y toda el área táctil.
- “Mis pedidos” usa filas agrupadas de presupuestos, solicitudes y trabajos porque todavía no existe una vista unificada.
- Invitación secundaria para domicilio o equipo, sin otra tarjeta exterior.
- Una familia tipográfica, pesos medios/semibold, escala de 12–22 px, espaciado de base 4 px y radios de 10–16 px. Sin sombras decorativas.
- Móvil en una columna; tablet/escritorio distribuyen actividad y accesos en dos columnas conservando el orden de lectura.
- Estados de carga/error coherentes; foco visible, controles de al menos 44 px y reserva inferior para que el último acceso no quede detrás de la navegación.

Las acciones siempre abren las pantallas existentes. No se acepta, paga ni confirma directamente desde Inicio.

La revisión visual toma como referencia la jerarquía tipográfica de [Material 3](https://m3.material.io/styles/typography/applying-type) y la claridad de las acciones de [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/buttons). Las guías de interface-design e Impeccable se aplicaron a densidad, jerarquía, superficies y accesibilidad, conservando la identidad existente.

Verificación visual local con escenarios de decisión, visita, usuario nuevo, varias contrataciones y error parcial; anchos de 360, 390, 430 y 1280 px. Los datos de captura son de demostración y no quedan en las rutas de producción.

## Variantes deliberadamente desactivadas

- Continuar borrador: el estado `draft` está persistido, pero `/app/solicitudes/:id` requiere un trabajo existente y el asistente no rehidrata ese borrador. Inicio lo reconoce sin simular recuperación.
- Novedad informativa genérica de soporte: sin marca de lectura fiable no se muestran casos históricos permanentemente. Sí se muestran casos que esperan al cliente y mantenimientos bloqueados por un caso abierto.
