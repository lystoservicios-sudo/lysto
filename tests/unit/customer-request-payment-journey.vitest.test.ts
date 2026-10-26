// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OAuthManager } from '@waltergaltieri/mercadopago-split'
import { PrismaStorage } from '@waltergaltieri/mercadopago-split/prisma'
import type { CheckoutRow } from '@/lib/payments/marketplace-db'
import { journeyActor, journeyIds as ids, journeyInput, journeyNow, journeyService } from '../fixtures/pedir-journey'

const boundary = vi.hoisted(() => ({ query: vi.fn(), service: null as unknown as ReturnType<typeof journeyService>['service'], actor: null as unknown as typeof journeyActor }))
vi.mock('@/lib/payments/marketplace-db', () => ({ paymentDatabase: () => ({ query: boundary.query }),
  paymentTransaction: async (work: (db: { query: typeof boundary.query }) => Promise<unknown>) => work({ query: boundary.query }) }))
vi.mock('@/lib/customer-requests/service', async importActual => {
  const actual = await importActual<typeof import('@/lib/customer-requests/service')>()
  return { ...actual, customerRequestService: { preview: (...args: Parameters<typeof actual.customerRequestService.preview>) => boundary.service.preview(...args),
    prepare: (...args: Parameters<typeof actual.customerRequestService.prepare>) => boundary.service.prepare(...args) } }
})
vi.mock('@/lib/auth/session', async importActual => ({ ...await importActual<typeof import('@/lib/auth/session')>(), requireSession: async () => boundary.actor }))
vi.mock('@/lib/observability/logger', () => ({ logEvent: () => undefined }))

import { POST as preview } from '@/app/api/customer/requests/preview/route'
import { POST as prepare } from '@/app/api/customer/requests/prepare/route'
import { POST as preference } from '@/app/api/mercadopago/create-preference/route'
import { GET as readCheckouts, POST as reconcile } from '@/app/api/mercadopago/checkouts/route'
import { paymentPresentation } from '@/features/service-request/request-flow-client'
import { checkPaymentReturnToken } from '@/lib/payments/payment-return-token'

type Observation = { provider_payment_id: string; checkout_id: string; provider_status: string; provider_updated_at: string;
  refunded_amount: string; provider_fee: string; net_received_amount: string | null; issues: string[] }
