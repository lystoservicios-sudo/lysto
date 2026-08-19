import type { UrgencyLevel } from '../domain/types.ts'

export type ServiceSlot = {
  date: string
  window: string
  capacity: number
  booked: number
  zone: string
}

export type SlotRecommendation = {
  slot: ServiceSlot
  availability: 'available' | 'last_places' | 'full'
  slaMinutes: number
  label: string
}

export function classifySlot(slot: ServiceSlot): SlotRecommendation['availability'] {
  if (slot.booked >= slot.capacity) return 'full'
  if (slot.capacity - slot.booked <= 1) return 'last_places'
  return 'available'
}

export function estimateSlaMinutes(input: { urgency: UrgencyLevel; distanceKm: number; sameDay: boolean; hasParking?: boolean }): number {
  const base = input.urgency === 'priority' ? 90 : 240
  const distance = Math.max(0, Math.ceil(input.distanceKm / 5) * 10)
  const dayPenalty = input.sameDay ? 0 : 60
  const parkingPenalty = input.hasParking === false ? 15 : 0
  return base + distance + dayPenalty + parkingPenalty
}

export function recommendSlots(slots: ServiceSlot[], input: { urgency: UrgencyLevel; preferredZone: string; today: string }): SlotRecommendation[] {
  return slots
    .filter((slot) => slot.zone === input.preferredZone)
    .map((slot) => ({
      slot,
      availability: classifySlot(slot),
      slaMinutes: estimateSlaMinutes({ urgency: input.urgency, distanceKm: 8, sameDay: slot.date === input.today, hasParking: true }),
      label: `${slot.date} · ${slot.window}`
    }))
    .filter((item) => item.availability !== 'full')
    .sort((a, b) => a.slaMinutes - b.slaMinutes || a.slot.booked - b.slot.booked)
}

export function assertSchedulable(slot: ServiceSlot): void {
  if (classifySlot(slot) === 'full') throw new Error('slot_full')
  if (slot.capacity <= 0) throw new Error('invalid_capacity')
}
