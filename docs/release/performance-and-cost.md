# Capacidad, rendimiento y costo

Estado: medición técnica remota aprobada; D01/D10 y presupuesto nominal pendientes. Fecha de tarifas consultadas: 12/09/2026. Moneda de proveedores: USD, sin impuestos ni conversión.

## Hipótesis de lanzamiento

Estas cifras permiten ensayar el sistema; no autorizan escala ilimitada.

| Escenario | Servicios/mes | Clientes concurrentes | Operadores simultáneos | Profesionales activos | Fotos máximas estimadas |
| --- | ---: | ---: | ---: | ---: | ---: |
| Piloto/base | 60 | 5 | 2 | 5 | 300 × 5 MB |
| 2× | 120 | 10 | 4 | 10 | 600 × 5 MB |
| 5× | 300 | 25 | 8 | 25 | 1.500 × 5 MB |

La aceptación inicial propuesta sigue siendo 20 servicios completos durante al menos dos semanas. Dirección y operaciones deben aprobar cupo, zona, horarios y simultaneidad en D01. D10 debe aprobar volumen, SLO, alertas y presupuesto.

## Resultado medido en staging

El candidato runtime `ff9925959eab64dd40362e4aaff7bc6114a4ad6b`, deployment `dpl_BkgTPU5Nurei2dp8Q7DTMPvQEURN`, aprobó smoke, doble pico, ráfaga y recuperación sobre el alias protegido. La corrida sostenida de 60 minutos se ejecutó sobre el candidato inmediatamente anterior; los cambios posteriores eliminaron trabajo duplicado del mismo camino y sus perfiles más exigentes se repitieron sobre el candidato final.

| Perfil | Solicitudes | Fallos HTTP | Lectura p95 | Mutación p95 | Resultado |
| --- | ---: | ---: | ---: | ---: | --- |
| Pico | 4.598 | 0% | 943 ms | 815 ms | aprobado |
| Doble pico, candidato final | 14.062 | 0% | 759 ms | 874 ms | aprobado |
| Ráfaga, candidato final | 3.699 | 0% | 865 ms | 727 ms | aprobado |
| Sostenido 60 min | 27.916 | 0,018% | 815 ms | 734 ms | aprobado |
| Recuperación, candidato final | 194 | 0% | 740 ms | 655 ms | aprobado |

Después de recuperación hubo cero locks en espera, cero consultas activas de más de un segundo, cero deadlocks, cero conflictos y cero cuentas o perfiles sintéticos remanentes. La evidencia estructurada está en `docs/release/performance-verification.json`. Estos resultados completan la implementación técnica de T35; el volumen comercial y el gasto permitido todavía requieren D01 y D10.

## Perfil reproducible

`tests/load/service-platform.js` ofrece `smoke`, `peak`, `double_peak`, `burst` y `sustained`. Sólo acepta `TARGET_ENV=local|staging`, exige HTTPS remoto y una cookie de cliente sintético designado, y bloquea el host declarado como producción. Mide salud y lecturas autenticadas; la carga de mutación usa únicamente cálculo preliminar acotado. No crea checkouts, devoluciones, correos, subidas ni tráfico a Mercado Pago o mapas.

Ejecutar cada perfil contra el mismo candidato. Capturar reporte k6, CPU, memoria, conexiones DB/pooler, locks, consultas lentas, egress, backlog del outbox y cola operativa. Registrar p50/p95/p99 y error rate por endpoint. El tiempo del proveedor se mide por separado de la latencia propia.

Umbrales propuestos: p95 de lectura propia menor a 1 s, p95 de mutación propia menor a 2 s, menos de 1% de respuestas fallidas y cero errores de integridad. Ejecutar pico, 2× pico, ráfaga, 60 minutos sostenidos y recuperación. Un resultado local no sustituye staging.

## Presupuesto verificable

| Rubro | Base publicada | Base/2×/5× antes de excedentes |
| --- | --- | --- |
| Supabase Pro | desde USD 25/mes; 100 GB Storage, 250 GB egress, 100.000 MAU, DB de 8 GB; spend cap por defecto | USD 25 si el uso medido permanece incluido |
| Vercel Pro, si D04 lo elige | USD 20/mes por la plataforma, un asiento de despliegue y USD 20 de crédito de uso | USD 20 más consumo que supere el crédito |
| Resend Pro, si D06 lo elige | USD 20/mes por 50.000 emails; USD 0,90 por cada 1.000 adicionales | USD 20; el escenario 5× estimado en 2.400 emails sigue dentro del plan |
| Mercado Pago | tarifa variable por medio/plazo y cuenta; la comisión del proveedor se descuenta al vendedor antes de la comisión marketplace | pendiente de cotización D05/D11; nunca tratarla como cero |
| Dominio, monitoreo, mapas y soporte | según proveedor y consumo real | pendiente de D04/D10 |
| Operación humana | horas de operadores, finanzas, calidad, guardia y soporte | `horas × tarifa aprobada`; pendiente de dotación D01/D02 |

Piso ilustrativo de infraestructura con los tres proveedores pagos anteriores: USD 65/mes más dominio, mapas, monitoreo, impuestos, Mercado Pago y trabajo humano. No es una cotización ni un presupuesto aprobado. Verificar las tarifas al ejecutar y guardar factura/captura saneada.

Fuentes oficiales: [Supabase Pricing](https://supabase.com/pricing), [Vercel Pro Plan](https://vercel.com/docs/plans/pro-plan), [Resend Pricing](https://resend.com/pricing), [Mercado Pago Marketplace](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/how-tos/integrate-marketplace).

## Límites y escalamiento

Mantener el spend cap de Supabase y las notificaciones de gasto del host. Alertar al 50%, 75% y 90% del presupuesto aprobado. Escalar sólo después de identificar CPU, memoria, pool, I/O, locks, egress o proveedor como cuello. El pool propio de pagos está limitado a cuatro conexiones por instancia; sumar conexiones de todas las instancias antes de compararlas con el pooler.

No habilitar 2× o 5× si falla un SLO, aparece una violación de integridad, el backlog no vuelve a cero o el costo unitario no fue conciliado. El costo por servicio es `(infraestructura atribuible + proveedor + operación humana) / servicios completos`, presentado junto al ingreso propio neto definido en D05.