function request(path: string, body?: unknown) {
  return new Request(`https://lysto.test${path}`, { method: body === undefined ? 'GET' : 'POST', headers: {
    Origin: 'https://lysto.test', 'X-Lysto-Customer-Id': ids.customer, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
}

/** Explicit SQL transport fixture. It records real ledger writes but does not execute migrations, RLS, or triggers. */
function paymentTransport(fixture: ReturnType<typeof journeyService>) {
  let checkout: CheckoutRow & { preference_spec?: unknown } | null = null
  const observations = new Map<string, Observation>()
  const projections: unknown[][] = []
  const events = new Set<string>()
  const rows = (value: unknown[] = []) => ({ rows: value, rowCount: value.length })
  boundary.query.mockImplementation(async (query: string, args: unknown[] = []) => {
    const sql = query.replace(/\s+/g, ' ').trim().toLowerCase()
    if (sql.startsWith('select * from private.prepare_marketplace_checkout')) {
      if (!fixture.committed?.quote || args[0] !== ids.customer || args[1] !== ids.job) throw new Error('accepted_quote_required')
      checkout ??= { id: ids.checkout, job_id: ids.job, extra_id: null, customer_id: ids.customer,
        professional_id: ids.professional, seller_account_id: '1234', amount: fixture.committed.quote.total.toFixed(2),
        marketplace_fee: fixture.committed.quote.platformFee.toFixed(2), professional_amount: fixture.committed.quote.professionalAmount.toFixed(2),
        live_mode: false, status: 'creating', checkout_protocol: 'preferences', preference_id: null, order_id: null,
        order_idempotency_key: ids.checkout, checkout_url: null, init_point: null, sandbox_init_point: null,
        expires_at: new Date(fixture.committed.expiresAt!), created_at: journeyNow, lease_until: null, lease_token: null,
        review_reason: null, closed_for_new_payments_at: null, last_error: null }
      return rows([checkout])
    }
    if (!checkout) throw new Error(`Checkout not prepared for fixture query: ${sql}`)
    if (sql.startsWith('select c.*,exists')) return rows([{ ...checkout, active_financial_exception: false }])
    if (sql.startsWith('update public.marketplace_checkouts set preference_spec=')) {
      checkout.preference_spec = JSON.parse(args[1] as string); checkout.lease_token = args[2] as string
      return rows()
    }
    if (sql.startsWith('update public.marketplace_checkouts set preference_id=')) {
      if (args[1] !== checkout.lease_token) return rows()
      checkout.preference_id = args[2] as string; checkout.init_point = args[3] as string; checkout.sandbox_init_point = args[4] as string
      checkout.status = 'ready'; checkout.lease_token = null; checkout.lease_until = null
      return rows([checkout])
    }
    if (sql.startsWith('select job_id')) return rows([{ job_id: ids.job, customer_id: ids.customer, professional_id: ids.professional }])
    if (sql.includes('from public.customer_profiles')) return rows([{ id: ids.customer }])
    if (sql.includes('from public.professional_profiles')) return rows([{ id: ids.professional }])
    if (sql.includes('from public.jobs where id=$1')) return rows([{ professional_id: ids.professional, status: 'confirmed', request_id: ids.request }])
    if (sql.startsWith('select * from public.marketplace_checkouts')) return rows([checkout])
    if (sql.startsWith('update public.marketplace_checkouts set last_reconciled_at=')) return rows([{ id: ids.checkout }])
    if (sql.startsWith('insert into private.marketplace_applied_events')) {
      if (events.has(args[0] as string)) return rows()
      events.add(args[0] as string); return rows([{ event_id: args[0] }])
    }
    if (sql.startsWith('select checkout_id,provider_updated_at')) return rows(observations.has(args[0] as string) ? [observations.get(args[0] as string)] : [])
    if (sql.startsWith('insert into public.marketplace_payment_observations')) {
      observations.set(args[0] as string, { provider_payment_id: args[0] as string, checkout_id: args[1] as string, provider_status: args[2] as string,
        provider_updated_at: args[3] as string, refunded_amount: args[4] as string, provider_fee: args[5] as string,
        net_received_amount: args[6] as string | null, issues: JSON.parse(args[7] as string) })
      return rows()
    }
    if (sql.startsWith('select provider_status,issues')) return rows([...observations.values()])
    if (sql.startsWith('update public.marketplace_checkouts set status=')) {
      checkout.status = args[1] as string; checkout.review_reason = args[2] as string | null
      return rows([{ status: checkout.status }])
    }
    if (sql.startsWith('insert into public.payments')) { projections.push(args); return rows([{ id: ids.quote }]) }
    if (sql.startsWith('insert into public.payment_events')) return rows()
    if (sql.startsWith('select c.id,c.job_id')) return rows([{ ...checkout, observations: [...observations.values()].map(value => ({
      paymentId: value.provider_payment_id, status: value.provider_status, providerFee: value.provider_fee, netReceived: value.net_received_amount, refunded: value.refunded_amount })) }])
    throw new Error(`Unexpected fixture database query: ${sql}`)
  })
  return { get checkout() { return checkout! }, observations, projections }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(journeyNow)
  boundary.actor = journeyActor
  for (const [name, value] of Object.entries({ APP_ENV: 'test', PAYMENTS_PROVIDER: 'mercadopago_split', NEXT_PUBLIC_APP_URL: 'https://lysto.test',
    LYSTO_ACCEPT_NEW_REQUESTS: 'true', LYSTO_ALLOW_NEW_CHECKOUTS: 'true', MERCADOPAGO_ORDERS_ENABLED: 'false', RATE_LIMIT_HASH_KEY: '',
    MERCADOPAGO_MODE: 'test', MERCADOPAGO_MARKETPLACE_CLIENT_ID: '123', MERCADOPAGO_MARKETPLACE_CLIENT_SECRET: 'fixture-secret',
    MERCADOPAGO_WEBHOOK_SECRET: 'fixture-hook', MERCADOPAGO_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
    MERCADOPAGO_DATABASE_URL: 'postgres://unused@127.0.0.1:1/never-connect' })) vi.stubEnv(name, value)
  vi.spyOn(OAuthManager.prototype, 'getValidAccessToken').mockResolvedValue('TEST-fixture-seller-token')
  vi.spyOn(PrismaStorage.prototype, 'getConnectedAccount').mockResolvedValue({ sellerId: ids.professional, mercadoPagoUserId: '1234',
    encryptedAccessToken: 'fixture-only', encryptedRefreshToken: null, accessTokenExpiresAt: new Date('2028-01-11T00:00:00Z'),
    enabled: true, createdAt: journeyNow, updatedAt: journeyNow })
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers() })

describe('Pedir complete HTTP/calculator/ledger boundary journey, without external services', () => {
  it.each([0, 3, 12.5])('keeps the frozen gross split while separately recording a reported provider charge of ARS %s', async providerFee => {
    const fixture = journeyService(); boundary.service = fixture.service
    const db = paymentTransport(fixture)
    let providerStatus = 'pending'
    const outboundPreferences: Record<string, unknown>[] = []
    // Every provider request is intercepted; unknown paths fail rather than touching the network.
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input))
      expect(url.origin).toBe('https://api.mercadopago.com')
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer TEST-fixture-seller-token')
      if (url.pathname === '/checkout/preferences') {
        expect(init?.method).toBe('POST'); outboundPreferences.push(JSON.parse(String(init?.body)))
        return Response.json({ id: 'fixture-preference', init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=fixture-preference', sandbox_init_point: null })
      }
      if (url.pathname === '/v1/payments/search') {
        expect(url.searchParams.get('external_reference')).toBe(ids.checkout)
        return Response.json({ paging: { total: 1 }, results: [{ id: 444 }] })
      }
      if (url.pathname === '/v1/payments/444') return Response.json({ id: 444, collector_id: 1234, external_reference: ids.checkout, currency_id: 'ARS',
        transaction_amount: Number(db.checkout.amount), transaction_amount_refunded: 0, live_mode: false, status: providerStatus,
        date_last_updated: providerStatus === 'pending' ? '2028-01-10T12:01:00Z' : '2028-01-10T12:02:00Z',
        fee_details: providerStatus === 'pending' ? [] : [{ type: 'application_fee', amount: Number(db.checkout.marketplace_fee) }, { type: 'mercadopago_fee', amount: providerFee }],
        transaction_details: providerStatus === 'pending' ? {} : { net_received_amount: Number(db.checkout.professional_amount) - providerFee } })
      throw new Error(`Unexpected provider request: ${url.pathname}`)
    }))

    const quoted = await preview(request('/api/customer/requests/preview', journeyInput))
    expect(quoted.status).toBe(200); expect(quoted.headers.get('cache-control')).toContain('no-store')
    const quote = await quoted.json()
    expect(quote).toMatchObject({ status: 'ready', previewId: ids.preview, quote: { paymentCostBudget: 0, platformFeeRate: .18, readyToOffer: true, reviewReasons: [] } })
    expect(fixture.policy.paymentCostRate).toBe(.06)
    expect(JSON.stringify(quote)).not.toContain('Base privada')

    const command = { previewId: ids.preview, commandId: ids.command }
    const prepared = await prepare(request('/api/customer/requests/prepare', command))
    expect(prepared.status).toBe(200)
    expect(await prepared.json()).toMatchObject({ status: 'ready', jobId: ids.job, requestId: ids.request, quoteId: ids.quote, quote: quote.quote })
    expect((await prepare(request('/api/customer/requests/prepare', command))).status).toBe(200)
    expect(fixture.preparations).toBe(1)

    const created = await preference(request('/api/mercadopago/create-preference', { jobId: ids.job }))
    expect(created.status).toBe(200)
    expect(await created.json()).toMatchObject({ checkoutId: ids.checkout, status: 'ready', initPoint: expect.stringContaining('fixture-preference') })
    expect(outboundPreferences).toHaveLength(1)
    expect(outboundPreferences[0]).toMatchObject({ external_reference: ids.checkout, marketplace_fee: quote.quote.platformFee,
      items: [expect.objectContaining({ unit_price: quote.quote.total, quantity: 1, currency_id: 'ARS' })] })
    expect(outboundPreferences[0]).not.toHaveProperty('paymentCostBudget')
    expect(outboundPreferences[0]).not.toHaveProperty('paymentCostRate')
    for (const destination of Object.values(outboundPreferences[0].back_urls as Record<string, string>)) {
      const returnUrl = new URL(destination)
      expect(returnUrl.origin).toBe('https://lysto.test')
      expect(returnUrl.pathname).toBe(`/app/pagos/resultado/${ids.checkout}`)
      expect(checkPaymentReturnToken(ids.checkout, returnUrl.searchParams.get('confirmacion')!, Buffer.alloc(32, 1).toString('base64'))).toBe(true)
    }
    const frozenSplit = { amount: db.checkout.amount, marketplace_fee: db.checkout.marketplace_fee, professional_amount: db.checkout.professional_amount }

    const refresh = () => reconcile(request('/api/mercadopago/checkouts', { checkoutId: ids.checkout, action: 'reconcile_return' }))
    expect((await refresh()).status).toBe(200)
    const pending = await (await readCheckouts(request(`/api/mercadopago/checkouts?jobId=${ids.job}&status=approved`))).json()
    expect(pending.checkouts[0].status).toBe('pending')
    expect(paymentPresentation(pending.checkouts[0].status).title).toBe('Estamos comprobando tu pago')

    providerStatus = 'approved'
    expect((await refresh()).status).toBe(200)
    const approved = await (await readCheckouts(request(`/api/mercadopago/checkouts?jobId=${ids.job}`))).json()
    expect(approved.checkouts[0]).toMatchObject({ amount: frozenSplit.amount, status: 'approved',
      observations: [{ paymentId: '444', status: 'approved', refunded: '0.00' }] })
    expect(approved.checkouts[0]).not.toHaveProperty('marketplace_fee')
    expect(approved.checkouts[0]).not.toHaveProperty('professional_amount')
    expect(approved.checkouts[0].observations[0]).not.toHaveProperty('providerFee')
    expect(approved.checkouts[0].observations[0]).not.toHaveProperty('netReceived')
    expect(db.checkout).toMatchObject(frozenSplit)
    expect(paymentPresentation(approved.checkouts[0].status).title).toBe('Pago confirmado')
    expect(db.observations.get('444')).toMatchObject({ provider_fee: providerFee.toFixed(2),
      net_received_amount: (Number(frozenSplit.professional_amount) - providerFee).toFixed(2), issues: [] })
    expect(db.projections).toHaveLength(2)
    expect(db.projections.map(projection => projection[6])).toEqual(['pending', 'approved'])
    expect(db.projections.map(projection => projection[4])).toEqual(['444', '444'])
    for (const projection of db.projections) expect(projection.slice(8, 10)).toEqual([frozenSplit.marketplace_fee, frozenSplit.professional_amount])
    expect(fixture.committed?.quote).toEqual(quote.quote)

    expect((await preference(request('/api/mercadopago/create-preference', { jobId: ids.job }))).status).toBe(200)
    expect(outboundPreferences).toHaveLength(1)
    expect(fixture.preparations).toBe(1)
  })
})
