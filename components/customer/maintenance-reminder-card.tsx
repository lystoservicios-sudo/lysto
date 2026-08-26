'use client'

import { CalendarClock, CircleCheck, TriangleAlert } from 'lucide-react'
import { useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { CustomerMaintenanceViewModel } from '@/features/customer/view-models'
import { FormFeedback } from './states'

type OperationResult = { ok: boolean; message: string }
const dateFormatter = new Intl.DateTimeFormat('es-AR', { dateStyle: 'long', timeZone: 'UTC' })

const urgencyView = {
  overdue: { label: 'Vencido', tone: 'amber' as const, icon: TriangleAlert },
  soon: { label: 'Próximo', tone: 'amber' as const, icon: CalendarClock },
  planned: { label: 'Planificado', tone: 'blue' as const, icon: CalendarClock },
  none: { label: 'Sin recomendación vigente', tone: 'slate' as const, icon: CircleCheck }
}

export function MaintenanceReminderCard({ reminder, onRequest }: {
  reminder: CustomerMaintenanceViewModel
  onRequest?: (reminder: CustomerMaintenanceViewModel) => Promise<OperationResult>
}) {
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState<{ state: 'idle' | 'pending' | 'success' | 'error'; message?: string }>({ state: 'idle' })
  const pendingRef = useRef(false)
  const view = urgencyView[reminder.urgency]
  const Icon = view.icon
  const canRequest = reminder.urgency !== 'none' && reminder.actionState === 'available' && Boolean(onRequest)

  async function requestMaintenance() {
    if (!canRequest || !onRequest || pendingRef.current) return
    pendingRef.current = true
    setPending(true)
    setFeedback({ state: 'pending', message: 'Coordinando mantenimiento…' })
    try {
      const result = await onRequest(reminder)
      setFeedback({
        state: result.ok ? 'success' : 'error',
        message: result.message || (result.ok ? 'Solicitud de mantenimiento recibida.' : 'No pudimos coordinar el mantenimiento.')
      })
    } catch {
      setFeedback({ state: 'error', message: 'No pudimos coordinar el mantenimiento. Reintentá en unos minutos.' })
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  return (
    <article className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{reminder.equipmentName}</p>
          <h3 className="mt-2 text-lg font-black text-slate-950">{reminder.recommendation}</h3>
        </div>
        <Badge tone={view.tone}><Icon aria-hidden="true" className="mr-1 h-3.5 w-3.5" />{view.label}</Badge>
      </div>
      {reminder.dueAt ? <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-700"><CalendarClock aria-hidden="true" className="h-4 w-4 text-slate-500" /><time dateTime={reminder.dueAt}>{dateFormatter.format(new Date(reminder.dueAt))}</time></p> : <p className="mt-4 text-sm leading-6 text-slate-600">No hay una fecha sugerida para este equipo.</p>}
      {reminder.urgency !== 'none' ? (
        <div className="mt-auto pt-5">
          <Button type="button" className="w-full" disabled={!canRequest || pending} aria-busy={pending || undefined} onClick={() => void requestMaintenance()}>{pending ? 'Coordinando…' : 'Solicitar mantenimiento'}</Button>
          {!canRequest ? <p className="mt-2 text-center text-xs font-semibold leading-5 text-slate-500">La coordinación se habilitará cuando exista una acción conectada.</p> : null}
          {canRequest ? <FormFeedback state={feedback.state} message={feedback.message} className="mt-3" /> : null}
        </div>
      ) : null}
    </article>
  )
}
