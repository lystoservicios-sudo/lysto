# T23 — Reclamos, garantías y calidad

## Resultado implementado

`complaints` es el expediente canónico. `warranty_claims` enlaza la evaluación de cobertura y `support_case_events` conserva una sola cronología. Cliente, profesional y operador se derivan de la sesión y del trabajo; el navegador no elige sus identidades.

La apertura clasifica severidad, asigna un vencimiento y guarda la política aplicada. Los plazos actuales quedan marcados como pendientes de las decisiones D02/D06 y no se presentan como atención continua. Evidencias sólo se aceptan si fueron verificadas por el flujo privado de cargas.

Las notas públicas y privadas se almacenan en columnas distintas. Los participantes reciben la cronología pública mediante el RPC; sólo operaciones y calidad reciben la nota interna. Las transiciones usan versión esperada, asignan responsable al comenzar la revisión y conservan fallos de comunicación y reaperturas.

La cobertura se calcula con `jobs.completed_at`, `jobs.warranty_until` y el informe final persistido. El último día se incluye. Un caso vencido o diferente se recibe como soporte sin prometer garantía. Una aprobación crea una nueva solicitud y un trabajo ligados al original, con `billing_policy=warranty_no_charge` y monto cero.

## Verificación pendiente

La prueba de dominio, tipado y lint se ejecutan localmente. La integración `support-warranty.test.ts` y pgTAP `support_case_operations.test.sql` quedan preparadas para el entorno Supabase desechable; Docker sigue indisponible en el host. La ratificación de horarios/SLA requiere D02/D06.
