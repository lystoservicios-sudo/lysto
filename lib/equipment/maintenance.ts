import type { MaintenanceOption } from '../domain/types.ts'

export type EquipmentType = 'split' | 'inverter' | 'on_off' | 'window' | 'floor_ceiling' | 'central'
export type WorkFinalStatus = 'resolved' | 'partially_resolved' | 'pending_part' | 'second_visit_required' | 'not_resolved'

export type EquipmentDraft = {
  brand?: string
  model?: string
  type?: EquipmentType
  environment?: string
  indoorPhotoPath?: string
  outdoorPhotoPath?: string
}

export type JobFinalReportDraft = {
  equipment?: EquipmentDraft
  realDiagnosis?: string
  workDone?: string
  finalStatus?: WorkFinalStatus
  maintenanceOption?: MaintenanceOption
  partsUsed?: string[]
  photosAfterCount?: number
  warrantyDays?: number
}

export const maintenanceOptionLabels: Record<MaintenanceOption, string> = {
  none: 'Sin mantenimiento recomendado',
  filters_30_days: 'Limpieza de filtros en 30 días',
  filters_60_days: 'Limpieza de filtros en 60 días',
  filters_90_days: 'Limpieza de filtros en 90 días',
  deep_cleaning_6_months: 'Limpieza profunda en 6 meses',
  deep_cleaning_annual: 'Limpieza profunda anual',
  gas_review_30_days: 'Revisión de gas en 30 días',
  outdoor_unit_review: 'Revisión de unidad exterior',
  electrical_review: 'Revisión eléctrica',
  pending_part_replacement: 'Cambio de repuesto pendiente',
  second_visit_recommended: 'Segunda visita recomendada'
}

export function calculateNextMaintenanceDate(option: MaintenanceOption, from = new Date()): string | null {
  const date = new Date(from)
  switch (option) {
    case 'filters_30_days':
    case 'gas_review_30_days':
      date.setDate(date.getDate() + 30)
      break
    case 'filters_60_days':
      date.setDate(date.getDate() + 60)
      break
    case 'filters_90_days':
      date.setDate(date.getDate() + 90)
      break
    case 'deep_cleaning_6_months':
      date.setMonth(date.getMonth() + 6)
      break
    case 'deep_cleaning_annual':
      date.setFullYear(date.getFullYear() + 1)
      break
    case 'outdoor_unit_review':
    case 'electrical_review':
    case 'pending_part_replacement':
    case 'second_visit_recommended':
      date.setDate(date.getDate() + 15)
      break
    case 'none':
      return null
  }
  return date.toISOString().slice(0, 10)
}

export function validateEquipmentDraft(equipment: EquipmentDraft | undefined): string[] {
  const missing: string[] = []
  if (!equipment?.brand?.trim()) missing.push('equipment.brand')
  if (!equipment?.type) missing.push('equipment.type')
  if (!equipment?.environment?.trim()) missing.push('equipment.environment')
  return missing
}

export function validateFinalReport(report: JobFinalReportDraft): string[] {
  const missing: string[] = []
  missing.push(...validateEquipmentDraft(report.equipment))
  if (!report.realDiagnosis?.trim()) missing.push('realDiagnosis')
  if (!report.workDone?.trim()) missing.push('workDone')
  if (!report.finalStatus) missing.push('finalStatus')
  if (!report.maintenanceOption) missing.push('maintenanceOption')
  if ((report.photosAfterCount ?? 0) < 1) missing.push('photosAfter')
  if (report.finalStatus === 'pending_part' && !report.partsUsed?.length) missing.push('partsUsed')
  return missing
}

export function assertFinalReportReady(report: JobFinalReportDraft): void {
  const missing = validateFinalReport(report)
  if (missing.length) throw new Error(`Final report incomplete: ${missing.join(', ')}`)
}
