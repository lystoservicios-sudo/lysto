// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ rpc: vi.fn(), create: vi.fn(), prepare: vi.fn() }))
vi.mock('@/lib/pricing/server', () => ({
  getPricingSession: async () => ({
    role: 'customer', customerId: 'f6ff2c3d-bb63-4fa8-bffe-4296dc294a5d',
    userId: 'owner-user', sessionId: 'owner-session', profileId: 'owner-profile',
    client: { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({
      data: { email: 'quimey_boca@hotmail.com' }, error: null
    }) }) }) }) }
  }),
  quoteWriter: () => ({ rpc: state.rpc })
}))
vi.mock('@/lib/payments/marketplace-config', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/payments/marketplace-config')>(),
  marketplaceConfig: () => ({ liveMode: true }), sameOrigin: vi.fn()
}))
vi.mock('@/lib/payments/marketplace-db', () => ({
  paymentDatabase: () => ({ query: async () => ({ rows: [{professional_id:'assigned-professional'}] }) })
}))
vi.mock('@/lib/payments/marketplace-ledger', () => ({ prepareCheckout: state.prepare }))
vi.mock('@/lib/payments/marketplace', () => ({ createCheckoutPreference: state.create }))
vi.mock('@/lib/release/runtime-switches', () => ({ requireNewCheckouts: vi.fn() }))
vi.mock('@/lib/security/rate-limit', () => ({ enforceRateLimit: vi.fn(), requestSubject: () => 'owner', RateLimitExceeded: class extends Error {} }))
import { POST } from '@/app/api/mercadopago/owner-split-test/route'

beforeEach(() => {
  vi.clearAllMocks()
  // Mirror the existing SQL acceptance boundary: an absent currency is not ARS.
  state.rpc.mockImplementation(async (_name, args) => args.p_quote.currency === 'ARS'
    ? { data:'8d48f672-dd86-46f0-926b-faa64a37a8d2', error:null }
    : { data:null, error:{code:'22023',message:'Owner split test quote must remain ARS 100 with the 18/82 split'} })
  state.prepare.mockResolvedValue({id:'checkout',status:'creating'})
  state.create.mockResolvedValue({status:'ready',checkout_protocol:'preferences',init_point:'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=owner'})
})

it('passes the ARS 100 snapshot required by the owner-only SQL operation before creating a checkout', async () => {
  const response=await POST(new Request('https://lysto.test/api/mercadopago/owner-split-test',{method:'POST'}))
  expect(response.status).toBe(200)
  expect(state.rpc).toHaveBeenCalledWith('create_owner_marketplace_split_test_job',expect.objectContaining({
    p_quote:expect.objectContaining({currency:'ARS',total:100,platformFee:18,professionalAmount:82,
      specialPricing:{kind:'owner_maintenance_test',amount:100}})
  }))
  expect(state.prepare).toHaveBeenCalledWith('f6ff2c3d-bb63-4fa8-bffe-4296dc294a5d','8d48f672-dd86-46f0-926b-faa64a37a8d2',undefined,true)
  expect(state.create).toHaveBeenCalledTimes(1)
})
