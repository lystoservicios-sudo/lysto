# Presupuestos y adicionales

La calculadora está en `/admin/calculadora`, accesible desde Precios. El cliente consulta y acepta en `/app/presupuestos`; el profesional encuentra sus propuestas en `/pro/presupuestos`. Las pantallas demostrativas preexistentes conviven con los nuevos registros reales.

## Operación

1. El cliente informa síntoma, equipo, domicilio, accesos y horario. Guarda una estimación para revisión; no se registra un pago.
2. Operaciones abre el presupuesto, confirma el alcance técnico y recalcula una nueva versión con materiales, repuestos y traslado. Puede incorporar varios materiales. El original queda conservado.
3. Finanzas mantiene las tarifas, su fuente y vigencia en la calculadora. La imagen CAIM es una referencia de mano de obra; los valores iniciales necesitan validación comercial. No existe una conexión implementada a CAIM ni a un proveedor de repuestos. No se actualizan precios históricos.
4. Operaciones verifica el alcance y documenta su revisión. Un presupuesto incompleto, vencido o fuera de cobertura no se ofrece. El cliente acepta la versión guardada sin enviar importes desde su navegador.
5. Operaciones propone el trabajo a un profesional aprobado. Este ve el desglose y puede aceptar o rechazar; el rechazo devuelve el trabajo a asignación. La asignación es secuencial, sin difusión automática a múltiples técnicos ni envío de mensajes.
6. Durante la visita, el profesional registra otra falla, alcance e importe. El cliente acepta o rechaza. Cada adicional tiene comisión y recargo de Lysto iguales a cero: el 100% corresponde al profesional antes de cargos de Mercado Pago. La aceptación no confirma cobro. El presupuesto inicial no cambia.

## Cálculo

`(mano de obra + dificultad/prioridad + materiales + traslado ida/vuelta) × 1,30`

El 30% se aplica una sola vez, incluso sobre materiales y traslado. Se conserva la comisión inicial existente del 18% del total. Con esa combinación el técnico recibe el 106,6% del subtotal antes de cargos de Mercado Pago. El proveedor descuenta sus cargos de la parte del técnico; con una provisión del 6% del total, su neto sería 98,8% del subtotal, por lo que requiere revisar costos y comisión antes de ofrecer. La provisión inicial de costo de cobro del 6% es configurable y **no es una tarifa verificada de Mercado Pago**. La contribución indicada tampoco equivale a ganancia neta después de todos los gastos.

La antigüedad del síntoma no encarece por sí sola el servicio. Los síntomas no constituyen diagnósticos: operaciones confirma el procedimiento. Un compresor sin precio de repuesto compatible exige cotización técnica; el sistema no inventa ese importe. Un alcance no cubierto por el catálogo debe incorporarse con costos verificados antes de ofrecerse.

Google aporta kilómetros, duración y peajes disponibles; Lysto calcula el costo con su propia tarifa. No es una tarifa de Uber. Se consulta ida y vuelta, suponiendo una visita de dos horas para estimar la salida del regreso. La base debe estar en CABA; la cobertura admite CABA y provincia de Buenos Aires con hasta 180 minutos de ida. Operaciones puede cargar un trayecto verificado para el domicilio y horario concretos. Las rutas de simulación nunca se aprueban.

## Activación por ambiente

- Aplicar `supabase/migrations/20260910195050_service_quotes_and_onsite_extras.sql` mediante el flujo habitual de migraciones. Se verificó localmente; no se aplicó a la base remota.
- Configurar las credenciales existentes de Supabase y `SUPABASE_SERVICE_ROLE_KEY` solamente en el servidor. Los clientes usan sesión real, RLS y funciones con comprobación de rol. El modo demo no puede guardar propuestas como si fueran reales.
- Configurar `GOOGLE_MAPS_SERVER_API_KEY` con Geocoding API y Routes API habilitadas y `LYSTO_ROUTING_ORIGIN` con la base de salida en CABA. Restringir la clave para uso del servidor. Sin clave, el cálculo queda parcial y el traslado requiere revisión manual; nunca se presenta como un viaje gratuito confirmado.
- Validar costos de mano de obra, movilidad, peajes, repuestos y provisión de cobro con el negocio. Completar fuente y vigencia de tarifas.
- La pasarela split está implementada; consultar `docs/mercadopago-split.md` para activar credenciales y cuentas. La carga persistente de las fotos del asistente de solicitud sigue pendiente. No se generan pagos ficticios ni se da por cobrado un adicional.

La antigua ruta `/api/service-request/preview` devuelve 410. La antigua función de creación con importes del cliente perdió permisos de ejecución; no se debe reabrir como alternativa. El cálculo anterior queda únicamente para pruebas y simulaciones heredadas.

## Validación

- `npm test -- --maxWorkers=2 --minWorkers=1`: pruebas de dominio y componentes.
- `npm run typecheck`, `npm run lint`, `npm run build`.
- `supabase test db`: controles de permisos y transacciones, incluido `service_quotes.test.sql`.
- `node --experimental-strip-types scripts/pricing-simulation.ts`: genera el informe, resumen y matriz CSV en `output/pricing/`.

La comparación recorre 301.056 combinaciones con el mismo destino y el mismo traslado sintético. El informe explicita las hipótesis y los costos pendientes. No constituye una lista de precios finales aptos para cobrar.
