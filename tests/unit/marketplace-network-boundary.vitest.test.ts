// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import { OAuthManager } from '@waltergaltieri/mercadopago-split'

const state = vi.hoisted(() => ({ inTransaction: false, query: vi.fn() }))
vi.mock('@/lib/payments/marketplace-db', () => ({
  paymentDatabase: () => ({ query: state.query }),
  paymentTransaction: async (
    work: (database: { query: typeof state.query }) => Promise<unknown>
  ) => {
    state.inTransaction = true
    try {
      return await work({ query: state.query })
    } finally {
      state.inTransaction = false
    }
  }
}))
import { renewCheckout } from '@/lib/payments/marketplace'

beforeEach(() => {
  vi.clearAllMocks()
  for (const [key, value] of Object.entries({
    PAYMENTS_PROVIDER: 'mercadopago_split',
    MERCADOPAGO_MODE: 'test',
    MERCADOPAGO_DATABASE_URL: 'postgres://unused',
    NEXT_PUBLIC_APP_URL: 'https://lysto.test',
    MERCADOPAGO_MARKETPLACE_CLIENT_ID: '123',
    MERCADOPAGO_MARKETPLACE_CLIENT_SECRET: 'secret',
    MERCADOPAGO_WEBHOOK_SECRET: 'hook',
    MERCADOPAGO_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64')
  }))
    vi.stubEnv(key, value)
})

it('keeps every provider request outside database transactions during renewal', async () => {
  const checkout = {
    id: '11111111-1111-4111-8111-111111111111',
    job_id: '22222222-2222-4222-8222-222222222222',
    extra_id: null,
    customer_id: '33333333-3333-4333-8333-333333333333',
    professional_id: '44444444-4444-4444-8444-444444444444',
    seller_account_id: '1234',
    amount: '100.00',
    marketplace_fee: '18.00',
    professional_amount: '82.00',
    live_mode: false,
    status: 'ready',
    preference_id: 'preference-1',
    init_point: null,
    sandbox_init_point: null,
    expires_at: new Date(Date.now() - 60_000),
    created_at: new Date(Date.now() - 3_600_000),
    lease_until: null,
    lease_token: null,
    review_reason: null,
    last_error: null
  }
  state.query.mockImplementation(async (sql: string) => {
    if (sql.startsWith('select * from public.marketplace_checkouts')) return { rows: [checkout] }
    if (sql.startsWith('select 1 from public.marketplace_payment_observations'))
      return { rowCount: 0 }
    if (sql.startsWith('select 1 from public.jobs')) return { rowCount: 1 }
    if (sql.startsWith('update public.marketplace_checkouts set last_reconciled'))
      return { rowCount: 1 }
    if (sql.includes('returning id')) return { rowCount: 1 }
    return { rowCount: 1, rows: [] }
  })
  vi.spyOn(OAuthManager.prototype, 'getValidAccessToken').mockResolvedValue('TEST-fake')
  const fetcher = vi.fn(async (url: string, options: RequestInit) => {
    expect(state.inTransaction).toBe(false)
    if (url.includes('/search?'))
      return new Response(JSON.stringify({ paging: { total: 0 }, results: [] }))
    if (options.method === 'PUT') return new Response(JSON.stringify({ id: 'preference-1' }))
    return new Response(
      JSON.stringify({ id: 'preference-1', collector_id: 1234, external_reference: checkout.id })
    )
  })
  vi.stubGlobal('fetch', fetcher)
  await renewCheckout(checkout)
  expect(fetcher).toHaveBeenCalledTimes(3)
})
