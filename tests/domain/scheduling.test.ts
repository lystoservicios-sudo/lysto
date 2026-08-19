import { expect, test } from '../_lib/test.ts'
import { assertSchedulable, classifySlot, estimateSlaMinutes, recommendSlots } from '../../lib/scheduling/service-slot.ts'

test('slot classification detects last places', () => {
  expect(classifySlot({ date: '2026-08-19', window: '10:00 – 12:00', capacity: 3, booked: 2, zone: 'caba' })).toBe('last_places')
})

test('priority sla is faster than flexible', () => {
  const priority = estimateSlaMinutes({ urgency: 'priority', distanceKm: 10, sameDay: true, hasParking: true })
  const flexible = estimateSlaMinutes({ urgency: 'flexible', distanceKm: 10, sameDay: true, hasParking: true })
  expect(flexible).toBeGreaterThan(priority)
})

test('recommendSlots filters full slots and sorts by SLA', () => {
  const slots = [
    { date: '2026-08-20', window: '16:00 – 18:00', capacity: 2, booked: 2, zone: 'caba' },
    { date: '2026-08-19', window: '10:00 – 12:00', capacity: 4, booked: 1, zone: 'caba' },
    { date: '2026-08-19', window: '14:00 – 16:00', capacity: 4, booked: 0, zone: 'zona_norte' }
  ]
  const recommended = recommendSlots(slots, { urgency: 'priority', preferredZone: 'caba', today: '2026-08-19' })
  expect(recommended.length).toBe(1)
  expect(recommended[0].slot.window).toBe('10:00 – 12:00')
})

test('assertSchedulable rejects full slot', () => {
  expect(() => assertSchedulable({ date: '2026-08-19', window: '10:00 – 12:00', capacity: 1, booked: 1, zone: 'caba' })).toThrow()
})
