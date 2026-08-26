'use client'

import { useMemo, useState } from 'react'

import { ButtonLink } from '@/components/ui/button'
import type { CustomerDataState, CustomerRequestViewModel } from '@/features/customer/view-models'
import { cn } from '@/lib/utils/cn'
import { CustomerRequestSummaryCard } from './customer-request-summary-card'
import { EmptyState, ErrorState, LoadingSkeleton } from './states'

type RequestFilter = 'all' | 'drafts' | 'attention'

const draftStatuses = new Set(['draft', 'diagnosis_completed', 'address_completed', 'schedule_completed', 'price_selected'])

export function CustomerRequestList({ requests, state = 'ready', onRetry }: {
  requests: readonly CustomerRequestViewModel[]
  state?: CustomerDataState
  onRetry?: () => void
}) {
  const [filter, setFilter] = useState<RequestFilter>('all')
  const counts = useMemo(() => ({
    all: requests.length,
    drafts: requests.filter((request) => draftStatuses.has(request.status)).length,
    attention: requests.filter((request) => request.status === 'pending_payment').length
  }), [requests])
  const filtered = useMemo(() => requests.filter((request) => {
    if (filter === 'drafts') return draftStatuses.has(request.status)
    if (filter === 'attention') return request.status === 'pending_payment'
    return true
  }), [filter, requests])

  if (state === 'loading') return <LoadingSkeleton label="Cargando solicitudes" rows={5} />
  if (state === 'error') return <ErrorState title="No pudimos cargar tus solicitudes" description="Reintentá para recuperar el listado." onRetry={onRetry} />
  if (state === 'empty' || requests.length === 0) {
    return <EmptyState title="Todavía no tenés solicitudes" description="Cuando completes una solicitud, vas a encontrar acá su estado y próximo paso." action={<ButtonLink href="/app/solicitar/aire-acondicionado">Solicitar un servicio</ButtonLink>} />
  }

  const tabs: Array<{ id: RequestFilter; label: string; count: number }> = [
    { id: 'all', label: 'Todas', count: counts.all },
    { id: 'drafts', label: 'Borradores', count: counts.drafts },
    { id: 'attention', label: 'Requieren atención', count: counts.attention }
  ]

  return (
    <div className="space-y-5">
      <div role="group" aria-label="Filtrar solicitudes" className="flex max-w-full gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={filter === tab.id}
            onClick={() => setFilter(tab.id)}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2',
              filter === tab.id
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950'
            )}
          >
            {tab.label}
            <span className="rounded-full bg-white px-2 py-0.5 text-xs tabular-nums text-slate-700 ring-1 ring-slate-200">{tab.count}</span>
          </button>
        ))}
      </div>

      {filtered.length ? (
        <ul className="grid gap-4">{filtered.map((request) => <CustomerRequestSummaryCard key={request.id} request={request} />)}</ul>
      ) : (
        <EmptyState compact title="No hay solicitudes en este filtro" description="Probá con otra categoría para ver el resto de tus solicitudes." />
      )}
    </div>
  )
}
