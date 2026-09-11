# ADR 001: ciclo de servicio y autoridad de mutación

Fecha: 2026-09-11. Estado: adoptado técnicamente según el plan aprobado; decisiones comerciales pendientes independientes.

El repositorio conservaba modelos y endpoints de simulación donde pagar creaba un trabajo pendiente de asignación, junto a SQL actual donde aceptar el presupuesto ya creaba ese trabajo y el checkout exigía profesional confirmado. Un helper de cierre también atribuía conformidad al cliente al recibir sólo un informe técnico.

Se adopta la secuencia presupuesto aceptado → asignación → profesional confirmado → pago verificado → visita → cierre técnico → conformidad → reseña opcional. La [tabla normativa](service-lifecycle.md) mapea las entidades al schema real, sin un enum de negocio paralelo.

La sesión determina identidad, SQL transaccional y triggers determinan propiedad/estado, el snapshot aceptado determina precio y el ledger canónico determina dinero. TypeScript sólo refleja capacidades. `payments.status = failed` no borra un contracargo observado; `review` bloquea decisiones aunque una proyección antigua permanezca aprobada.

El contexto del modelo mantiene `canonicalPaymentStatus: MarketplaceCheckoutStatus` separado de `paymentStatus: PaymentStatus`. El wrapper de transición sólo usa el primero para habilitar visita. Si falta el checkout canónico, deniega el avance; nunca completa el dato usando la proyección. El helper de simulación de aprobación registra explícitamente ambos estados y no acredita pagos persistidos.

La decisión de adicional se transmite por `customerApproved`, independiente del pago: ausencia o rechazo impiden iniciar el alcance adicional; aceptación explícita permite evaluar el avance. Una repetición del mismo pago canónico aprobado conserva el trabajo y los eventos, incluso si la visita ya avanzó; tampoco exige repetir una transición `approved → approved` en la proyección. El endpoint histórico `/api/pro/jobs/action` se retira por T06: hasta verificar ese retiro, este ADR no acredita que desapareció toda ruta pública simulada de avance profesional.

Se conservan las funciones SQL de presupuesto, oferta, avance y checkout y la transacción del ledger. Se retiran con 410 los cuatro contratos HTTP que únicamente simulaban acciones de este circuito. El simulador integral se mueve a pruebas y se elimina el duplicado sin consumidores de service-operations. Las etiquetas se trasladan a dominio para evitar importar fixtures desde la UI real.

Consecuencias: los clientes antiguos de esos cuatro POST deben usar los comandos canónicos; no se encontraron consumidores de producto activos. Los estados históricos siguen legibles, pero no autorizan nuevas transiciones por sí solos. El cierre técnico siempre espera conformidad y el silencio requiere una política D06 explícita que aún no se activa. Las implementaciones de cierre, extras, soporte y recuperación se completan en sus tareas; este ADR no las declara terminadas.

Recuperación: revertir adapters/etiquetas y modelos sólo en un entorno de prueba si se necesita investigar; no reactivar éxito simulado en producción. No se cambió schema ni se ejecutó un cobro. Cualquier ampliación SQL posterior sigue el protocolo de migraciones T03 y el contrato de este ADR.
