'use client'

import { useMemo, useState } from 'react'

import Link from 'next/link'
import type { CustomerDataState, CustomerRequestViewModel } from '@/features/customer/view-models'
import { CustomerRequestSummaryCard } from './customer-request-summary-card'
import { MoreEmpty, moreStyles } from './more/more-ui'
import styles from './customer-secondary.module.css'

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

  if (state === 'loading') return <div className={styles.stack} role="status" aria-busy="true"><span className="sr-only">Cargando solicitudes</span>{[0, 1, 2].map((row) => <div key={row} className={moreStyles.skeleton} aria-hidden="true" />)}</div>
  if (state === 'error') return <div className={moreStyles.error} role="alert"><h2 className={styles.heading}>No pudimos cargar tus solicitudes</h2><p>Reintentá para recuperar el listado.</p>{onRetry ? <button className={moreStyles.textAction} type="button" onClick={onRetry}>Reintentar</button> : null}</div>
  if (state === 'empty' || requests.length === 0) {
    return <div><MoreEmpty title="Todavía no tenés solicitudes" description="Cuando completes una solicitud, vas a encontrar acá su estado y próximo paso." /><Link className={moreStyles.primary} href="/app/solicitar/aire-acondicionado">Solicitar un servicio</Link></div>
  }

  const tabs: Array<{ id: RequestFilter; label: string; count: number }> = [
    { id: 'all', label: 'Todas', count: counts.all },
    { id: 'drafts', label: 'Sin enviar', count: counts.drafts },
    { id: 'attention', label: 'Requieren atención', count: counts.attention }
  ]

  return (
    <div className={styles.stack}>
      <div role="group" aria-label="Filtrar solicitudes" className={moreStyles.filters}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={filter === tab.id}
            onClick={() => setFilter(tab.id)}
            className={styles.filterButton}
          >
            {tab.label}
            <span>{tab.count}</span>
          </button>
        ))}
      </div>

      {filtered.length ? (
        <ul>{filtered.map((request) => <CustomerRequestSummaryCard key={request.id} request={request} />)}</ul>
      ) : (
        <MoreEmpty title="No hay solicitudes en este filtro" description="Probá con otra categoría para ver el resto de tus solicitudes." />
      )}
    </div>
  )
}
