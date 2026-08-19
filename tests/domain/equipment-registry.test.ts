import { test, expect } from '../_lib/test.ts'
import { equipmentDisplayName, validateEquipmentRegistration } from '../../lib/equipment/equipment-registry.ts'

test('valid equipment registration normalizes empty brand and model', () => {
  const result = validateEquipmentRegistration({ customerId: 'CUS-1', addressId: 'ADR-1', nickname: 'Aire living', room: 'living', propertyType: 'apartment', equipmentType: 'inverter', indoorPhotoCount: 1, outdoorPhotoCount: 0 })
  expect(result.ok).toBe(true)
  if (result.ok) {
    expect(result.normalized.brand).toBe('Sin marca cargada')
    expect(result.normalized.photoCompleteness).toBe('partial')
  }
})

test('equipment registration validates frigories range', () => {
  const result = validateEquipmentRegistration({ customerId: 'CUS-1', addressId: 'ADR-1', nickname: 'Aire', room: 'living', propertyType: 'apartment', equipmentType: 'split', frigorias: 200 })
  expect(result.ok).toBe(false)
})

test('equipment display name combines known fields', () => {
  expect(equipmentDisplayName({ nickname: 'Dormitorio', brand: 'Surrey', model: 'X100' })).toBe('Dormitorio · Surrey · X100')
})
