import type { MaintenanceOption } from '../domain/types.ts'

export type MaintenanceTask = {
  option: MaintenanceOption
  label: string
  dueInDays: number | null
  priority: 'low' | 'medium' | 'high'
  customerMessage: string
}

const tasks: Record<MaintenanceOption, MaintenanceTask> = {
  none: { option: 'none', label: 'Sin mantenimiento recomendado', dueInDays: null, priority: 'low', customerMessage: 'No hace falta programar un mantenimiento ahora.' },
  filters_30_days: { option: 'filters_30_days', label: 'Limpieza de filtros en 30 días', dueInDays: 30, priority: 'medium', customerMessage: 'Te vamos a recordar revisar o limpiar los filtros en 30 días.' },
  filters_60_days: { option: 'filters_60_days', label: 'Limpieza de filtros en 60 días', dueInDays: 60, priority: 'low', customerMessage: 'Te vamos a recordar una limpieza simple de filtros.' },
  filters_90_days: { option: 'filters_90_days', label: 'Limpieza de filtros en 90 días', dueInDays: 90, priority: 'low', customerMessage: 'Recomendamos una revisión preventiva de filtros.' },
  deep_cleaning_6_months: { option: 'deep_cleaning_6_months', label: 'Limpieza profunda en 6 meses', dueInDays: 180, priority: 'medium', customerMessage: 'Agendamos recordatorio para limpieza profunda semestral.' },
  deep_cleaning_annual: { option: 'deep_cleaning_annual', label: 'Limpieza profunda anual', dueInDays: 365, priority: 'medium', customerMessage: 'Agendamos recordatorio para mantenimiento anual.' },
  gas_review_30_days: { option: 'gas_review_30_days', label: 'Revisión de gas en 30 días', dueInDays: 30, priority: 'high', customerMessage: 'Conviene revisar presión y posible pérdida dentro de 30 días.' },
  outdoor_unit_review: { option: 'outdoor_unit_review', label: 'Revisión de unidad exterior', dueInDays: 30, priority: 'medium', customerMessage: 'Recomendamos revisar la unidad exterior para evitar fallas.' },
  electrical_review: { option: 'electrical_review', label: 'Revisión eléctrica', dueInDays: 15, priority: 'high', customerMessage: 'Por seguridad, recomendamos revisar alimentación eléctrica pronto.' },
  pending_part_replacement: { option: 'pending_part_replacement', label: 'Cambio de repuesto pendiente', dueInDays: 7, priority: 'high', customerMessage: 'Quedó un repuesto pendiente. Lysto debe hacer seguimiento.' },
  second_visit_recommended: { option: 'second_visit_recommended', label: 'Segunda visita recomendada', dueInDays: 7, priority: 'high', customerMessage: 'Recomendamos coordinar una segunda visita.' }
}

export function getMaintenanceTask(option: MaintenanceOption): MaintenanceTask {
  return tasks[option]
}

export function calculateDueDate(option: MaintenanceOption, from = new Date('2026-08-19T12:00:00.000Z')): string | null {
  const task = getMaintenanceTask(option)
  if (task.dueInDays === null) return null
  const copy = new Date(from)
  copy.setUTCDate(copy.getUTCDate() + task.dueInDays)
  return copy.toISOString().slice(0, 10)
}

export function shouldCreateMaintenanceReminder(option: MaintenanceOption): boolean {
  return option !== 'none'
}

export function maintenanceOptionsForResolution(resolution: 'resolved' | 'partially_resolved' | 'pending_part' | 'second_visit_required' | 'not_resolved'): MaintenanceOption[] {
  if (resolution === 'pending_part') return ['pending_part_replacement', 'second_visit_recommended']
  if (resolution === 'second_visit_required' || resolution === 'not_resolved') return ['second_visit_recommended']
  if (resolution === 'partially_resolved') return ['gas_review_30_days', 'outdoor_unit_review', 'electrical_review']
  return ['filters_60_days', 'filters_90_days', 'deep_cleaning_6_months', 'deep_cleaning_annual']
}
