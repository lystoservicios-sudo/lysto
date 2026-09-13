import { describe, expect, it, vi } from 'vitest'
import type { Session } from '@/lib/auth/session'
import {
  getScheduleAvailability,
  requestJobReschedule,
  replaceProfessionalScheduleSettings,
  respondJobReschedule
} from '@/lib/scheduling/service'

const professionalId = '11111111-1111-4111-8111-111111111111'
const jobId = '22222222-2222-4222-8222-222222222222'
const requestId = '33333333-3333-4333-8333-333333333333'
function session(data: unknown, error: { code: string } | null = null) {
  const rpc = vi.fn(async () => ({ data, error }))
  return {
    value: {
      role: 'professional',
      professionalId,
      assuranceLevel: 'aal2',
      permissions: [],
      client: { rpc }
    } as unknown as Session,
    rpc
  }
}

describe('scheduling service boundary', () => {
  it('returns a complete, validated availability range', async () => {
    const current = session({
      timezone: 'America/Argentina/Buenos_Aires',
      settingsVersion: 3,
      windows: [{ weekday: 1, startTime: '09:00:00', endTime: '17:00:00' }],
      absences: [],
      reservations: [
        {
          id: requestId,
          jobId,
          version: 2,
          startsAt: '2026-09-14T12:00:00Z',
          endsAt: '2026-09-14T13:00:00Z',
          localDate: '2026-09-14',
          state: 'confirmed',
          holdExpiresAt: null
        }
      ]
    })
    const result = await getScheduleAvailability(current.value, {
      professionalId,
      from: '2026-09-12',
      to: '2026-10-12'
    })
    expect(result.reservations).toHaveLength(1)
    expect(current.rpc).toHaveBeenCalledWith('get_schedule_availability', {
      p_professional_id: professionalId,
      p_from: '2026-09-12',
      p_to: '2026-10-12'
    })
  })

  it('rejects ranges longer than 31 days before database access', async () => {
    const current = session({})
    await expect(
      getScheduleAvailability(current.value, {
        professionalId,
        from: '2026-09-01',
        to: '2026-10-20'
      })
    ).rejects.toBeTruthy()
    expect(current.rpc).not.toHaveBeenCalled()
  })

  it('sends versioned, reasoned proposals without caller supplied actor identity', async () => {
    const current = session({ id: requestId, status: 'pending', expectedVersion: 2 })
    await requestJobReschedule(current.value, {
      jobId,
      startsAt: '2026-09-15T12:00:00Z',
      durationMinutes: 90,
      travelBufferMinutes: 30,
      reason: 'El cliente no puede recibir al profesional ese día.',
      expectedVersion: 2
    })
    expect(current.rpc).toHaveBeenCalledWith('request_job_reschedule', {
      p_job_id: jobId,
      p_starts_at: '2026-09-15T12:00:00Z',
      p_duration_minutes: 90,
      p_travel_buffer_minutes: 30,
      p_reason: 'El cliente no puede recibir al profesional ese día.',
      p_expected_version: 2
    })
  })

  it('maps stale simultaneous approvals to a safe conflict', async () => {
    const current = session(null, { code: '40001' })
    await expect(
      respondJobReschedule(current.value, {
        requestId,
        decision: 'approve',
        expectedVersion: 2
      })
    ).rejects.toMatchObject({ code: 'conflict' })
  })

  it('replaces bounded schedule settings with optimistic versioning', async () => {
    const current = session({ professionalId, version: 4 })
    await replaceProfessionalScheduleSettings(current.value, {
      professionalId,
      expectedVersion: 3,
      windows: [{ weekday: 1, startTime: '09:00', endTime: '17:00' }],
      absences: [
        {
          startsAt: '2026-09-20T12:00:00Z',
          endsAt: '2026-09-20T14:00:00Z',
          reason: 'Compromiso personal informado'
        }
      ]
    })
    expect(current.rpc).toHaveBeenCalledWith('replace_professional_schedule_settings', {
      p_professional_id: professionalId,
      p_expected_version: 3,
      p_windows: [{ weekday: 1, startTime: '09:00', endTime: '17:00' }],
      p_absences: [
        {
          startsAt: '2026-09-20T12:00:00Z',
          endsAt: '2026-09-20T14:00:00Z',
          reason: 'Compromiso personal informado'
        }
      ]
    })
  })
})
