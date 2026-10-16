// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ identity: vi.fn(), review: vi.fn(), legal: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/professional/onboarding-service', () => ({ onboardingIdentity: mocks.identity, readProfessionalReview: mocks.review }))
vi.mock('@/lib/auth/account-policy', () => ({ getRegistrationPolicy: mocks.legal }))
import { ownOnboardingContext } from '@/lib/professional/onboarding-context'

const review = { application: { professionalId: '96000000-0000-4000-8000-000000000001', status: 'under_review' }, eligible: false }
function client() {
  return {
    rpc: mocks.rpc,
    from: () => ({
      select() { return this }, eq() { return this }, order() { return this },
      async limit() { return { data: [], error: null } }
    })
  }
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.identity.mockResolvedValue(client())
  mocks.review.mockResolvedValue(review)
  mocks.legal.mockResolvedValue(null)
  mocks.rpc.mockResolvedValue({ data: false, error: null })
})

describe('registration password permission projection', () => {
  it('exposes the real server permission without inferring from application review or payment status', async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null })
    const result = await ownOnboardingContext()
    expect(result.canChangePassword).toBe(true)
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.rpc).toHaveBeenCalledWith('professional_password_change_ready')
    expect(result.application).toEqual(review.application)
    expect(result.legal).toBeNull()
  })

  it.each([false, null, 'true', 1, { ready: true }])('does not authorize from non-true RPC data: %s', async data => {
    mocks.rpc.mockResolvedValue({ data, error: null })
    expect((await ownOnboardingContext()).canChangePassword).toBe(false)
  })

  it('fails closed without hiding the registration if permission RPC fails', async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: { code: '42501' } })
    const result = await ownOnboardingContext()
    expect(result.canChangePassword).toBe(false)
    expect(result.catalog).toEqual({ categories: [], zones: [] })
  })

  it('fails closed on an unavailable permission transport', async () => {
    mocks.rpc.mockRejectedValue(new Error('unavailable'))
    expect((await ownOnboardingContext()).canChangePassword).toBe(false)
  })

  it('does not query permission before authenticating the actual onboarding identity', async () => {
    mocks.identity.mockRejectedValue(new Error('denied'))
    await expect(ownOnboardingContext()).rejects.toThrow('denied')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
