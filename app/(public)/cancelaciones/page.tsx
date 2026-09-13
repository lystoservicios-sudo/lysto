import type { Metadata } from 'next'
import { PolicyPage } from '@/components/public/policy-page'

export const metadata: Metadata = { title: 'Cancelaciones | Lysto', robots: { index: false } }

export default function Page() {
  return (
    <PolicyPage title="Cancelaciones, reprogramaciones y reintegros">
      <section>
        <h2 className="text-xl font-black">Antes de la asignación</h2>
        <p>
          La solicitud puede cancelarse mientras no exista una prestación iniciada. Si el cobro no
          fue confirmado, no se presume un cargo. Si existe un pago, finanzas determina el reintegro
          desde el ledger canónico.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-black">Con visita coordinada</h2>
        <p>
          Las reglas de plazo, ausencia, traslado y reprogramación deben mostrarse y aceptarse con
          el presupuesto. Un cambio conserva el historial y la capacidad reservada; no se promete
          disponibilidad automática.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-black">Durante el trabajo</h2>
        <p>
          El profesional no puede ejecutar adicionales sin aceptación. Si aparece un riesgo,
          repuesto pendiente o desacuerdo de alcance, el caso pasa a revisión y se registra la
          evidencia disponible.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-black">Reintegros</h2>
        <p>
          Una devolución usa el medio y las capacidades del proveedor de pago, queda trazada y puede
          demorar en reflejarse. Los plazos, cargos y excepciones definitivos se publican sólo
          después de aprobación comercial y legal.
        </p>
      </section>
    </PolicyPage>
  )
}
