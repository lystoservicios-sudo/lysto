import type { AddressAccessDetails, PropertyType, ServiceIssueSlug, TimeSince, UrgencyLevel } from '../domain/types.ts'
import { AIR_CONDITIONING_ISSUES, TIME_WINDOWS } from '../domain/constants.ts'

const validIssues = new Set(AIR_CONDITIONING_ISSUES.map((issue) => issue.slug))
const validTimeSince = new Set<TimeSince>(['today', 'days', 'weeks', 'months'])
const validPropertyTypes = new Set<PropertyType>(['house', 'apartment', 'commercial', 'office'])
const validUrgencies = new Set<UrgencyLevel>(['flexible', 'priority'])

export type ServiceRequestValidationInput = {
  issue?: ServiceIssueSlug
  timeSince?: TimeSince
  address?: {
    street?: string
    number?: string
    city?: string
    province?: string
    propertyType?: PropertyType
    access?: AddressAccessDetails
  }
  schedule?: {
    dateChoice?: 'today' | 'tomorrow' | 'custom'
    customDate?: string
    timeWindow?: string
  }
  selectedOption?: UrgencyLevel
}

export type ValidationResult = { ok: true } | { ok: false; errors: string[] }

export function validateServiceRequestDraft(input: ServiceRequestValidationInput): ValidationResult {
  const errors: string[] = []
  if (!input.issue || !validIssues.has(input.issue)) errors.push('issue_required')
  if (!input.timeSince || !validTimeSince.has(input.timeSince)) errors.push('time_since_required')
  if (!input.address?.street?.trim()) errors.push('street_required')
  if (!input.address?.number?.trim()) errors.push('street_number_required')
  if (!input.address?.city?.trim()) errors.push('city_required')
  if (!input.address?.province?.trim()) errors.push('province_required')
  if (!input.address?.propertyType || !validPropertyTypes.has(input.address.propertyType)) errors.push('property_type_required')
  if (!input.schedule?.dateChoice) errors.push('date_choice_required')
  if (input.schedule?.dateChoice === 'custom' && !input.schedule.customDate) errors.push('custom_date_required')
  if (!input.schedule?.timeWindow || !TIME_WINDOWS.includes(input.schedule.timeWindow as never)) errors.push('time_window_required')
  if (input.selectedOption && !validUrgencies.has(input.selectedOption)) errors.push('invalid_price_option')
  return errors.length ? { ok: false, errors } : { ok: true }
}

export function canSubmitServiceRequest(input: ServiceRequestValidationInput): boolean {
  return validateServiceRequestDraft(input).ok
}

export type ServiceRequestDraft = {
  issue?: ServiceIssueSlug
  timeSince?: TimeSince
  address?: {
    street?: string
    number?: string
    city?: string
    province?: string
    propertyType?: PropertyType
    access?: AddressAccessDetails
  }
  preferredDate?: string
  preferredTimeWindow?: string
  selectedOption?: UrgencyLevel
}

export function validateRequestStep(draft: ServiceRequestDraft, step: 'issue' | 'details' | 'address' | 'schedule' | 'price'): string[] {
  const errors: string[] = []
  if (step === 'issue' && (!draft.issue || !validIssues.has(draft.issue))) errors.push('Elegí un motivo de consulta válido')
  if (step === 'details' && (!draft.timeSince || !validTimeSince.has(draft.timeSince))) errors.push('Indicá desde cuándo sucede')
  if (step === 'address') {
    if (!draft.address?.street?.trim()) errors.push('La calle es obligatoria')
    if (!draft.address?.number?.trim()) errors.push('La altura es obligatoria')
    if (!draft.address?.propertyType || !validPropertyTypes.has(draft.address.propertyType)) errors.push('El tipo de propiedad es obligatorio')
  }
  if (step === 'schedule') {
    if (!draft.preferredDate) errors.push('Elegí un día')
    if (!draft.preferredTimeWindow || !TIME_WINDOWS.includes(draft.preferredTimeWindow as never)) errors.push('Elegí una franja horaria válida')
  }
  if (step === 'price' && (!draft.selectedOption || !validUrgencies.has(draft.selectedOption))) errors.push('Elegí Flexible o Prioridad')
  return errors
}

export function isDraftReadyForPayment(draft: ServiceRequestDraft): boolean {
  return ['issue', 'details', 'address', 'schedule', 'price'].every((step) => validateRequestStep(draft, step as 'issue' | 'details' | 'address' | 'schedule' | 'price').length === 0)
}
