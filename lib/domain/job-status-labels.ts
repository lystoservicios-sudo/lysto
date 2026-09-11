import type { JobStatus } from './types.ts'

export const jobStatusLabels: Record<JobStatus, string> = {
  pending_assignment: 'Pendiente de asignación',
  pending_professional_acceptance: 'Esperando aceptación',
  confirmed: 'Confirmado',
  technician_on_way: 'Técnico en camino',
  arrived: 'Llegó al domicilio',
  onsite_diagnosis: 'Diagnóstico en curso',
  waiting_customer_approval: 'Esperando aprobación',
  in_progress: 'Trabajo en curso',
  completed_pending_customer_confirmation: 'Finalizado por técnico',
  completed: 'Completado',
  cancelled_by_customer: 'Cancelado por cliente',
  cancelled_by_professional: 'Cancelado por profesional',
  cancelled_by_admin: 'Cancelado por admin',
  disputed: 'En disputa',
  warranty_claim: 'Garantía'
}

export const customerJobStatusLabels: Record<JobStatus, string> = {
    pending_assignment: 'Estamos asignando un profesional',
    pending_professional_acceptance: 'Esperando confirmación del profesional',
    confirmed: 'Técnico confirmado',
    technician_on_way: 'El técnico está en camino',
    arrived: 'El técnico llegó al domicilio',
    onsite_diagnosis: 'Diagnóstico en curso',
    waiting_customer_approval: 'Hay un presupuesto adicional para aprobar',
    in_progress: 'Trabajo en curso',
    completed_pending_customer_confirmation: 'Trabajo terminado, pendiente de confirmación',
    completed: 'Trabajo completado',
    cancelled_by_customer: 'Cancelado por el cliente',
    cancelled_by_professional: 'Cancelado por el profesional',
    cancelled_by_admin: 'Cancelado por Lysto',
    disputed: 'Caso en revisión',
    warranty_claim: 'Garantía en curso'
  }
