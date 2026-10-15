// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import JobPage from '@/app/(customer)/app/trabajos/[id]/page'
import RequestPage from '@/app/(customer)/app/solicitudes/[id]/page'
import { JobQuotePanel } from '@/components/pricing/job-quote-panel'
import { ApiError } from '@/lib/http/api-error'

const boundary = vi.hoisted(() => ({ session: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ requirePageSession: boundary.session }))

const owner = '90000000-0000-4000-8000-000000000001'
const otherOwner = '90000000-0000-4000-8000-000000000002'
const owned = { id: '20000000-0000-4000-8000-000000000001', request_id: '10000000-0000-4000-8000-000000000001', customer_id: owner }
const foreign = { id: '20000000-0000-4000-8000-000000000002', request_id: '10000000-0000-4000-8000-000000000002', customer_id: otherOwner }
const calls: Array<{ table: string; select?: string; filters: Array<[string, unknown]> }> = []
let databaseFailure: 'response' | 'network' | null = null

// Only the external PostgREST boundary is replaced; its equality filters are applied.
const client = {
  from(table: string) {
    const call = { table, select: undefined as string | undefined, filters: [] as Array<[string, unknown]> }
    calls.push(call)
    const query = {
      select: (columns: string) => { call.select = columns; return query },
      eq: (column: string, value: unknown) => { call.filters.push([column, value]); return query },
      async maybeSingle() {
        if (databaseFailure === 'network') throw new Error('private transport details')
        if (databaseFailure === 'response') return { data: null, error: { message: 'private database details' } }
        const data = [owned, foreign].find(row => call.filters.every(([column, value]) => row[column as keyof typeof row] === value))
        return { data: data ? { id: data.id } : null, error: null }
      }
    }
    return query
  }
}

beforeEach(() => {
  calls.length = 0
  databaseFailure = null
  boundary.session.mockReset().mockResolvedValue({ role: 'customer', customerId: owner, client })
})

describe.each([
  ['job', JobPage, 'id', 'jobId'],
  ['request', RequestPage, 'request_id', 'requestId']
] as const)('owned customer %s detail page', (_name, Page, field, prop) => {
  it('authorizes an owned job before mounting the existing panel', async () => {
    const page = await Page({ params: Promise.resolve({ id: owned[field] }) })
    expect(boundary.session).toHaveBeenCalledWith('customer')
    expect(calls).toEqual([{ table: 'jobs', select: 'id', filters: [[field, owned[field]], ['customer_id', owner]] }])
    expect(page.type).toBe(JobQuotePanel)
    expect(page.props).toEqual({ [prop]: owned[field] })
  })

  it('uses the local 404 for a valid id belonging to another customer', async () => {
    await expect(Page({ params: Promise.resolve({ id: foreign[field] }) })).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
    expect(calls[0]?.filters).toContainEqual(['customer_id', owner])
  })

  it('uses the same 404 for an absent valid id', async () => {
    await expect(Page({ params: Promise.resolve({ id: '70000000-0000-4000-8000-000000000099' }) })).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
  })

  it.each(['response', 'network'] as const)('keeps a %s database failure distinct from a 404', async failure => {
    databaseFailure = failure
    await expect(Page({ params: Promise.resolve({ id: owned[field] }) })).rejects.toMatchObject({ code: 'service_unavailable', status: 503, message: 'service_unavailable' })
  })

  it('rejects a malformed id before a data query', async () => {
    await expect(Page({ params: Promise.resolve({ id: 'not-an-id' }) })).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
    expect(calls).toEqual([])
  })

  it('preserves the real page session guard failure without querying', async () => {
    const denied = new ApiError('unauthorized')
    boundary.session.mockRejectedValue(denied)
    await expect(Page({ params: Promise.resolve({ id: owned[field] }) })).rejects.toBe(denied)
    expect(calls).toEqual([])
  })

  it('fails closed if an invalid customer session has no customer id', async () => {
    boundary.session.mockResolvedValue({ role: 'customer', client })
    await expect(Page({ params: Promise.resolve({ id: owned[field] }) })).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
    expect(calls).toEqual([])
  })
})
