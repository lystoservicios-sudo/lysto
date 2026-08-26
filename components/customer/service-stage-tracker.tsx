import { Check, Circle, TriangleAlert } from 'lucide-react'

import type { JobStatus } from '@/lib/domain/types'
import { cn } from '@/lib/utils/cn'

const stages = ['Servicio confirmado', 'Profesional asignado', 'En camino', 'Llegada', 'Diagnóstico', 'Presupuesto', 'Trabajo', 'Cierre'] as const

const stageByStatus: Record<JobStatus, number> = {
  pending_assignment: 0,
  pending_professional_acceptance: 0,
  confirmed: 1,
  technician_on_way: 2,
  arrived: 3,
  onsite_diagnosis: 4,
  waiting_customer_approval: 5,
  in_progress: 6,
  completed_pending_customer_confirmation: 7,
  completed: 7,
  cancelled_by_customer: 0,
  cancelled_by_professional: 0,
  cancelled_by_admin: 0,
  disputed: 7,
  warranty_claim: 7
}

const errorStatuses = new Set<JobStatus>(['cancelled_by_customer', 'cancelled_by_professional', 'cancelled_by_admin', 'disputed'])

export function currentCustomerJobStage(status: JobStatus) {
  return stageByStatus[status]
}

export function ServiceStageTracker({ status }: { status: JobStatus }) {
  const current = stageByStatus[status]
  const isCompleted = status === 'completed'
  const hasError = errorStatuses.has(status)

  return (
    <ol aria-label="Etapas del servicio" className="grid gap-2 sm:grid-cols-4 xl:grid-cols-8">
      {stages.map((label, index) => {
        const stageState = isCompleted || index < current ? 'completed' : index === current ? hasError ? 'error' : 'current' : 'pending'
        const Icon = stageState === 'completed' ? Check : stageState === 'error' ? TriangleAlert : Circle
        return (
          <li key={label} aria-current={stageState === 'current' ? 'step' : undefined} className={cn('min-w-0 rounded-2xl border p-3', stageState === 'current' ? 'border-blue-200 bg-blue-50' : stageState === 'completed' ? 'border-slate-200 bg-white' : stageState === 'error' ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-slate-50')}>
            <Icon aria-hidden="true" className={cn('h-4 w-4', stageState === 'current' ? 'text-blue-700' : stageState === 'completed' ? 'text-emerald-600' : stageState === 'error' ? 'text-red-600' : 'text-slate-400')} />
            <span className={cn('mt-2 block text-xs font-bold leading-4', stageState === 'pending' ? 'text-slate-500' : 'text-slate-900')}>{label}</span>
          </li>
        )
      })}
    </ol>
  )
}
