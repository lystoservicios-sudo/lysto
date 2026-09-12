import { describe, expect, it } from 'vitest'
import {
  assertFutureVisit,
  buildVisitInterval,
  intervalsConflict,
  isWithinWeeklyAvailability,
  type VisitInterval
} from '@/lib/scheduling/availability'
import { recommendSlots } from '@/lib/scheduling/service-slot'

describe('scheduling capacity domain', () => {
  it('converts a Buenos Aires local visit to explicit UTC instants', () => {
    expect(
      buildVisitInterval({ localDate: '2026-09-14', localTime: '09:30', durationMinutes: 90 })
    ).toEqual({
      localDate: '2026-09-14',
      startsAt: '2026-09-14T12:30:00.000Z',
      endsAt: '2026-09-14T14:00:00.000Z',
      timezone: 'America/Argentina/Buenos_Aires'
    })
  })

  it('rejects invalid calendar values and operationally unsafe durations', () => {
    expect(() =>
      buildVisitInterval({ localDate: '2026-02-30', localTime: '09:00', durationMinutes: 60 })
    ).toThrow('invalid_local_datetime')
    expect(() =>
      buildVisitInterval({ localDate: '2026-09-14', localTime: '09:00', durationMinutes: 10 })
    ).toThrow('invalid_duration')
  })

  it('detects overlap including each visit travel buffer', () => {
    const first: VisitInterval = {
      startsAt: '2026-09-14T12:00:00.000Z',
      endsAt: '2026-09-14T13:00:00.000Z',
      bufferMinutes: 30
    }
    expect(
      intervalsConflict(first, {
        startsAt: '2026-09-14T13:20:00.000Z',
        endsAt: '2026-09-14T14:00:00.000Z',
        bufferMinutes: 0
      })
    ).toBe(true)
    expect(
      intervalsConflict(first, {
        startsAt: '2026-09-14T13:30:00.000Z',
        endsAt: '2026-09-14T14:00:00.000Z',
        bufferMinutes: 0
      })
    ).toBe(false)
  })

  it('uses Buenos Aires weekdays and requires the complete visit inside availability', () => {
    expect(
      isWithinWeeklyAvailability(
        buildVisitInterval({ localDate: '2026-09-14', localTime: '09:30', durationMinutes: 90 }),
        [{ weekday: 1, startTime: '09:00', endTime: '12:00' }]
      )
    ).toBe(true)
    expect(
      isWithinWeeklyAvailability(
        buildVisitInterval({ localDate: '2026-09-14', localTime: '11:00', durationMinutes: 90 }),
        [{ weekday: 1, startTime: '09:00', endTime: '12:00' }]
      )
    ).toBe(false)
  })

  it('rejects visits in the past at the exact instant, including local midnight boundaries', () => {
    expect(() =>
      assertFutureVisit('2026-09-14T02:59:59.000Z', new Date('2026-09-14T03:00:00.000Z'))
    ).toThrow('visit_in_past')
    expect(() =>
      assertFutureVisit('2026-09-14T03:00:00.000Z', new Date('2026-09-14T02:59:59.000Z'))
    ).not.toThrow()
  })

  it('does not advertise a preferred window as reserved capacity', () => {
    expect(
      recommendSlots(
        [
          {
            date: '2026-09-14',
            window: '09:00-12:00',
            capacity: 1,
            booked: 0,
            held: 1,
            zone: 'palermo'
          }
        ],
        { urgency: 'flexible', preferredZone: 'palermo', today: '2026-09-12' }
      )
    ).toEqual([])
  })
})
