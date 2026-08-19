import { test, expect } from '../_lib/test.ts'
import { defaultWarrantyDays, validateJobFinalReport } from '../../lib/jobs/final-report.ts'

test('cierre tecnico resuelto exige equipo diagnostico trabajo y foto', () => {
  const result = validateJobFinalReport({
    jobId: 'JOB-1',
    equipmentId: 'EQ-1',
    realDiagnosis: 'Carga de gas baja',
    workDone: 'Se revisó presión y se realizó ajuste técnico',
    resolutionStatus: 'resolved',
    maintenanceOption: 'filters_60_days',
    photosAfterCount: 2
  })
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.warrantyUntil).toBe('2026-09-18')
})

test('no permite cerrar trabajo sin foto posterior', () => {
  const result = validateJobFinalReport({
    jobId: 'JOB-1',
    equipmentId: 'EQ-1',
    realDiagnosis: 'Drenaje obstruido',
    workDone: 'Se limpió drenaje',
    resolutionStatus: 'resolved',
    maintenanceOption: 'filters_60_days',
    photosAfterCount: 0
  })
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.errors).toContain('after_photo_required')
})

test('pendiente de repuesto exige repuestos pendientes', () => {
  const result = validateJobFinalReport({
    jobId: 'JOB-2',
    equipmentId: 'EQ-2',
    realDiagnosis: 'Falla placa',
    workDone: 'Se diagnosticó falla',
    resolutionStatus: 'pending_part',
    maintenanceOption: 'pending_part_replacement',
    photosAfterCount: 1
  })
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.errors).toContain('pending_parts_required')
})

test('garantia default depende del estado final', () => {
  expect(defaultWarrantyDays('resolved')).toBe(30)
  expect(defaultWarrantyDays('partially_resolved')).toBe(7)
  expect(defaultWarrantyDays('not_resolved')).toBe(0)
})
