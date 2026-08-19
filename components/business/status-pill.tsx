import { Badge } from '@/components/ui/badge'
import type { JobStatus, PaymentStatus, ProfessionalStatus, RequestStatus } from '@/lib/domain/types'

type AnyStatus = JobStatus | PaymentStatus | ProfessionalStatus | RequestStatus | string

const labels: Record<string, string> = {
  draft: 'Borrador',
  diagnosis_completed: 'Diagnóstico listo',
  address_completed: 'Dirección cargada',
  schedule_completed: 'Horario cargado',
  price_selected: 'Precio elegido',
  pending_payment: 'Pendiente de pago',
  payment_approved: 'Pago aprobado',
  matching: 'Buscando profesional',
  pending_assignment: 'Pendiente de asignación',
  pending_professional_acceptance: 'Esperando aceptación',
  assigned: 'Asignado',
  cancelled: 'Cancelado',
  expired: 'Vencido',
  confirmed: 'Confirmado',
  technician_on_way: 'En camino',
  arrived: 'Llegó',
  onsite_diagnosis: 'Diagnosticando',
  waiting_customer_approval: 'Espera aprobación',
  in_progress: 'En progreso',
  completed_pending_customer_confirmation: 'Pendiente de confirmación',
  completed: 'Completado',
  cancelled_by_customer: 'Cancelado por cliente',
  cancelled_by_professional: 'Cancelado por profesional',
  cancelled_by_admin: 'Cancelado por admin',
  disputed: 'En disputa',
  warranty_claim: 'Garantía',
  invited: 'Invitado',
  form_started: 'Formulario iniciado',
  form_submitted: 'Formulario enviado',
  under_review: 'En revisión',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  suspended: 'Suspendido',
  inactive: 'Inactivo',
  pending: 'Pendiente',
  authorized: 'Autorizado',
  refunded: 'Devuelto',
  partially_refunded: 'Devolución parcial',
  captured: 'Capturado',
  failed: 'Fallido'
}

export function StatusPill({ status }: { status: AnyStatus }) {
  const s = String(status)
  const tone = s.includes('approved') || s === 'approved' || s === 'completed' || s === 'confirmed' || s === 'captured' ? 'green'
    : s.includes('cancelled') || s === 'rejected' || s === 'failed' || s === 'suspended' || s === 'disputed' ? 'red'
    : s.includes('pending') || s === 'under_review' || s === 'authorized' || s === 'matching' ? 'amber'
    : 'blue'
  return <Badge tone={tone}>{labels[s] ?? s}</Badge>
}
