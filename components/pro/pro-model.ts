import type { JobStatus } from '@/lib/domain/types'
import { jobStatusLabels } from '@/lib/domain/job-status-labels'
import type { JobDto } from '@/lib/data-access/read-contracts'

export function toProfessionalJobSummary(job:JobDto) {
  return {...job,statusLabel:jobStatusLabels[job.status],group:jobGroup(job.status),stage:visitStage(job.status)}
}

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
