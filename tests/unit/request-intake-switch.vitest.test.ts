import { afterEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ session: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/pricing/server', async () => ({
  ...(await vi.importActual<typeof import('@/lib/pricing/server')>('@/lib/pricing/server')),
  getPricingSession: mocks.session
}))
import { POST } from '@/app/api/customer/request/submit/route'
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks() })
it('does not accept an existing quote when new web requests are paused', async () => {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://lystohogar.com')
  vi.stubEnv('APP_ENV', 'production')
  vi.stubEnv('PAYMENTS_PROVIDER', 'disabled')
  vi.stubEnv('LYSTO_ACCEPT_NEW_REQUESTS', 'false')
  vi.stubEnv('LYSTO_ALLOW_NEW_CHECKOUTS', 'false')
  mocks.session.mockResolvedValue({ role:'customer', customerId:'customer', client:{rpc:mocks.rpc} })
  mocks.rpc.mockResolvedValue({ data:{jobId:'must-not-be-created'}, error:null })
  const response = await POST(new Request('https://lystohogar.com/api/customer/request/submit', {
    method:'POST', headers:{origin:'https://lystohogar.com','content-type':'application/json'},
    body:JSON.stringify({quoteId:'8c982abc-1285-4217-9186-51c58114047c',expectedVersion:1})
  }))
  expect(response.status).toBe(503)
  expect(await response.json()).toMatchObject({code:'new_requests_paused'})
  expect(mocks.rpc).not.toHaveBeenCalled()
})
