import { test, expect } from '../_lib/test.ts'
import {
  calculateDueDate,
  getMaintenanceTask,
  maintenanceOptionsForResolution,
  shouldCreateMaintenanceReminder,
  maintenancePlanVisibility
} from '../../lib/customer/maintenance-plan.ts'

test('mantenimiento sin recomendacion no genera recordatorio', () => {
  expect(shouldCreateMaintenanceReminder('none')).toBeFalsy()
  expect(calculateDueDate('none')).toBe(null)
})

test('revision electrica queda en prioridad alta y fecha cercana', () => {
  const task = getMaintenanceTask('electrical_review')
  expect(task.priority).toBe('high')
  expect(calculateDueDate('electrical_review')).toBe('2026-09-03')
})

test('pendiente de repuesto ofrece segunda visita', () => {
  const options = maintenanceOptionsForResolution('pending_part')
  expect(options).toContain('pending_part_replacement')
  expect(options).toContain('second_visit_recommended')
})

test('un caso de garantía abierto suprime la promoción de mantenimiento', () => {
  expect(
    maintenancePlanVisibility({
      option: 'filters_60_days',
      equipmentArchived: false,
      hasOpenWarrantyOrQualityCase: true
    })
  ).toBe('suppressed_by_case')
  expect(
    maintenancePlanVisibility({
      option: 'none',
      equipmentArchived: false,
      hasOpenWarrantyOrQualityCase: false
    })
  ).toBe('none')
})
