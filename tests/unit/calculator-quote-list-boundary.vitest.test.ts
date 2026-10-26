import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ session: vi.fn() }))
vi.mock('@/lib/pricing/server', async () => ({ ...await vi.importActual('@/lib/pricing/server'), getPricingSession: mocks.session }))
import { GET } from '@/app/api/pricing/quotes/route'

beforeEach(() => vi.clearAllMocks())
it('keeps administrative requests out of the legacy calculator review queue and count', async () => {
  const filters: Array<[string, unknown]> = []
  const query = {
    select: () => query, order: () => query,
    eq: (key: string, value: unknown) => { filters.push([key, value]); return query },
    limit: async () => ({ data: [], error: null }),
    then: (resolve: (value: unknown) => void) => resolve({ count: 0, error: null })
  }
  mocks.session.mockResolvedValue({ role: 'admin', profileId: 'admin', client: { from: () => query } })
  const response = await GET(new Request('http://localhost/api/pricing/quotes'))
  expect(response.status).toBe(200)
  expect(filters.filter(([key,value]) => key === 'quote_origin' && value === 'calculator')).toHaveLength(2)
})
