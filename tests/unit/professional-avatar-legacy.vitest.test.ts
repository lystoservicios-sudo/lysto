// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/http/api-error'
const mocks = vi.hoisted(() => ({ identity: vi.fn(), read: vi.fn(), session: vi.fn() }))
vi.mock('@/lib/professional/onboarding-service', () => ({ onboardingIdentity: mocks.identity, readProfessionalOnboarding: mocks.read }))
vi.mock('@/lib/auth/session', () => ({ requireSession: mocks.session }))
import { saveProfessionalAvatar } from '@/lib/professional/avatar-service'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.identity.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'auth-user' } }, error: null }) } })
  mocks.read.mockRejectedValue(new ApiError('forbidden'))
  mocks.session.mockResolvedValue({ role: 'professional', userId: 'auth-user', professionalId: 'legacy-pro', professionalStatus: 'approved' })
})

it('lets a legacy approved professional reach avatar validation without an invitation dossier', async () => {
  await expect(saveProfessionalAvatar(new Uint8Array([1]), 'application/pdf')).rejects.toMatchObject({ code: 'invalid_input' })
  expect(mocks.session).toHaveBeenCalledOnce()
})

it('rejects a legacy session bound to someone else', async () => {
  mocks.session.mockResolvedValue({ role: 'professional', userId: 'other-user', professionalId: 'legacy-pro', professionalStatus: 'approved' })
  await expect(saveProfessionalAvatar(new Uint8Array([1]), 'application/pdf')).rejects.toMatchObject({ code: 'forbidden' })
})
