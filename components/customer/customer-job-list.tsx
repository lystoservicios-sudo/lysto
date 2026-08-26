'use client'

import { BriefcaseBusiness } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { CustomerDataState, CustomerJobViewModel } from '@/features/customer/view-models'
import { ButtonLink } from '@/components/ui/button'
import { CountTabs } from './count-tabs'
import { CustomerJobCard } from './customer-job-card'
import { EmptyState, ErrorState, LoadingSkeleton } from './states'

type JobFilter = 'active' | 'confirmation' | 'completed'

const confirmationStatuses = new Set(['waiting_customer_approval', 'completed_pending_customer_confirmation'])
const completedStatuses = new Set(['completed', 'cancelled_by_customer', 'cancelled_by_professional', 'cancelled_by_admin'])

function jobFilter(job: CustomerJobViewModel): JobFilter {
  if (confirmationStatuses.has(job.status)) return 'confirmation'
  if (completedStatuses.has(job.status)) return 'completed'
  return 'active'
}

export function CustomerJobList({ jobs, state = jobs.length ? 'ready' : 'empty', onRetry }: {
  jobs: readonly CustomerJobViewModel[]
  state?: CustomerDataState
  onRetry?: () => void
}) {
  const [filter, setFilter] = useState<JobFilter>('active')
  const counts = useMemo(() => ({
    active: jobs.filter((job) => jobFilter(job) === 'active').length,
    confirmation: jobs.filter((job) => jobFilter(job) === 'confirmation').length,
    completed: jobs.filter((job) => jobFilter(job) === 'completed').length
  }), [jobs])
  const visibleJobs = useMemo(() => jobs.filter((job) => jobFilter(job) === filter), [filter, jobs])
  const tabs = [
    { id: 'active' as const, label: 'Activos', count: counts.active },
    { id: 'confirmation' as const, label: 'Por confirmar', count: counts.confirmation },
    { id: 'completed' as const, label: 'Finalizados', count: counts.completed }
  ]

  if (state === 'loading') return <LoadingSkeleton label="Cargando trabajos" rows={6} />
  if (state === 'error') return <ErrorState title="No pudimos cargar tus trabajos" description="Reintentá para recuperar el seguimiento de tus servicios." onRetry={onRetry} />
  if (state === 'empty') return <EmptyState title="Todavía no tenés trabajos" description="Cuando un servicio esté confirmado, vas a poder seguirlo desde acá." action={<ButtonLink href="/app/solicitar/aire-acondicionado">Solicitar un servicio</ButtonLink>} />

  return (
    <div className="space-y-4">
      <CountTabs items={tabs} value={filter} onValueChange={setFilter} label="Filtrar trabajos" panelId="customer-jobs-panel" />
      <div id="customer-jobs-panel" role="tabpanel" aria-labelledby={`tab-${filter}`} className="grid gap-4">
        {visibleJobs.length ? visibleJobs.map((job) => <CustomerJobCard key={job.id} job={job} />) : (
          <EmptyState compact title="No hay trabajos en este estado" description="Elegí otra pestaña para revisar el resto de tus servicios." icon={<BriefcaseBusiness aria-hidden="true" className="h-5 w-5" />} />
        )}
      </div>
    </div>
  )
}
