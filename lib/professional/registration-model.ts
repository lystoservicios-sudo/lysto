import type { OnboardingContext } from './onboarding-context'
import type { ProfessionalApplication, ProfessionalReview } from './onboarding-contracts'

export type RegistrationAccount = {
  configured: boolean
  linked: boolean | null
  mode?: 'live' | 'test'
  accountId?: string | null
}
export type RegistrationState = 'editing' | 'corrections' | 'linking' | 'review' | 'approved_pending' | 'ready' | 'suspended' | 'inactive' | 'unavailable'
type RegistrationDocument = ProfessionalReview['documents'][number]
export const registrationSteps = [
  'Tus datos', 'Tu oficio', 'Dónde trabajás', 'Tus horarios',
  'Foto y documentos', 'Revisá tu postulación', 'Vinculá tus cobros'
] as const

function calendarDate(value: string): boolean {
  const parsed = Date.parse(value)
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(parsed) &&
    new Date(parsed).toISOString().slice(0, 10) === value
}

function currentDate(today: string | Date = new Date()): string {
  return typeof today === 'string' ? today : today.toISOString().slice(0, 10)
}

function selectedPolicies(application: ProfessionalApplication, context: OnboardingContext) {
  return context.requirements?.policies.filter(policy => application.categoryIds.includes(policy.categoryId)) ?? []
}

function activeChoices(ids: string[], catalog: OnboardingContext['catalog']['categories']): boolean {
  return ids.length > 0 && ids.length <= 50 && new Set(ids).size === ids.length &&
    ids.every(id => catalog.some(item => item.id === id))
}

/** Mirrors the modern invitation evidence gate, then adds only the selected policies. */
export function requiredRegistrationDocuments(context: OnboardingContext): string[] {
  return requiredDocuments(context.application, context)
}

function requiredDocuments(application: ProfessionalApplication, context: OnboardingContext): string[] {
  return [...new Set([
    'identity_front', 'identity_back', 'license',
    ...selectedPolicies(application, context).flatMap(policy => policy.requiredDocuments)
  ])]
}

/** Document version is a review revision, not an upload order across different IDs. */
export function latestRegistrationDocument(context: OnboardingContext, type: string): RegistrationDocument | undefined {
  return context.documents.filter(document => document.documentType === type).sort((a, b) =>
    Date.parse(b.createdAt) - Date.parse(a.createdAt) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)
  )[0]
}

export function registrationDocumentStatus(
  document: RegistrationDocument | undefined, today?: string | Date
): 'missing' | 'pending' | 'approved' | 'rejected' | 'expired' {
  if (!document) return 'missing'
  if (document.status === 'rejected') return 'rejected'
  if (document.expiresAt && (!calendarDate(document.expiresAt) || document.expiresAt <= currentDate(today))) return 'expired'
  return document.status
}

