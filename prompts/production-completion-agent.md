# Instrucción para el agente ejecutor — Lysto a producción

Ejecutá el plan de finalización de Lysto actuando como responsable técnico de implementación. El objetivo es que clientes, profesionales y operadores puedan trabajar con datos y dinero reales y que el sistema sea mantenible. Tu trabajo incluye código, DB, pruebas, configuración revisable, documentación operativa y evidencia; la habilitación externa se rige por las autorizaciones efectivas.

Repositorio: `E:/Proyectos/GitHub/Lysto`.

Leé primero:

1. [docs/plans/2026-09-10-production-completion.md](E:/Proyectos/GitHub/Lysto/docs/plans/2026-09-10-production-completion.md)
2. [docs/plans/2026-09-10-production-acceptance.md](E:/Proyectos/GitHub/Lysto/docs/plans/2026-09-10-production-acceptance.md)
3. [docs/plans/2026-09-10-production-progress.json](E:/Proyectos/GitHub/Lysto/docs/plans/2026-09-10-production-progress.json)
4. [docs/audits/2026-09-10-cto-production-readiness.md](E:/Proyectos/GitHub/Lysto/docs/audits/2026-09-10-cto-production-readiness.md)
5. Las instrucciones AGENTS.md y skills aplicables del entorno.

Usá `executing-plans` o su equivalente instalado. Empezá por T00 y continuá según dependencias, actualizando el registro entre tareas y sesiones. La base auditada contiene cambios sin commit sobre `6bbabd3`: preservalos antes de crear un worktree o checkout. No partas sólo de ese HEAD, no hagas reset/clean ni reescribas trabajo ajeno.

Reutilizá Next.js/Supabase, funciones SQL, presupuestos y ledger de Mercado Pago existentes. Implementá un único circuito persistente y autorizado para solicitud → presupuesto revisado/aceptado → profesional confirmado → cobro → visita → cierre técnico → conformidad → posventa, incluyendo cancelaciones, devoluciones, reprogramación y disputas. Cubrí las 69 páginas y 36 APIs iniciales, además de las nuevas.

Trabajá por incrementos con pruebas de comportamiento, permisos, concurrencia y reintento. Usá DB descartable para reset/fixtures/tests y validá el destino antes de operar. No cierres un punto por tener UI, un toast, código compilado, mock del producto o una prueba omitida. Nunca pongas gates en pass por defecto ni inventes aprobación comercial, datos financieros o consentimiento del proveedor.

No pidas confirmaciones para pasos técnicos rutinarios autorizados. Para decisiones D01–D12 faltantes, prepará la opción/configuración concreta, registrá el responsable y seguí otras tareas independientes. No publiques ni actives cobros reales sin autorización efectiva para esa acción; no envíes mensajes a terceros sin autorización. No pidas secretos por texto: usá el mecanismo seguro disponible.

Mantené comentarios de progreso breves y en español. En cada checkpoint registrá commit/entorno, archivos, tests ejecutados y resultado, evidencias, fallas, decisión faltante y siguiente paso exacto. Si cambia el código respecto al plan, verificá el hallazgo y documentá la adaptación en vez de implementar algo duplicado.

La salida se divide en TECHNICALLY_READY (G01–G13), PILOT_READY/PILOT_ENABLED (G01–G15 más activación autorizada) y GENERAL_PRODUCTION_READY (G01–G16 con piloto real y traspaso). No cierres el trabajo como producción general si sólo completaste código o staging. El tiempo del piloto no se simula.

Comenzá ahora con T00: verificá estado de trabajo, preservá la base y prepará el registro inicial. No vuelvas a pedirme elegir modalidad de ejecución. Continuá hasta completar todo lo ejecutable y dejá cualquier dependencia externa pendiente con razón y acción concreta, sin falsear el estado final.

