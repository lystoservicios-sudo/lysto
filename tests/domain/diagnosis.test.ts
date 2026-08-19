import { test, expect } from '../_lib/test.ts'
import { generateDiagnosis } from '../../lib/diagnosis/rules.ts'

test('no enfria hace semanas prioriza gas bajo o fuga', () => {
  const report = generateDiagnosis({ issue: 'no_enfria', timeSince: 'weeks' })
  expect(report.topCause.code).toBe('low_refrigerant')
  expect(report.level).toBe('high')
  expect(report.disclaimer).toIncludeText('preliminar')
})

test('pierde agua prioriza drenaje obstruido', () => {
  const report = generateDiagnosis({ issue: 'pierde_agua', timeSince: 'days' })
  expect(report.topCause.code).toBe('blocked_drain')
  expect(report.technicianSummary).toIncludeText('Destapar drenaje')
})

test('no enciende incluye checklist electrico', () => {
  const report = generateDiagnosis({ issue: 'no_enciende', timeSince: 'today' })
  expect(report.technicianSummary).toIncludeText('Verificar tensión')
})

test('instalacion no diagnostica falla, releva alcance', () => {
  const report = generateDiagnosis({ issue: 'instalacion', timeSince: 'today' })
  expect(report.topCause.code).toBe('installation_scope')
})

test('mantenimiento genera recomendacion preventiva', () => {
  const report = generateDiagnosis({ issue: 'mantenimiento', timeSince: 'months', hasPhoto: true })
  expect(report.topCause.code).toBe('preventive_maintenance')
  expect(report.technicianSummary).toIncludeText('material visual')
})
