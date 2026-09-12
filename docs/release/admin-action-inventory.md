# Inventario de consola administrativa

| Ruta | Permiso | Fuente o servicio canónico | Acción operativa |
| --- | --- | --- | --- |
| `/admin/dashboard` | operations | `list_operator_queue` | abrir y priorizar cola |
| `/admin/solicitudes` | operations | read repository + presupuesto | revisar solicitud y presupuesto |
| `/admin/trabajos` | operations | read repository + workflow de trabajo | seguir visita y cierre |
| `/admin/matching` | operations | ofertas de servicio | asignar oferta aceptada |
| `/admin/zonas` | operations | catálogo de zonas | consultar cobertura vigente |
| `/admin/profesionales` | operations | workflow profesional | revisar y administrar estado |
| `/admin/profesionales/invitaciones` | operations | invitaciones durables | invitar y revocar |
| `/admin/clientes` | operations | perfiles y activos autorizados | buscar contexto del cliente |
| `/admin/equipos` | operations | read repository | consultar equipo registrado |
| `/admin/calidad` | quality | support case workflow | priorizar y resolver casos |
| `/admin/reclamos` | quality | support case workflow | gestionar reclamos |
| `/admin/garantias` | quality | warranty/support workflow | validar y resolver garantía |
| `/admin/auditoria` | owner | audit workflow | consultar acciones administrativas |
| `/admin/pagos` | finance | payment panel + ledger | consultar cobros |
| `/admin/pagos/split` | finance | financial exception workflow | conciliar y devolver |
| `/admin/reportes` | operations | cola y conteos del servidor | revisar carga operativa vigente |
| `/admin/precios` | finance | pricing calculator | consultar cálculo versionado |
| `/admin/marketplace` | finance | payment panel | consultar liquidación canónica |
| `/admin/servicios` | operations | catálogo de servicios | consultar oferta vigente |
| `/admin/diagnostico` | operations | catálogo de preguntas | consultar reglas orientativas |
| `/admin/notificaciones` | operations | delivery operations | reintentar y revisar entregas |
| `/admin/configuracion` | owner | permissions workflow | administrar permisos con MFA |

Las rutas financieras comparten el mismo ledger y los módulos de precio; las rutas de calidad comparten el mismo caso durable. Los componentes de compatibilidad antiguos no contienen datos ni mutaciones propias.
