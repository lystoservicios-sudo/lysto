import type { AddressAccessDetails, PropertyType, ServiceIssueSlug, TimeSince, UrgencyLevel } from '../domain/types.ts'
import { generateDiagnosis } from '../diagnosis/rules.ts'
import { calculatePriceOptions } from '../pricing/calculate-price.ts'
import { normalizeSchedule, deriveUrgencyFromSchedule } from '../scheduling/availability.ts'

export type CustomerRequestDraft = {
  issue: ServiceIssueSlug
  timeSince: TimeSince
  address: {
    street: string
    number: string
    city: string
    province: string
    propertyType: PropertyType
    access: AddressAccessDetails
  }
  schedule: {
    dateChoice: 'today' | 'tomorrow' | 'custom'
    customDate?: string
    timeWindow: string
  }
  selectedOption?: UrgencyLevel
}

export function buildServiceRequestPreview(draft: CustomerRequestDraft, now = new Date()) {
  if (!draft.address.street.trim()) throw new Error('La calle es obligatoria')
  if (!draft.address.number.trim()) throw new Error('La altura es obligatoria')
  const schedule = normalizeSchedule({ ...draft.schedule, now })
  const urgency = draft.selectedOption ?? deriveUrgencyFromSchedule(schedule)
  const diagnosis = generateDiagnosis({ issue: draft.issue, timeSince: draft.timeSince })
  const pricing = calculatePriceOptions({ issue: draft.issue, zone: 'caba', propertyType: draft.address.propertyType, access: draft.address.access })
  return {
    status: 'ready_for_payment' as const,
    schedule,
    urgency,
    diagnosis,
    pricing,
    selectedPrice: urgency === 'priority' ? pricing.priority : pricing.flexible
  }
}
