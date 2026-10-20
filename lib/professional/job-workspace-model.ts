export type ProfessionalJobView = 'summary' | 'equipment' | 'activity' | 'diagnosis' | 'approval' | 'extras' | 'work' | 'closeout' | 'report' | 'payments'
export const professionalJobViews: readonly ProfessionalJobView[] = ['summary', 'equipment', 'activity', 'diagnosis', 'approval', 'extras', 'work', 'closeout', 'report', 'payments']
const activeJobStatuses = ['confirmed', 'technician_on_way', 'arrived', 'onsite_diagnosis', 'waiting_customer_approval', 'in_progress']

export type ProfessionalJobData = {
  role: string
  job: { id: string; request_id?: string; professional_id?: string; status: string; contractSource?: string | null; requestStatus?: string; scheduled_date?: string | null; scheduled_time_window?: string | null; created_at?: string; updated_at?: string; final_amount?: number | null }
  equipmentId: string | null
  visitAddressLabel?: string | null
  visit: { startsAt: string; endsAt: string; addressLabel: string; confirmed: true } | null
  savedQuote: { status: string; address: { street: string; number: string; city: string }; quote: { customerTotal?: number; [key: string]: unknown } } | null
  onsiteDiagnosis: { id: string; actual_diagnosis: string; base_scope: string; evidence_ids: string[]; status: string; version: number; decision_reason: string | null; created_at?: string } | null
  extras: Array<{ id: string; fault: string; description: string; amount: number; status: string; created_at?: string }>
  finalReport: { id: string; real_diagnosis: string; work_done: string; parts_used: string | null; final_state: string; maintenance_option: string; next_maintenance_date?: string | null; after_photo_ids: string[]; created_at: string; version: number } | null
}

export function professionalExtraState(status: string, paymentStatus: string | null): { label: string; ready: boolean; waiting: 'approval' | 'payment' | null } {
  if (status === 'rejected') return { label: 'No aceptado por el cliente', ready: false, waiting: null }
  if (status === 'proposed') return { label: 'Esperando aprobación', ready: false, waiting: 'approval' }
  if (status === 'accepted' && paymentStatus === 'approved') return { label: 'Adicional habilitado', ready: true, waiting: null }
  if (status === 'accepted') return { label: 'Esperando pago', ready: false, waiting: 'payment' }
  return { label: 'Estado por verificar', ready: false, waiting: null }
}

export function professionalJobCapabilities(input: {
  status: string
  initialPaymentStatus: string | null
  diagnosisStatus: string | null
  extras: Array<{ status: string; paymentStatus: string | null }>
  contractSource?: string | null
  requestStatus?: string
}) {
  const active = activeJobStatuses.includes(input.status)
  const expired = input.contractSource === 'automatic_customer_request' && input.requestStatus === 'expired'
  const readOnly = !active || expired
  const paid = input.initialPaymentStatus === 'approved'
  const canOperate = !readOnly && paid
  const labels: Record<string, string> = { confirmed: 'Marcar en camino', technician_on_way: 'Confirmar llegada', arrived: 'Iniciar diagnóstico' }
  const advance = canOperate && labels[input.status] ? { label: labels[input.status], expectedStatus: input.status } : null
  const waitingApproval = !readOnly && input.diagnosisStatus === 'submitted'
  const canDiagnose = canOperate && !['submitted', 'accepted'].includes(input.diagnosisStatus ?? '') &&
    (input.status === 'onsite_diagnosis' || (input.status === 'waiting_customer_approval' && input.diagnosisStatus === 'changes_requested'))
  const extrasReady = input.extras.every(extra => extra.status === 'rejected' || professionalExtraState(extra.status, extra.paymentStatus).ready)
  const canWork = canOperate && input.status === 'in_progress' && input.diagnosisStatus === 'accepted' && extrasReady
  return {
    readOnly, paid, expired, advance, waitingApproval, canDiagnose, canWork, canClose: canWork,
    canProposeExtra: canOperate && ['arrived', 'onsite_diagnosis', 'waiting_customer_approval', 'in_progress'].includes(input.status),
    extrasReady
  }
}

export function professionalDefaultView(data: ProfessionalJobData): ProfessionalJobView {
  if (data.finalReport) return 'report'
  if (!activeJobStatuses.includes(data.job.status) || (data.job.contractSource === 'automatic_customer_request' && data.job.requestStatus === 'expired')) return 'summary'
  if (data.onsiteDiagnosis?.status === 'submitted') return 'approval'
  if (data.onsiteDiagnosis?.status === 'changes_requested' || data.job.status === 'onsite_diagnosis') return 'diagnosis'
  if (data.job.status === 'in_progress') return 'work'
  if (data.job.status === 'waiting_customer_approval' && data.onsiteDiagnosis) return 'approval'
  return 'summary'
}

export const professionalResultLabels: Record<string, string> = {
  resolved: 'Resuelto', partially_resolved: 'Parcialmente resuelto', pending_part: 'Pendiente de repuesto',
  second_visit_required: 'Requiere otra visita', requires_second_visit: 'Requiere otra visita', not_resolved: 'No resuelto'
}
