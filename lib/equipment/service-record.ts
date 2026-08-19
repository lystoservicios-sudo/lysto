import type { MaintenanceOption } from '../domain/types.ts'

export type EquipmentType = 'split' | 'inverter' | 'on_off' | 'ventana' | 'piso_techo' | 'central'
export type JobResolutionStatus = 'resolved' | 'partially_resolved' | 'pending_part' | 'second_visit_required' | 'not_resolved'

export type EquipmentServiceCloseInput = {
  equipmentId?: string
  realDiagnosis: string
  workDone: string
  resolutionStatus: JobResolutionStatus
  maintenanceOption: MaintenanceOption
  closedAt?: Date
  partsUsed?: string[]
  afterPhotosCount?: number
}

export type CloseValidationResult = {
  valid: boolean
  errors: string[]
  nextMaintenanceDate: string | null
  warrantyRecommended: boolean
}

export function getNextMaintenanceDate(option: MaintenanceOption, base = new Date()): string | null {
  const daysByOption: Partial<Record<MaintenanceOption, number>> = {
    filters_30_days: 30,
    filters_60_days: 60,
    filters_90_days: 90,
    deep_cleaning_6_months: 180,
    deep_cleaning_annual: 365,
    gas_review_30_days: 30,
    outdoor_unit_review: 90,
    electrical_review: 30,
    pending_part_replacement: 15,
    second_visit_recommended: 7
  }
  const days = daysByOption[option]
  if (!days) return null
  const next = new Date(base)
  next.setDate(next.getDate() + days)
  return next.toISOString().slice(0, 10)
}

export function validateServiceClose(input: EquipmentServiceCloseInput): CloseValidationResult {
  const errors: string[] = []
  if (!input.realDiagnosis.trim()) errors.push('Debe cargar diagnóstico real')
  if (!input.workDone.trim()) errors.push('Debe cargar trabajo realizado')
  if (!input.equipmentId) errors.push('Debe asociar un equipo o registrar excepción admin')
  if (input.resolutionStatus === 'pending_part' && (!input.partsUsed || input.partsUsed.length === 0)) errors.push('Debe indicar repuesto pendiente')
  if (input.resolutionStatus === 'resolved' && (input.afterPhotosCount ?? 0) === 0) errors.push('Se recomienda cargar al menos una foto final')

  return {
    valid: errors.length === 0,
    errors,
    nextMaintenanceDate: getNextMaintenanceDate(input.maintenanceOption, input.closedAt),
    warrantyRecommended: input.resolutionStatus === 'resolved' || input.resolutionStatus === 'partially_resolved'
  }
}
