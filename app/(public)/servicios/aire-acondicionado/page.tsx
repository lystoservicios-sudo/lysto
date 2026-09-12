import { PublicShell } from '@/components/layout/page-shell'
import { ButtonLink } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AIR_CONDITIONING_ISSUES } from '@/lib/domain/constants'

export default function AirConditioningServicePage() {
  return (
    <PublicShell>
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <section className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <Badge tone="green">Servicio inicial sujeto a cobertura</Badge>
            <h1 className="mt-5 text-4xl font-black text-slate-950 sm:text-6xl">
              Servicio gestionado de aire acondicionado.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Reparación, instalación y mantenimiento según zona y capacidad disponibles. El
              presupuesto precede a la asignación, el cobro precede a la visita y la garantía aplica
              según las condiciones aceptadas.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/login" size="lg">
                Consultar disponibilidad
              </ButtonLink>
              <ButtonLink href="/como-funciona" variant="secondary" size="lg">
                Cómo funciona
              </ButtonLink>
            </div>
          </div>
          <Card className="p-6">
            <h2 className="text-2xl font-black">Problemas cubiertos</h2>
            <div className="mt-5 grid gap-3">
              {AIR_CONDITIONING_ISSUES.map((issue) => (
                <div key={issue.slug} className="flex gap-3 rounded-2xl bg-slate-50 p-4">
                  <span className="text-2xl">{issue.emoji}</span>
                  <div>
                    <h3 className="font-black">{issue.title}</h3>
                    <p className="text-sm text-slate-600">{issue.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>
        <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            'Documentación profesional revisada',
            'Fotos opcionales y privadas',
            'Presupuesto versionado',
            'Historial técnico del equipo'
          ].map((item) => (
            <Card key={item} className="p-5 font-black">
              {item}
            </Card>
          ))}
        </section>
      </main>
    </PublicShell>
  )
}
