import { requiredAirConditioningTools, type ToolCode } from '../professional/tool-checklist.ts'

export type ProfessionalOnboardingFormInput = {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  dni?: string
  cuil?: string
  birthdate?: string
  yearsExperience?: number
  licenseNumber?: string
  licenseEntity?: string
  hasPhoto?: boolean
  hasDniDocument?: boolean
  hasCuilDocument?: boolean
  hasLicenseDocument?: boolean
  hasMobility?: boolean
  mobilityType?: string
  zones?: string[]
  availabilitySlots?: Array<{ weekday: number; startTime: string; endTime: string }>
  tools?: ToolCode[]
  paymentAccountConnected?: boolean
  bio?: string
}

export type ProfessionalOnboardingValidation = {
  ok: boolean
  missing: string[]
  score: number
  readyForReview: boolean
  readyForApproval: boolean
}

function nonEmpty(value?: string): boolean { return Boolean((value ?? '').trim()) }
function validEmail(value?: string): boolean { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value ?? '') }

export function validateProfessionalOnboardingForm(input: ProfessionalOnboardingFormInput): ProfessionalOnboardingValidation {
  const missing: string[] = []
  if (!nonEmpty(input.firstName)) missing.push('first_name')
  if (!nonEmpty(input.lastName)) missing.push('last_name')
  if (!validEmail(input.email)) missing.push('email')
  if (!nonEmpty(input.phone)) missing.push('phone')
  if (!nonEmpty(input.dni)) missing.push('dni')
  if (!nonEmpty(input.cuil)) missing.push('cuil')
  if (!nonEmpty(input.birthdate)) missing.push('birthdate')
  if ((input.yearsExperience ?? 0) < 1) missing.push('experience')
  if (!nonEmpty(input.licenseNumber)) missing.push('license_number')
  if (!nonEmpty(input.licenseEntity)) missing.push('license_entity')
  if (!input.hasPhoto) missing.push('profile_photo')
  if (!input.hasDniDocument) missing.push('dni_document')
  if (!input.hasCuilDocument) missing.push('cuil_document')
  if (!input.hasLicenseDocument) missing.push('license_document')
  if (!input.hasMobility) missing.push('mobility')
  if (!input.zones?.length) missing.push('zones')
  if (!input.availabilitySlots?.length) missing.push('availability')

  const uniqueTools = new Set(input.tools ?? [])
  const requiredToolCount = requiredAirConditioningTools.length
  const presentRequiredTools = requiredAirConditioningTools.filter((tool) => uniqueTools.has(tool)).length
  if (presentRequiredTools < Math.ceil(requiredToolCount * 0.7)) missing.push('required_tools')

  const weightedChecks = 18
  const completed = weightedChecks - missing.length
  const score = Math.max(0, Math.min(100, Math.round((completed / weightedChecks) * 100)))
  const readyForReview = missing.length === 0
  const readyForApproval = readyForReview && Boolean(input.paymentAccountConnected)
  return { ok: readyForReview, missing, score, readyForReview, readyForApproval }
}
