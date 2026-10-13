import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/http/api-error'
import CustomerJobsPage from '@/app/(customer)/app/trabajos/page'
import CustomerQuotesPage from '@/app/(customer)/app/presupuestos/page'
import { CustomerQuoteDetail } from '@/components/customer/customer-quote-detail'
import { GET } from '@/app/api/customer/services/route'

const state = vi.hoisted(() => ({ role: 'customer', load: vi.fn(), guard: vi.fn() }))
const empty = { items: [], nextServiceCursor: null, nextQuoteCursor: null, unavailableSections: [] }
vi.mock('@/lib/customer/services-model', () => ({ loadCustomerServices: state.load }))
vi.mock('@/lib/customer/live-model', () => ({ listCustomerJobsLive: async () => ({ items: [], nextCursor: null, total: 0 }) }))
vi.mock('@/lib/auth/session', () => ({
  requirePageSession: async (role: string) => { state.guard(role); return { role: state.role, profileId: 'profile-1', customerId: 'customer-1' } },
  requireSession: async () => ({ role: state.role, profileId: 'profile-1', customerId: 'customer-1' }),
  requireRole: async (roles: string[], session: { role: string }) => { if (!roles.includes(session.role)) throw new ApiError('forbidden') },
  requireAdminPermission: async () => undefined
}))
vi.mock('@/lib/observability/logger', () => ({ logEvent: vi.fn() }))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('not-found') } }))

afterEach(() => { cleanup(); vi.clearAllMocks(); state.role = 'customer' })

describe('customer Services route integration', () => {
  it('renders the new Services screen from an authenticated paginated model', async () => {
    state.load.mockResolvedValue(empty)
    render(await CustomerJobsPage({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole('heading', { name: 'Servicios', level: 1 })).toBeTruthy()
    expect(state.guard).toHaveBeenCalledWith('customer')
    expect(state.load).toHaveBeenCalled()
  })

  it('passes the selected history filter to the server loader', async () => {
    state.load.mockResolvedValue(empty)
    await CustomerJobsPage({ searchParams: Promise.resolve({ filter: 'finished' }) })
    expect(state.load.mock.calls[0][1]).toMatchObject({ filter: 'finished' })
  })

  it('opens an individual pre-job quote without asking the job API for a missing job', async () => {
    const quoteId = '10000000-0000-4000-8000-000000000001'
    const element = await CustomerQuotesPage({ searchParams: Promise.resolve({ presupuesto: quoteId }) })
    expect(element.type).toBe(CustomerQuoteDetail)
    expect(element.props.quoteId).toBe(quoteId)
  })

  it('rejects invalid quote ids in the page', async () => {
    await expect(CustomerQuotesPage({ searchParams: Promise.resolve({ presupuesto: 'not-an-id' }) })).rejects.toThrow('not-found')
  })

  it('returns a private customer-only page through the existing authenticated route wrapper', async () => {
    state.load.mockResolvedValue(empty)
    const response = await GET(new Request('http://localhost/api/customer/services?filter=scheduled'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(empty)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(state.load.mock.calls[0][1]).toMatchObject({ filter: 'scheduled' })
  })

  it('blocks other roles before the service loader is called', async () => {
    state.role = 'professional'
    const response = await GET(new Request('http://localhost/api/customer/services'))
    expect(response.status).toBe(403)
    expect(state.load).not.toHaveBeenCalled()
  })

  it.each(['filter=anything', 'pageSize=101', 'source=admin', 'unknown=1'])(
    'rejects malformed query %s before querying', async (query) => {
      const response = await GET(new Request(`http://localhost/api/customer/services?${query}`))
      expect(response.status).toBe(400)
      expect(state.load).not.toHaveBeenCalled()
    }
  )
})
