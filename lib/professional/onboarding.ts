export type ProfessionalToolSlug =
  | 'bomba_vacio'
  | 'manifold'
  | 'balanza_digital'
  | 'multimetro'
  | 'pinza_amperometrica'
  | 'detector_fugas'
  | 'termometro'
  | 'hidrolavadora'
  | 'escalera'
  | 'taladro'
  | 'cortatubo'
  | 'pestanadora'
  | 'herramientas_manual'
  | 'elementos_seguridad'

export const REQUIRED_AIR_TECH_TOOLS: ProfessionalToolSlug[] = ['manifold', 'multimetro', 'herramientas_manual', 'elementos_seguridad']

export type ProfessionalOnboardingInput = {
  firstName: string
  lastName: string
  email: string
  phone: string
  dni: string
  cuil: string
  birthdate: string
  yearsExperience: number
  licenseNumber?: string
  hasMobility: boolean
  zones: string[]
  tools: ProfessionalToolSlug[]
  availabilitySlots: Array<{ weekday: number; startTime: string; endTime: string }>
}

export type OnboardingValidationResult = {
  valid: boolean
  errors: string[]
  missingRequiredTools: ProfessionalToolSlug[]
  readinessScore: number
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function validateProfessionalOnboarding(input: ProfessionalOnboardingInput): OnboardingValidationResult {
  const errors: string[] = []
  if (!input.firstName.trim()) errors.push('Falta nombre')
  if (!input.lastName.trim()) errors.push('Falta apellido')
  if (!isEmail(input.email)) errors.push('Email inválido')
  if (input.phone.replace(/\D/g, '').length < 8) errors.push('Teléfono inválido')
  if (input.dni.replace(/\D/g, '').length < 7) errors.push('DNI inválido')
  if (input.cuil.replace(/\D/g, '').length < 10) errors.push('CUIL inválido')
  if (!isDate(input.birthdate)) errors.push('Fecha de nacimiento inválida')
  if (input.yearsExperience < 0) errors.push('Años de experiencia inválidos')
  if (input.zones.length === 0) errors.push('Debe seleccionar al menos una zona')
  if (input.availabilitySlots.length === 0) errors.push('Debe cargar disponibilidad')

  const missingRequiredTools = REQUIRED_AIR_TECH_TOOLS.filter((tool) => !input.tools.includes(tool))
  if (missingRequiredTools.length > 0) errors.push('Faltan herramientas mínimas para operar aire acondicionado')

  const score = calculateProfessionalReadinessScore(input, missingRequiredTools)

  return {
    valid: errors.length === 0,
    errors,
    missingRequiredTools,
    readinessScore: score
  }
}

export function calculateProfessionalReadinessScore(input: ProfessionalOnboardingInput, missingRequiredTools = REQUIRED_AIR_TECH_TOOLS.filter((tool) => !input.tools.includes(tool))): number {
  let score = 35
  score += Math.min(input.yearsExperience * 4, 25)
  score += input.hasMobility ? 10 : 0
  score += Math.min(input.zones.length * 4, 12)
  score += Math.min(input.availabilitySlots.length * 3, 12)
  score += input.licenseNumber?.trim() ? 8 : 0
  score -= missingRequiredTools.length * 12
  return Math.max(0, Math.min(100, Math.round(score)))
}