/** Client guidance only: saves, submission and work access remain server-authorized. */
export function validateRegistrationStep(
  step: number, application: ProfessionalApplication, context: OnboardingContext, today?: string | Date
): Record<string, string> {
  const errors: Record<string, string> = {}
  const policies = selectedPolicies(application, context)
  if (step === 0) {
    if (!application.firstName.trim() || application.firstName.trim().length > 100) errors.firstName = 'Ingresá tu nombre, de hasta 100 caracteres.'
    if (!application.lastName.trim() || application.lastName.trim().length > 100) errors.lastName = 'Ingresá tu apellido, de hasta 100 caracteres.'
    if (application.phone.replace(/\D/g, '').length < 8 || application.phone.length > 100) errors.phone = 'Ingresá un teléfono con al menos 8 números.'
    if (!/^\d{7,9}$/.test(application.dni)) errors.dni = 'Ingresá tu DNI con 7 a 9 números, sin puntos.'
    if (!/^\d{11}$/.test(application.cuil)) errors.cuil = 'Ingresá tu CUIL con 11 números, sin guiones.'
    if (!calendarDate(application.birthdate) || application.birthdate >= currentDate(today)) errors.birthdate = 'Ingresá una fecha de nacimiento válida, anterior a hoy.'
    if (!application.address || application.address.trim().length < 5 || application.address.trim().length > 200) errors.address = 'Ingresá tu dirección completa, de 5 a 200 caracteres.'
  }
  if (step === 1) {
    if (!activeChoices(application.categoryIds, context.catalog.categories)) errors.categoryIds = 'Elegí al menos una especialidad disponible, sin repetirla.'
    const minimum = Math.max(0, ...policies.map(policy => policy.minExperience))
    if (!Number.isInteger(application.yearsExperience) || application.yearsExperience < minimum || application.yearsExperience > 80) {
      errors.yearsExperience = minimum > 0 ? `Esta especialidad requiere al menos ${minimum} años de experiencia.` : 'Ingresá entre 0 y 80 años de experiencia.'
    }
    if (!application.licenseNumber.trim() || application.licenseNumber.length > 100) errors.licenseNumber = 'Ingresá tu número de matrícula, de hasta 100 caracteres.'
    if (!application.licenseEntity.trim() || application.licenseEntity.length > 100) errors.licenseEntity = 'Ingresá la entidad emisora de tu matrícula.'
    if (policies.some(policy => policy.requiredTools.some(tool => !application.tools.some(selected => selected === tool)))) errors.tools = 'Marcá las herramientas requeridas para tu especialidad.'
    if (application.bio.length > 2000) errors.bio = 'La presentación puede tener hasta 2000 caracteres.'
  }
  if (step === 2) {
    if (!activeChoices(application.zoneIds, context.catalog.zones)) errors.zoneIds = 'Elegí al menos una zona disponible, sin repetirla.'
    if (application.hasMobility && (!application.mobilityType.trim() || application.mobilityType.length > 100)) errors.mobilityType = 'Indicá qué movilidad tenés.'
  }
  if (step === 3) {
    const slots = application.availability
    const validTime = (time: string) => /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(time)
    if (!slots.length) errors.availability = 'Agregá al menos un horario semanal.'
    else if (slots.length > 50) errors.availability = 'Podés agregar hasta 50 franjas horarias.'
    else if (slots.some(slot => !Number.isInteger(slot.weekday) || slot.weekday < 0 || slot.weekday > 6 ||
      !validTime(slot.startTime) || !validTime(slot.endTime) || slot.startTime >= slot.endTime)) {
      errors.availability = 'Revisá los horarios: elegí un día válido y una hora de fin posterior al inicio.'
    } else {
      const ordered = [...slots].sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime))
      if (ordered.some((slot, index) => index > 0 && slot.weekday === ordered[index - 1].weekday && slot.startTime < ordered[index - 1].endTime)) errors.availability = 'Hay horarios repetidos o superpuestos. Ajustá las franjas de ese día.'
    }
  }
  if (step === 4) {
    if (!context.avatarUrl) errors.avatarUrl = 'Agregá tu foto de perfil.'
    for (const type of requiredDocuments(application, context)) {
      const document = latestRegistrationDocument(context, type)
      const status = registrationDocumentStatus(document, today)
      const key = `documents.${type}`
      if (status === 'missing') errors[key] = 'Subí este documento para continuar.'
      else if (status === 'rejected') errors[key] = document?.reason?.trim() || 'Este documento tiene una observación. Reemplazalo para continuar.'
      else if (status === 'expired') errors[key] = 'Este documento está vencido o tiene una vigencia no válida. Reemplazalo.'
      // Initial upload expiry is assigned during review, not by the applicant.
      else if (status === 'approved' && !document?.expiresAt && policies.some(policy => policy.expiryDocuments.includes(type))) errors[key] = 'La vigencia de este documento necesita revisión.'
    }
  }
  if (step === 5) {
    for (let group = 0; group < 5; group++) Object.assign(errors, validateRegistrationStep(group, application, context, today))
    const ids = policies.map(policy => policy.categoryId)
    if (!context.requirements || ids.length !== application.categoryIds.length || new Set(ids).size !== ids.length ||
      !application.categoryIds.every(id => ids.includes(id)) || policies.some(policy => !policy.version.trim())) {
      errors.requirements = 'No pudimos verificar los requisitos vigentes de tu especialidad. Actualizá la información e intentá de nuevo.'
    }
    if (!context.legal || !context.legal.termsVersion.trim() || !context.legal.privacyVersion.trim()) errors.legal = 'No pudimos cargar las condiciones vigentes. Actualizá la información antes de enviar.'
  }
  return errors
}

export function initialRegistrationStep(context: OnboardingContext): number {
  if (!['invited', 'form_started', 'rejected'].includes(context.application.status)) return 6
  for (let step = 0; step < 5; step++) {
    if (Object.keys(validateRegistrationStep(step, context.application, context)).length) return step
  }
  return 5
}

/** Never infer approval or eligibility from a linked payment account alone. */
export function registrationState(context: OnboardingContext | null, account: RegistrationAccount | null): RegistrationState {
  if (!context) return 'unavailable'
  const accountReady = account?.configured === true && account.linked === true && account.mode !== 'test'
  switch (context.application.status) {
    case 'invited':
    case 'form_started': return 'editing'
    case 'rejected': return 'corrections'
    case 'form_submitted':
    case 'under_review': return accountReady ? 'review' : 'linking'
    case 'approved': return context.readyForNewWork === true && accountReady ? 'ready' : 'approved_pending'
    case 'suspended': return 'suspended'
    case 'inactive': return 'inactive'
    default: return 'unavailable'
  }
}
