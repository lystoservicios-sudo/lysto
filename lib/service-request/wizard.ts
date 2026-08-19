import type { AddressAccessDetails, PropertyType, ServiceIssueSlug, TimeSince, UrgencyLevel } from '../domain/types.ts'

export type WizardStepKey =
  | 'issue'
  | 'details'
  | 'diagnosis'
  | 'address'
  | 'schedule'
  | 'pricing'
  | 'payment'
  | 'matching'
  | 'confirmed'

export const wizardSteps: Array<{ key: WizardStepKey; title: string; requiredFields: string[] }> = [
  { key: 'issue', title: 'Problema', requiredFields: ['issue'] },
  { key: 'details', title: 'Detalles', requiredFields: ['timeSince'] },
  { key: 'diagnosis', title: 'Diagnóstico', requiredFields: ['diagnosisAccepted'] },
  { key: 'address', title: 'Dirección', requiredFields: ['street', 'number', 'city', 'province', 'propertyType'] },
  { key: 'schedule', title: 'Horario', requiredFields: ['preferredDate', 'preferredTimeWindow'] },
  { key: 'pricing', title: 'Presupuesto', requiredFields: ['selectedPriceOption'] },
  { key: 'payment', title: 'Pago', requiredFields: ['paymentIntentCreated'] },
  { key: 'matching', title: 'Matching', requiredFields: ['matchingStarted'] },
  { key: 'confirmed', title: 'Confirmación', requiredFields: ['professionalAssigned'] }
]

export type CustomerAddressDraft = {
  street?: string
  number?: string
  floor?: string
  apartment?: string
  city?: string
  province?: string
  postalCode?: string
  propertyType?: PropertyType
  access?: AddressAccessDetails
}

export type ServiceRequestDraft = {
  issue?: ServiceIssueSlug
  timeSince?: TimeSince
  hasPhoto?: boolean
  hasVideo?: boolean
  diagnosisAccepted?: boolean
  address?: CustomerAddressDraft
  preferredDate?: string
  preferredTimeWindow?: string
  selectedPriceOption?: UrgencyLevel
  paymentIntentCreated?: boolean
  matchingStarted?: boolean
  professionalAssigned?: boolean
}

export type StepValidation = {
  valid: boolean
  missingFields: string[]
  nextStep?: WizardStepKey
}

function present(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0
  return value !== undefined && value !== null && value !== false
}

export function getMissingFieldsForStep(step: WizardStepKey, draft: ServiceRequestDraft): string[] {
  switch (step) {
    case 'issue':
      return present(draft.issue) ? [] : ['issue']
    case 'details':
      return present(draft.timeSince) ? [] : ['timeSince']
    case 'diagnosis':
      return draft.diagnosisAccepted ? [] : ['diagnosisAccepted']
    case 'address': {
      const address = draft.address ?? {}
      const missing: string[] = []
      if (!present(address.street)) missing.push('street')
      if (!present(address.number)) missing.push('number')
      if (!present(address.city)) missing.push('city')
      if (!present(address.province)) missing.push('province')
      if (!present(address.propertyType)) missing.push('propertyType')
      return missing
    }
    case 'schedule': {
      const missing: string[] = []
      if (!present(draft.preferredDate)) missing.push('preferredDate')
      if (!present(draft.preferredTimeWindow)) missing.push('preferredTimeWindow')
      return missing
    }
    case 'pricing':
      return present(draft.selectedPriceOption) ? [] : ['selectedPriceOption']
    case 'payment':
      return draft.paymentIntentCreated ? [] : ['paymentIntentCreated']
    case 'matching':
      return draft.matchingStarted ? [] : ['matchingStarted']
    case 'confirmed':
      return draft.professionalAssigned ? [] : ['professionalAssigned']
  }
}

export function validateStep(step: WizardStepKey, draft: ServiceRequestDraft): StepValidation {
  const index = wizardSteps.findIndex((item) => item.key === step)
  if (index < 0) throw new Error(`Unknown wizard step: ${step}`)
  const missingFields = getMissingFieldsForStep(step, draft)
  return { valid: missingFields.length === 0, missingFields, nextStep: wizardSteps[index + 1]?.key }
}

export function getFirstIncompleteStep(draft: ServiceRequestDraft): WizardStepKey {
  for (const step of wizardSteps) {
    if (!validateStep(step.key, draft).valid) return step.key
  }
  return 'confirmed'
}

export function getWizardProgressPercent(draft: ServiceRequestDraft): number {
  const completed = wizardSteps.filter((step) => validateStep(step.key, draft).valid).length
  return Math.round((completed / wizardSteps.length) * 100)
}

export function assertReadyForPayment(draft: ServiceRequestDraft): void {
  const requiredBeforePayment: WizardStepKey[] = ['issue', 'details', 'diagnosis', 'address', 'schedule', 'pricing']
  const missing = requiredBeforePayment.flatMap((step) => validateStep(step, draft).missingFields.map((field) => `${step}.${field}`))
  if (missing.length) throw new Error(`Service request is not ready for payment: ${missing.join(', ')}`)
}
