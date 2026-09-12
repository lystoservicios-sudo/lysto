// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ client: vi.fn(), travel: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: mocks.client }))
vi.mock('@/lib/pricing/google-routes', () => ({ estimateTravel: mocks.travel }))
import { POST as quote } from '@/app/api/pricing/quote/route'
import { POST as approve } from '@/app/api/admin/professionals/approve/route'
import { POST as equipment } from '@/app/api/equipment/register/route'
import { POST as report } from '@/app/api/jobs/final-report/route'
import { POST as upload } from '@/app/api/uploads/sign/route'
import PublicReceiptPage from '@/app/comprobante/[token]/page'

function request(path: string, body: unknown = {}) {
  return new Request(`https://lysto.test${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://lysto.test' },
    body: JSON.stringify(body)
  })
}
function actor(role = 'admin', permissions = ['operations']) {
  const ctx = {
    profile_id: '00000000-0000-4000-8000-000000000002',
    role,
    session_id: '00000000-0000-4000-8000-000000000001',
    session_active: true,
    aal: 'aal2',
    admin_profile_id: role === 'admin' ? '00000000-0000-4000-8000-000000000003' : null,
    customer_id: role === 'customer' ? '00000000-0000-4000-8000-000000000004' : null,
    professional_id: role === 'professional' ? '00000000-0000-4000-8000-000000000005' : null,
    professional_status: role === 'professional' ? 'approved' : null,
    professional_eligible: role === 'professional',
    permissions: role === 'admin' ? permissions : []
  }
  const from = vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: ctx.profile_id, role }, error: null })
  }))
  const rpc = vi.fn().mockResolvedValue({ data: ctx, error: null })
  mocks.client.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: { id: '00000000-0000-4000-8000-000000000001', app_metadata: { app_role: role } }
        },
        error: null
      })
    },
    rpc,
    from
  })
  return { rpc, from }
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://lysto.test')
  actor()
})

describe('authorization before parsing input or side effects', () => {
  it('does not issue a public receipt before token-backed publication is implemented', () => {
    expect(() => PublicReceiptPage()).toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
  })
  it('rejects a finance administrator before privileged quote calculation', async () => {
    actor('admin', ['finance'])
    const response = await quote(request('/api/pricing/quote'))
    expect(response.status).toBe(403)
    expect(mocks.travel).not.toHaveBeenCalled()
  })
  it.each([
    ['/api/admin/professionals/approve', approve],
    ['/api/equipment/register', equipment],
    ['/api/jobs/final-report', report],
    ['/api/uploads/sign', upload]
  ] as const)('rejects anonymous %s before evaluating attacker input', async (path, handler) => {
    mocks.client.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) }
    })
    const response = await handler(request(path, { adminProfileId: 'forged', ownerId: 'forged' }))
    expect(response.status).toBe(401)
    expect(response.headers.get('cache-control')).toContain('no-store')
  })
  it('rejects forged actor fields on the implemented professional approval endpoint', async () => {
    actor()
    const response = await approve(
      request('/api/admin/professionals/approve', { adminProfileId: 'forged' })
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'invalid_input' })
  })
  it('does not allow a customer to approve a professional', async () => {
    actor('customer', [])
    const response = await approve(request('/api/admin/professionals/approve'))
    expect(response.status).toBe(403)
  })
})
