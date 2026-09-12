# Calendario de mantenimiento

Estado: propuesta lista para asignar. Cada actividad necesita titular y suplente nominal antes del piloto; los roles indicados no identifican personas ni conceden acceso.

| Frecuencia / disparador | Actividad | Responsable / suplente | Evidencia |
| --- | --- | --- | --- |
| Cada turno y día operativo | cola, servicios, pagos inciertos, devoluciones, mensajes, reclamos, alertas y conciliación | Operaciones / suplente de turno; Finanzas / suplente financiero | entrega de turno y conciliación firmada |
| Cada despliegue | gates afectados, backup, migración, smoke, observación, switches y rollback | Técnica / guardia técnica | manifest, CI y deployment ID |
| Semanal | avisos de seguridad, errores repetidos, capacidad, costo, SLA y casos vencidos | Técnica + Operaciones / suplentes | acta y backlog priorizado |
| Mensual | permisos, cuentas inactivas, vigencia profesional, cuotas, retención y accesos de emergencia | Titular + Privacidad / segundo titular | revisión de accesos y bajas verificadas |
| Trimestral y tras cambios críticos | restore aislado, incidente y continuidad ejecutados por el suplente | Técnica / suplente de continuidad | RPO/RTO medidos y acciones |
| Al recibir aviso aplicable | parche, rotación de credencial comprometida y revisión de exposición | Seguridad/Técnica / guardia | incidente o release verificada |
| Tras cada ciclo del piloto | capacidad, costo, zonas, cupos, cancelaciones, revisitas y calidad | Dirección + Operaciones + Finanzas | decisión D01/D10 y alcance aprobado |

## Cadencia y seguimiento

Crear cada revisión en el sistema de trabajo aprobado con vencimiento, responsable nominal, suplente, enlace de evidencia y resultado. Un hallazgo crítico abre incidente; los demás reciben prioridad y fecha. Si una revisión vence sin suplente disponible, escalar al titular y no ampliar tráfico.

## Incorporación de un nuevo desarrollador

1. Obtener acceso personal de mínimo privilegio y leer `docs/architecture/ownership-map.md` y `docs/release/production-handover.md`.
2. Crear un checkout limpio con Node 22 y pnpm 9.15.0; instalar con lockfile congelado.
3. Usar configuración local o proyecto descartable. Nunca copiar secretos de producción al checkout.
4. Ejecutar lint, tipos, dominio, unitarias y tooling; para DB usar el procedimiento reproducible y confirmar que el destino no sea producción.
5. Practicar un release NO-GO, el cierre de entradas y el rollback en un entorno aislado.
6. Recibir acceso de producción sólo después de capacitación registrada, MFA y aprobación del dueño del sistema.

Las frecuencias cambian únicamente por decisión registrada según volumen y riesgo. Este documento no crea recordatorios ni asigna personas automáticamente.
