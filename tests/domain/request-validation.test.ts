import { test, expect } from '../_lib/test.ts'
import { canSubmitServiceRequest, validateServiceRequestDraft } from '../../lib/service-request/validation.ts'

test('valida solicitud completa lista para pago', () => {
  const result = validateServiceRequestDraft({
    issue: 'no_enfria',
    timeSince: 'days',
    address: { street: 'Corrientes', number: '1234', city: 'CABA', province: 'Buenos Aires', propertyType: 'apartment', access: { hasElevator: true } },
    schedule: { dateChoice: 'tomorrow', timeWindow: '10:00 – 12:00' },
    selectedOption: 'priority'
  })
  expect(result.ok).toBe(true)
})

test('rechaza solicitud sin direccion ni horario', () => {
  const result = validateServiceRequestDraft({ issue: 'pierde_agua', timeSince: 'weeks' })
  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.errors).toContain('street_required')
    expect(result.errors).toContain('time_window_required')
  }
})

test('custom date exige fecha custom', () => {
  const result = validateServiceRequestDraft({
    issue: 'mantenimiento',
    timeSince: 'months',
    address: { street: 'Cuba', number: '2450', city: 'CABA', province: 'Buenos Aires', propertyType: 'house' },
    schedule: { dateChoice: 'custom', timeWindow: '14:00 – 16:00' }
  })
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.errors).toContain('custom_date_required')
})

test('canSubmitServiceRequest devuelve true solo cuando el draft es completo', () => {
  expect(canSubmitServiceRequest({
    issue: 'instalacion',
    timeSince: 'today',
    address: { street: 'San Juan', number: '1800', city: 'CABA', province: 'Buenos Aires', propertyType: 'apartment' },
    schedule: { dateChoice: 'today', timeWindow: '18:00 – 20:00' }
  })).toBe(true)
})
