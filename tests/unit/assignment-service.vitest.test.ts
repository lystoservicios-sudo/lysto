import { describe, expect, it, vi } from 'vitest'
import type { Session } from '@/lib/auth/session'
import { assignmentCandidatesQuery, mutateAssignment } from '@/lib/admin/assignment-service'

const jobId = '11111111-1111-4111-8111-111111111111'
const professionalId = '22222222-2222-4222-8222-222222222222'
const offerId = '33333333-3333-4333-8333-333333333333'
function session(
  role: 'admin' | 'professional',
  data: unknown,
  error: { code: string } | null = null
) {
  const rpc = vi.fn(async () => ({ data, error }))
  return {
    value: {
      role,
      assuranceLevel: 'aal2',
      permissions: role === 'admin' ? ['operations'] : [],
      professionalId: role === 'professional' ? professionalId : undefined,
      client: { rpc }
    } as unknown as Session,
    rpc
  }
}

describe('assignment application boundary', () => {
  it('parses bounded numeric candidate query parameters from HTTP', () => {
    expect(
      assignmentCandidatesQuery(
        new Request(
          `https://lysto.test/api/pricing/offers?jobId=${jobId}&startsAt=2026-09-20T12%3A00%3A00Z&durationMinutes=90&travelBufferMinutes=30`
        )
      )
    ).toMatchObject({ durationMinutes: 90, travelBufferMinutes: 30 })
  })
  it('creates a versioned offer without accepting caller actor identifiers', async () => {
    const current = session('admin', {
      id: offerId,
      jobId,
      professionalId,
      version: 3,
      status: 'pending',
      expiresAt: '2026-09-12T13:00:00Z',
      scheduleVersion: 4,
      paymentAccountConnected: false
    })
    const input = {
      action: 'assign' as const,
      jobId,
      professionalId,
      startsAt: '2026-09-20T12:00:00Z',
      durationMinutes: 90,
      travelBufferMinutes: 30,
      expiresAt: '2026-09-12T13:00:00Z',
      expectedVersion: 2
    }
    await mutateAssignment(current.value, input)
    expect(current.rpc).toHaveBeenCalledWith('create_assignment_offer', {
      p_job_id: jobId,
      p_professional_id: professionalId,
      p_starts_at: input.startsAt,
      p_duration_minutes: 90,
      p_travel_buffer_minutes: 30,
      p_expires_at: input.expiresAt,
      p_expected_version: 2
    })
    await expect(
      mutateAssignment(current.value, { ...input, adminProfileId: professionalId })
    ).rejects.toBeTruthy()
  })

  it('requires a meaningful rejection reason before database access', async () => {
    const current = session('professional', {})
    await expect(
      mutateAssignment(current.value, {
        action: 'respond',
        offerId,
        response: 'rejected',
        reason: 'no',
        expectedVersion: 1
      })
    ).rejects.toBeTruthy()
    expect(current.rpc).not.toHaveBeenCalled()
  })

  it('maps concurrent version conflicts without exposing database details', async () => {
    const current = session('professional', null, { code: '40001' })
    await expect(
      mutateAssignment(current.value, {
        action: 'respond',
        offerId,
        response: 'accepted',
        expectedVersion: 1
      })
    ).rejects.toMatchObject({ code: 'conflict' })
  })
})
