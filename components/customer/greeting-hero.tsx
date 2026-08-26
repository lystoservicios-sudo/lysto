import { Home, Wrench } from 'lucide-react'
import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'

export function GreetingHero({ customerName, demoLabel, visual }: {
  customerName: string
  demoLabel?: string
  visual?: ReactNode
}) {
  return (
    <section className="grid overflow-hidden rounded-[2rem] border border-blue-200 bg-blue-50 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="p-5 sm:p-7 lg:p-8">
        <Badge tone="blue">{demoLabel ?? 'Tu hogar con Lysto'}</Badge>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Hola, {customerName}</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Pedí ayuda técnica, seguí una visita y conservá el historial de tus equipos desde un solo lugar.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <ButtonLink href="/app/solicitar/aire-acondicionado" size="lg">
            <Wrench aria-hidden="true" className="mr-2 h-5 w-5" />
            Solicitar servicio
          </ButtonLink>
          <ButtonLink href="/app/trabajos" variant="secondary" size="lg">Ver trabajos</ButtonLink>
        </div>
      </div>
      <div className="hidden border-l border-blue-200 bg-white/60 p-8 lg:grid lg:place-items-center" aria-hidden={visual ? undefined : true}>
        {visual ?? (
          <div className="grid h-36 w-36 place-items-center rounded-full border border-blue-200 bg-white text-blue-700">
            <Home className="h-16 w-16" />
          </div>
        )}
      </div>
    </section>
  )
}
