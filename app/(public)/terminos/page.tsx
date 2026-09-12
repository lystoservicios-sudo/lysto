import type { Metadata } from 'next'
import { PolicyPage } from '@/components/public/policy-page'

export const metadata: Metadata = { title: 'Términos | Lysto', robots: { index: false } }

export default function Page() {
  return (
    <PolicyPage title="Términos del servicio">
      <section>
        <h2 className="text-xl font-black">Servicio gestionado</h2>
        <p>
          Lysto gestiona la solicitud, el presupuesto, la asignación de un profesional habilitado en
          la plataforma, el cobro y el seguimiento. El diagnóstico inicial es orientativo; el
          alcance definitivo se confirma durante la visita.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-black">Presupuesto y adicionales</h2>
        <p>
          Antes de aceptar se informa alcance, importe en pesos argentinos, vigencia y condiciones.
          Un trabajo adicional requiere descripción, precio y aceptación independiente. El regreso
          del navegador o un mensaje del proveedor no acreditan por sí solos un pago.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-black">Profesionales y seguridad</h2>
        <p>
          Los profesionales completan un proceso de revisión. El cliente debe facilitar acceso
          seguro y advertir riesgos. Cualquiera de las partes puede detener la visita ante un riesgo
          físico y contactar al canal de ayuda.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-black">Cierre, reclamos y garantía</h2>
        <p>
          El cierre conserva informe y evidencia del trabajo. La garantía depende del alcance,
          fecha, exclusiones y condiciones aceptadas para ese servicio. Un reclamo abre un caso
          trazable; la reseña es opcional y no reemplaza la conformidad del trabajo.
        </p>
      </section>
    </PolicyPage>
  )
}
