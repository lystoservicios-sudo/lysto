import { PublicShell } from '@/components/layout/page-shell'
import { Card } from '@/components/ui/card'

const steps = ['Contás qué le pasa al equipo', 'Subís fotos o video opcional', 'Lysto genera diagnóstico preliminar', 'Elegís dirección, día y horario', 'Seleccionás Flexible o Prioridad', 'Pagás con Mercado Pago', 'Se asigna profesional verificado', 'Seguís estados del trabajo', 'Recibís comprobante, garantía y mantenimiento recomendado']

export default function HowItWorksPage() {
  return (
    <PublicShell>
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6"><h1 className="text-4xl font-black text-slate-950 sm:text-5xl">Cómo funciona Lysto</h1><p className="mt-4 text-lg leading-8 text-slate-600">Un flujo completo para que contratar un técnico sea simple, seguro y trazable.</p><div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{steps.map((step, index) => <Card key={step} className="p-5"><span className="grid h-9 w-9 place-items-center rounded-full bg-lysto-blue font-black text-white">{index + 1}</span><p className="mt-4 font-black">{step}</p></Card>)}</div></main>
    </PublicShell>
  )
}
