import { equipment, jobs, payments, professionals, serviceRequests } from '@/lib/mock/lysto-data'
import type { JobStatus } from '@/lib/domain/types'

// Presentation-only fixture scope. Production must derive ownership from the authenticated user.
export const demoProfessional = professionals[0]
export const professionalJobs = jobs.filter(job => job.professional === demoProfessional.name)
export const professionalPayments = payments.filter(payment => payment.professional === demoProfessional.name)
export const professionalEquipment = equipment.filter(item => professionalJobs.some(job => job.customer === item.customer))
export const visibleRequests = serviceRequests.filter(request => request.assignedProfessional === demoProfessional.name || (!request.assignedProfessional && request.status === 'payment_approved'))
export const availableRequests = visibleRequests.filter(request => !professionalJobs.some(job => job.requestId === request.id))

export function jobGroup(status: JobStatus): 'active' | 'closing' | 'finished' {
  if (status === 'completed_pending_customer_confirmation') return 'closing'
  if (status === 'completed' || status.startsWith('cancelled')) return 'finished'
  return 'active'
}

export function searchMatches(query: string, ...values: string[]) {
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  return normalize(values.join(' ')).includes(normalize(query))
}

export function dateNumber(date: string) {
  const [day, month, year] = date.split('/').map(Number)
  return Date.UTC(year, month - 1, day)
}

export const toolOptions = ['Bomba de vacío', 'Manifold R410A/R32', 'Balanza digital', 'Detector de fugas', 'Pinza amperométrica', 'Multímetro', 'Termómetro', 'Escalera', 'Taladro', 'Elementos de seguridad']

export const visitStages = ['Visita', 'Llegada', 'Diagnóstico', 'Reparación', 'Cierre']
export function visitStage(status: JobStatus) {
  if (['completed', 'completed_pending_customer_confirmation'].includes(status)) return 4
  if (status === 'in_progress') return 3
  if (['onsite_diagnosis', 'waiting_customer_approval'].includes(status)) return 2
  if (status === 'arrived') return 1
  return 0
}
