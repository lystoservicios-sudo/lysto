import type { Metadata } from 'next'
import { PolicyPage } from '@/components/public/policy-page'

export const metadata: Metadata = { title: 'Privacidad | Lysto', robots: { index: false } }

export default function Page() {
  return (
    <PolicyPage title="Privacidad">
      <section>
        <h2 className="text-xl font-black">Datos tratados</h2>
        <p>
          La operación necesita identidad y contacto, domicilio del servicio, datos del equipo,
          agenda, pagos, comunicaciones, informes y evidencia fotográfica que el usuario aporte. Se
          evita guardar credenciales completas del proveedor de pago y datos que no sean necesarios.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-black">Finalidades y acceso</h2>
        <p>
          Los datos se usan para prestar, cobrar, respaldar y mejorar el servicio, prevenir abuso y
          atender reclamos. Clientes, profesionales y equipos internos acceden según su función;
          cada sesión vuelve a comprobar identidad y permisos.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-black">Conservación y solicitudes</h2>
        <p>
          El plazo depende de la clase de dato, reclamos abiertos y obligaciones aplicables. Una
          solicitud de acceso, corrección o eliminación se registra, verifica y responde por el
          canal de ayuda. El historial contable y la evidencia necesaria para un reclamo pueden
          conservarse cuando corresponda.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-black">Proveedores y seguridad</h2>
        <p>
          Los proveedores de identidad, almacenamiento, correo, observación y pagos se documentan
          antes de producción. Los archivos son privados, los enlaces vencen y los registros
          técnicos redactan secretos y datos personales.
        </p>
      </section>
    </PolicyPage>
  )
}
