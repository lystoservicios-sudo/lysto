// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/http/api-error'

const mocks = vi.hoisted(() => ({ identity: vi.fn(), read: vi.fn(), user: vi.fn(), session: vi.fn() }))
vi.mock('@/lib/professional/onboarding-service', () => ({
  onboardingIdentity: mocks.identity,
  readProfessionalOnboarding: mocks.read
}))
vi.mock('@/lib/auth/session', () => ({ requireSession: mocks.session, requireAdminPermission: vi.fn() }))
import { onboardingMarketplaceProfessional } from '@/lib/payments/marketplace-session'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.user.mockResolvedValue({ data: { user: { id: 'auth-user', email_confirmed_at: '2026-01-01' } }, error: null })
  mocks.identity.mockResolvedValue({ auth: { getUser: mocks.user } })
  mocks.read.mockResolvedValue({ professionalId: 'bound-professional', status: 'form_started' })
  mocks.session.mockRejectedValue(new ApiError('forbidden'))
})

it('uses only the confirmed, invitation-bound professional identity', async () => {
  await expect(onboardingMarketplaceProfessional()).resolves.toEqual({
    userId: 'auth-user', professionalId: 'bound-professional', status: 'form_started'
  })
})

it.each(['form_submitted', 'under_review', 'approved', 'rejected'])('allows %s to connect', async status => {
  mocks.read.mockResolvedValue({ professionalId: 'bound-professional', status })
  await expect(onboardingMarketplaceProfessional()).resolves.toMatchObject({ professionalId: 'bound-professional' })
})

it.each(['invited', 'suspended', 'inactive'])('rejects %s', async status => {
  mocks.read.mockResolvedValue({ professionalId: 'bound-professional', status })
  await expect(onboardingMarketplaceProfessional()).rejects.toMatchObject({ code: 'forbidden' })
})

it('does not resolve an unaccepted invitation or another user’s application', async () => {
  mocks.read.mockRejectedValue(new ApiError('forbidden'))
  await expect(onboardingMarketplaceProfessional()).rejects.toMatchObject({ code: 'forbidden' })
})

it('preserves account access for an approved legacy professional without an invitation', async () => {
  mocks.read.mockRejectedValue(new ApiError('forbidden'))
  mocks.session.mockResolvedValue({ role: 'professional', userId: 'auth-user', professionalId: 'legacy-pro', professionalStatus: 'approved' })
  await expect(onboardingMarketplaceProfessional()).resolves.toEqual({
    userId: 'auth-user', professionalId: 'legacy-pro', status: 'approved'
  })
})
