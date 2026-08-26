import { CalendarClock, ShieldAlert } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { CustomerQualityFollowupViewModel, CustomerUiTone } from '@/features/customer/view-models'

const badgeTones: Record<CustomerUiTone, 'blue' | 'green' | 'amber' | 'red' | 'slate'> = {
  brand: 'blue', success: 'green', warning: 'amber', danger: 'red', benefit: 'green', neutral: 'slate'
}
const dateFormatter = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeZone: 'UTC' })

export function QualityFollowupCard({ followup, onContact }: { followup: CustomerQualityFollowupViewModel; onContact?: (followupId: string) => void }) {
  const contactAvailable = followup.actionState === 'available' && Boolean(onContact)
  const contactMessage = followup.actionState === 'deferred'
    ? 'Canal de contacto pendiente de integración.'
    : followup.actionState === 'disabled'
      ? 'El contacto no está disponible para este seguimiento.'
      : !onContact
        ? 'La acción se habilitará cuando el canal esté conectado.'
        : null

  return (
    <article className="rounded-3xl border border-violet-200 bg-violet-50 p-5 text-violet-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><ShieldAlert aria-hidden="true" className="h-6 w-6 text-violet-700" /><p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-violet-700">{followup.equipmentName}</p><h3 className="mt-1 text-lg font-black">{followup.kind}</h3></div>
        <Badge tone={badgeTones[followup.statusView.tone]}>{followup.statusView.label}</Badge>
      </div>
      <p className="mt-3 text-sm leading-6 text-violet-900/80">{followup.summary}</p>
      <div className="mt-4 rounded-2xl bg-white/70 p-3"><p className="text-xs font-bold uppercase tracking-wide text-violet-700">Próximo paso</p><p className="mt-1 text-sm font-semibold leading-6">{followup.nextStep}</p></div>
      <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-violet-800"><CalendarClock aria-hidden="true" className="h-4 w-4" />Actualizado {dateFormatter.format(new Date(followup.updatedAt))}</p>
      <Button type="button" variant="secondary" size="sm" className="mt-4 w-full" disabled={!contactAvailable} onClick={() => onContact?.(followup.id)}>Contactar a calidad</Button>
      {contactMessage ? <p className="mt-2 text-center text-xs font-semibold text-violet-800">{contactMessage}</p> : null}
    </article>
  )
}
