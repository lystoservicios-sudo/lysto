import { PublicShell } from '@/components/layout/page-shell'
import { Card } from '@/components/ui/card'

const steps = [
  'Contás qué le pasa al equipo',
  'Subís fotos opcionales',
  'Recibís una orientación preliminar',
  'Elegís dirección, día y horario',
  'Revisás y aceptás el presupuesto',
  'Un profesional disponible acepta',
  'Pagás mediante Mercado Pago',
  'El profesional confirma alcance y adicionales',
  'Confirmás el cierre y recibís el comprobante'
]

export default function HowItWorksPage() {
  return (
    <PublicShell>
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <h1 className="text-4xl font-black text-slate-950 sm:text-5xl">Cómo funciona Lysto</h1>
        <p className="mt-4 text-lg leading-8 text-slate-600">
          Cada aceptación y cambio queda asociado al servicio. El diagnóstico preliminar orienta; el
          profesional confirma el trabajo en el domicilio. La reseña es opcional y se solicita
          después de la conformidad.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step, index) => (
            <Card key={step} className="p-5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-lysto-blue font-black text-white">
                {index + 1}
              </span>
              <p className="mt-4 font-black">{step}</p>
            </Card>
          ))}
        </div>
      </main>
    </PublicShell>
  )
}
