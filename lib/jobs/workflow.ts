import { customerJobStatusLabels } from '../domain/job-status-labels.ts'
import type { JobStatus } from '../domain/types.ts'
import { assertTransition, jobTransitions } from '../domain/state-machine.ts'

export type JobAction = {
  to: JobStatus
  label: string
  danger?: boolean
  requiresFinalReport?: boolean
  requiresCustomerApproval?: boolean
}

const actionLabels: Partial<Record<JobStatus, JobAction>> = {
  pending_professional_acceptance: { to: 'pending_professional_acceptance', label: 'Enviar al profesional' },
  confirmed: { to: 'confirmed', label: 'Aceptar trabajo' },
  pending_assignment: { to: 'pending_assignment', label: 'Devolver a asignación' },
  technician_on_way: { to: 'technician_on_way', label: 'Marcar en camino' },
  arrived: { to: 'arrived', label: 'Llegué al domicilio' },
  onsite_diagnosis: { to: 'onsite_diagnosis', label: 'Iniciar diagnóstico' },
  waiting_customer_approval: { to: 'waiting_customer_approval', label: 'Cargar presupuesto final', requiresCustomerApproval: true },
  in_progress: { to: 'in_progress', label: 'Iniciar trabajo' },
  completed_pending_customer_confirmation: { to: 'completed_pending_customer_confirmation', label: 'Terminar y pedir confirmación', requiresFinalReport: true },
  completed: { to: 'completed', label: 'Confirmar completado' },
  disputed: { to: 'disputed', label: 'Abrir disputa', danger: true },
  warranty_claim: { to: 'warranty_claim', label: 'Abrir garantía', danger: true },
  cancelled_by_admin: { to: 'cancelled_by_admin', label: 'Cancelar desde admin', danger: true },
  cancelled_by_customer: { to: 'cancelled_by_customer', label: 'Cancelar cliente', danger: true },
  cancelled_by_professional: { to: 'cancelled_by_professional', label: 'Rechazar/cancelar', danger: true }
}

export function nextJobActions(status: JobStatus): JobAction[] {
  return jobTransitions[status].map((to) => actionLabels[to] ?? { to, label: to })
}

export type JobTransitionContext = {
  /** Canonical marketplace_checkouts.status; never payments.status or browser input. */
  canonicalPaymentStatus?: string
  hasFinalReport?: boolean
  customerApproved?: boolean
  customerConfirmed?: boolean
}

/** Pure capability check. Mutations must use the authorized transactional SQL command. */
export function transitionJobStatus(current: JobStatus, next: JobStatus, context: JobTransitionContext = {}): JobStatus {
  assertTransition(jobTransitions, current, next, 'job')
  if (['technician_on_way', 'arrived', 'onsite_diagnosis', 'in_progress'].includes(next) && context.canonicalPaymentStatus !== 'approved') throw new Error('Initial payment must be approved before the visit')
  if (next === 'completed_pending_customer_confirmation' && !context.hasFinalReport) throw new Error('Final report is required before finishing the job')
  if (current === 'waiting_customer_approval' && next === 'in_progress' && !context.customerApproved) throw new Error('Customer approval is required before starting approved extra work')
  if (next === 'completed' && (!context.hasFinalReport || !context.customerConfirmed)) throw new Error('Final report and explicit customer confirmation are required')
  return next
}

export function customerVisibleJobStatus(status: JobStatus): string {
  return customerJobStatusLabels[status]
}
