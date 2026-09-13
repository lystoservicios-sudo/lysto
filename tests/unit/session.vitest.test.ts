// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), getClaims: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: mocks.createClient }))
import { getPricingSession, pricingError } from '@/lib/pricing/server'
import { requireAdminPermission, requireRole } from '@/lib/auth/session'

const ids = {
  user: '00000000-0000-4000-8000-000000000001',
  profile: '00000000-0000-4000-8000-000000000002',
  entity: '00000000-0000-4000-8000-000000000003'
}
type Role = 'customer' | 'professional' | 'admin'
function context(role: Role = 'customer') {
  return {
    profile_id: ids.profile,
    role,
    customer_id: role === 'customer' ? ids.entity : null,
    professional_id: role === 'professional' ? ids.entity : null,
    professional_status: role === 'professional' ? 'approved' : null,
    professional_eligible: role === 'professional',
    admin_profile_id: role === 'admin' ? ids.entity : null,
    permissions: role === 'admin' ? ['operations'] : [],
    session_id: ids.user,
    session_active: true,
    aal: role === 'admin' ? 'aal2' : 'aal1'
  }
}
function arrange(role: Role = 'customer', overrides: Record<string, unknown> = {}) {
  mocks.getClaims.mockResolvedValue({
    data: {
      claims: { sub: ids.user, app_metadata: { app_role: role }, user_metadata: { app_role: 'owner' } }
    },
    error: null
  })
  mocks.rpc.mockResolvedValue({ data: { ...context(role), ...overrides }, error: null })
  // The legacy profile query is present only to exercise the pre-T06 implementation.
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: ids.profile, role }, error: null })
  }
  mocks.createClient.mockResolvedValue({
    auth: { getClaims: mocks.getClaims },
    rpc: mocks.rpc,
    from: vi.fn(() => query)
  })
}
beforeEach(() => {
  vi.clearAllMocks()
  arrange()
})

describe('current server session', () => {
  it('denies operational access when an approved professional loses documentary clearance', async () => {
    arrange('professional', { professional_eligible: false })
    await expect(getPricingSession()).rejects.toMatchObject({ status: 403 })
  })
  it('requires administrative assurance even when the password session has permissions', async () => {
    arrange('admin', { aal: 'aal1' })
    await expect(getPricingSession()).rejects.toMatchObject({ status: 403, code: 'mfa_required' })
  })
  it('rejects a revoked session reported by the trusted database context', async () => {
    arrange('customer', { session_active: false })
    await expect(getPricingSession()).rejects.toMatchObject({ status: 403 })
  })
  it('returns identities resolved by the database instead of metadata or request data', async () => {
    expect(await getPricingSession()).toMatchObject({
      userId: ids.user,
      profileId: ids.profile,
      customerId: ids.entity,
      role: 'customer',
      permissions: []
    })
    expect(mocks.rpc).toHaveBeenCalledWith('get_session_context')
  })
  it.each(['customer', 'professional', 'admin'] as const)(
    'resolves the current %s role entity',
    async (role) => {
      arrange(role)
      const session = await getPricingSession()
      expect(session).toMatchObject({
        role,
        [role === 'customer'
          ? 'customerId'
          : role === 'professional'
            ? 'professionalId'
            : 'adminProfileId']: ids.entity
      })
    }
  )
  it('returns 401 for expired or absent identity before reading database context', async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: null }, error: { code: 'bad_jwt' } })
    await expect(getPricingSession()).rejects.toMatchObject({ status: 401, code: 'unauthorized' })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('distinguishes an unavailable Auth server from an expired login', async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: null },
      error: { name: 'AuthRetryableFetchError', status: 503 }
    })
    await expect(getPricingSession()).rejects.toMatchObject({
      status: 503,
      code: 'session_unavailable'
    })
  })
  it('does not elevate user-editable metadata', async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: ids.user, app_metadata: {}, user_metadata: { app_role: 'customer' } } },
      error: null
    })
    await expect(getPricingSession()).rejects.toMatchObject({ status: 403, code: 'forbidden' })
  })
  it('denies a profile that changed role after its JWT was issued', async () => {
    arrange('customer', {
      role: 'admin',
      customer_id: null,
      admin_profile_id: ids.entity,
      permissions: ['owner']
    })
    await expect(getPricingSession()).rejects.toMatchObject({ status: 403 })
  })
  it.each([null, {}, { role: 'owner' }, { ...context(), customer_id: null }])(
    'fails closed for incomplete context %j',
    async (data) => {
      mocks.rpc.mockResolvedValue({ data, error: null })
      await expect(getPricingSession()).rejects.toMatchObject({ status: 403 })
    }
  )
  it('denies administrators after their last permission is removed without refreshing the JWT', async () => {
    arrange('admin')
    expect(await getPricingSession()).toMatchObject({ permissions: ['operations'] })
    mocks.rpc.mockResolvedValue({ data: { ...context('admin'), permissions: [] }, error: null })
    await expect(getPricingSession()).rejects.toMatchObject({ status: 403 })
  })
  it('requires the requested current administrative permission', async () => {
    arrange('admin')
    await expect(requireAdminPermission('operations')).resolves.toMatchObject({
      permissions: ['operations']
    })
    await expect(requireAdminPermission('finance')).rejects.toMatchObject({ status: 403 })
  })
  it('accepts owner for each administrative permission', async () => {
    arrange('admin', { permissions: ['owner'] })
    for (const permission of ['operations', 'finance', 'quality', 'owner'] as const) {
      await expect(requireAdminPermission(permission)).resolves.toMatchObject({
        permissions: ['owner']
      })
    }
  })
  it('keeps administrative privileges out of customer and professional panels', async () => {
    arrange('admin', { permissions: ['owner'] })
    await expect(requireRole('customer')).rejects.toMatchObject({ status: 403 })
    await expect(requireRole('professional')).rejects.toMatchObject({ status: 403 })
  })
  it.each(['suspended', 'rejected', 'under_review', 'invited'])(
    'denies operational access to a %s professional',
    async (professional_status) => {
      arrange('professional', { professional_status })
      await expect(getPricingSession()).rejects.toMatchObject({ status: 403 })
    }
  )
  it('fails closed and preserves an unavailable distinction on database failure', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'private server information' } })
    try {
      await getPricingSession()
      expect.fail('must reject')
    } catch (error) {
      const response = pricingError(error)
      expect(response.status).toBe(503)
      expect(response.headers.get('cache-control')).toContain('no-store')
      expect(JSON.stringify(await response.json())).not.toContain('private server information')
    }
  })
})
