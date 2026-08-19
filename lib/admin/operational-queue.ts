import type { JobStatus, RequestStatus, UrgencyLevel } from '../domain/types.ts'

export type QueueItem = {
  id: string
  requestStatus: RequestStatus
  jobStatus?: JobStatus
  urgency: UrgencyLevel
  paid: boolean
  createdMinutesAgo: number
  hasAssignedProfessional: boolean
  hasComplaint?: boolean
}

export function operationalPriority(item: QueueItem): number {
  let score = 0
  if (item.urgency === 'priority') score += 30
  if (item.paid && !item.hasAssignedProfessional) score += 40
  if (item.requestStatus === 'pending_assignment') score += 25
  if (item.requestStatus === 'pending_professional_acceptance') score += 15
  if (item.jobStatus === 'technician_on_way') score += 8
  if (item.hasComplaint) score += 85
  score += Math.min(30, Math.floor(item.createdMinutesAgo / 10))
  return score
}

export function sortOperationalQueue<T extends QueueItem>(items: T[]): T[] {
  return [...items].sort((a, b) => operationalPriority(b) - operationalPriority(a))
}
