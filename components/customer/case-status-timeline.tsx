import { Check, Clock3 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { CustomerCaseTimelineItem } from '@/features/customer/view-models'

const dateFormatter = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeZone: 'UTC' })
const stateView = {
  completed: { label: 'Completado', tone: 'green' as const },
  current: { label: 'En curso', tone: 'blue' as const },
  pending: { label: 'Pendiente', tone: 'slate' as const }
}

export function CaseStatusTimeline({ equipmentName, steps }: { equipmentName: string; steps: readonly CustomerCaseTimelineItem[] }) {
  return (
    <ol aria-label={`Seguimiento del reclamo de ${equipmentName}`} className="space-y-0">
      {steps.map((step, index) => {
        const view = stateView[step.state]
        return (
          <li key={step.id} className="relative flex gap-3 pb-5 last:pb-0" aria-current={step.state === 'current' ? 'step' : undefined}>
            {index < steps.length - 1 ? <span aria-hidden="true" className="absolute left-[0.9375rem] top-8 h-[calc(100%-1.5rem)] w-px bg-slate-200" /> : null}
            <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-600">
              {step.state === 'completed' ? <Check aria-hidden="true" className="h-4 w-4 text-emerald-700" /> : step.state === 'current' ? <Clock3 aria-hidden="true" className="h-4 w-4 text-blue-700" /> : <span className="text-xs font-black">{index + 1}</span>}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-black text-slate-950">{step.label}</p><Badge tone={view.tone}>{view.label}</Badge></div>
              {step.description ? <p className="mt-1 text-sm leading-6 text-slate-600">{step.description}</p> : null}
              {step.occurredAt ? <time dateTime={step.occurredAt} className="mt-1 block text-xs font-semibold text-slate-500">{dateFormatter.format(new Date(step.occurredAt))}</time> : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
