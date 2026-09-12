import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PublicShell } from '@/components/layout/page-shell'

const benefits = [
  'Profesionales revisados',
  'Cobro trazable',
  'Estados del servicio',
  'Historial del equipo',
  'Garantía según condiciones',
  'Casos de calidad'
]
const steps = [
  'Contás qué le pasa al equipo',
  'Recibís una orientación preliminar',
  'Elegís horario y aceptás presupuesto',
  'Un profesional acepta la asignación',
  'Pagás y seguís el trabajo'
]

export default function HomePage() {
  return (
    <PublicShell>
      <main>
        <section className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div className="space-y-7">
            <Badge tone="green">MVP operativo · Aire acondicionado · Buenos Aires</Badge>
            <div className="space-y-5">
              <h1 className="text-5xl font-black tracking-tight text-slate-950 sm:text-6xl">
                No metas a cualquiera en tu casa.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                Lysto gestiona servicios de aire acondicionado con profesionales revisados,
                presupuesto aceptado antes de la asignación, cobro confirmado antes de la visita e
                historial del trabajo.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/login" size="lg">
                Solicitar técnico
              </ButtonLink>
              <ButtonLink href="/servicios/aire-acondicionado" variant="secondary" size="lg">
                Ver servicio inicial
              </ButtonLink>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {benefits.map((benefit) => (
                <Card key={benefit} className="p-4 text-sm font-bold text-slate-700">
                  {benefit}
                </Card>
              ))}
            </div>
          </div>
          <Card className="relative overflow-hidden p-5 sm:p-7">
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-blue-100 blur-3xl" />
            <div className="relative space-y-5">
              <Badge tone="blue">Solicitud en curso</Badge>
              <h2 className="text-2xl font-black">Diagnóstico preliminar</h2>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="font-bold">Posible causa: carga de gas baja o filtros obstruidos</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  El técnico confirmará el diagnóstico en el domicilio antes de avanzar.
                </p>
              </div>
              <div className="grid gap-3">
                {steps.map((step, index) => (
                  <div
                    key={step}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-lysto-blue text-sm font-black text-white">
                      {index + 1}
                    </span>
                    <span className="text-sm font-semibold text-slate-700">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </section>
      </main>
    </PublicShell>
  )
}
