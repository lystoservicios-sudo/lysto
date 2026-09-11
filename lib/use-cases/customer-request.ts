import type { AddressAccessDetails, PropertyType, RequestStatus, ServiceIssueSlug, TimeSince, UrgencyLevel } from '../domain/types.ts'
import { generateDiagnosis } from '../diagnosis/rules.ts'
import { calculatePriceOptions, type PriceBreakdown } from '../pricing/calculate-price.ts'
import { validateServiceRequestDraft } from '../service-request/validation.ts'

export type CustomerRequestCommand = {
  customerId: string
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
  selectedOption: UrgencyLevel
  media?: {
    photosCount?: number
    videosCount?: number
  }
  zone?: string
}

export type CustomerRequestPrepared = {
  id: string
  customerId: string
  status: RequestStatus
  selectedOption: UrgencyLevel
  selectedPrice: PriceBreakdown
  paymentAmount: number
  diagnosis: ReturnType<typeof generateDiagnosis>
  eventCodes: string[]
  nextAction: 'accept_service_quote'
}

function deterministicRequestId(input: CustomerRequestCommand): string {
  const base = `${input.customerId}-${input.issue}-${input.schedule.dateChoice}-${input.schedule.timeWindow}`
  let hash = 0
  for (const char of base) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return `REQ-${String(hash).padStart(10, '0').slice(0, 10)}`
}

export function prepareCustomerServiceRequest(command: CustomerRequestCommand): CustomerRequestPrepared {
  if (!command.customerId.trim()) throw new Error('customer_id_required')
  const validation = validateServiceRequestDraft(command)
  if (!validation.ok) throw new Error(`invalid_customer_request:${validation.errors.join(',')}`)

  const diagnosis = generateDiagnosis({
    issue: command.issue,
    timeSince: command.timeSince,
    hasPhoto: (command.media?.photosCount ?? 0) > 0,
    hasVideo: (command.media?.videosCount ?? 0) > 0
  })
  const prices = calculatePriceOptions({
    issue: command.issue,
    zone: command.zone ?? 'caba',
    propertyType: command.address.propertyType,
    access: command.address.access
  })
  const selectedPrice = command.selectedOption === 'priority' ? prices.priority : prices.flexible

  return {
    id: deterministicRequestId(command),
    customerId: command.customerId,
    status: 'price_selected',
    selectedOption: command.selectedOption,
    selectedPrice,
    paymentAmount: selectedPrice.total,
    diagnosis,
    eventCodes: ['diagnosis_completed', 'address_completed', 'schedule_completed', 'price_selected'],
    nextAction: 'accept_service_quote'
  }
}

export function assertCustomerRequestReadyForPayment(command: CustomerRequestCommand): void {
  prepareCustomerServiceRequest(command)
  throw new Error('Canonical accepted quote and confirmed professional required; use prepare_marketplace_checkout')
}
