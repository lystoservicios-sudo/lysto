# Acta GO / NO-GO de producción

Estado actual: **NO-GO**. Es una plantilla operativa; no contiene firmas ni aprobaciones. No habilita producción.

## Identidad del candidato

| Campo | Valor |
| --- | --- |
| Release ID | pendiente |
| Commit completo | pendiente |
| Hash de migraciones | pendiente |
| Artefacto / deployment ID | pendiente |
| Entorno y dominio | pendiente |
| Ventana | pendiente |
| Backup y restore verificado | pendiente |

## Gates

| Gate | Estado | Evidencia autenticada |
| --- | --- | --- |
| G01 Fuente reproducible | pendiente | pendiente |
| G02 Dependencias y secretos | pendiente | pendiente |
| G03 Base reproducible y permisos | pendiente | pendiente |
| G04 Identidad y autorización | pendiente | pendiente |
| G05 Alta y cuentas | pendiente | pendiente |
| G06 Solicitud hasta asignación | pendiente | pendiente |
| G07 Integridad financiera | pendiente | pendiente |
| G08 Servicio y posventa | pendiente | pendiente |
| G09 Interfaces y APIs reales | pendiente | pendiente |
| G10 Calidad automatizada y móvil | pendiente | pendiente |
| G11 Operación técnica | pendiente | pendiente |
| G12 Capacidad y costo | pendiente | pendiente |
| G13 Restauración y claves | pendiente | pendiente |
| G14 Staging y proveedor | pendiente | pendiente |
| G15 Autorización y operación | pendiente | pendiente |
| G16 Piloto y mantenimiento | pendiente; no requerido para abrir el piloto | pendiente |

## Decisiones, riesgos y exclusiones

Registrar D01–D12 con responsable, fecha, referencia y resultado. Enumerar riesgos no bloqueantes aceptados con impacto, mitigación, fecha de vencimiento y aprobador. Enumerar exclusiones D12 con el comportamiento visible comprobado. Un gate fallido o ausente no puede convertirse en riesgo aceptado.

## Decisión

- Resultado: **NO-GO**
- Cupo, zona y horario autorizados: pendiente
- Estado requerido de los interruptores al inicio: solicitudes cerradas; checkouts cerrados
- Criterios de detención y responsable: pendiente
- Dirección/titular comercial: pendiente
- Técnica/infraestructura: pendiente
- Operaciones y suplente: pendiente
- Finanzas: pendiente
- Privacidad/seguridad: pendiente

Para cambiar el resultado a GO, adjuntar el manifest de objetivo `pilot` validado contra la confianza protegida, firmas de responsables, backup comprobado, identidad del despliegue y plan de reversión. El autor del cambio no puede autoemitir esas aprobaciones.
