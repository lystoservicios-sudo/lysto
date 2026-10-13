// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'

import type { Session } from '@/lib/auth/session'
import { loadCustomerServices } from '@/lib/customer/services-model'

const owner = '90000000-0000-4000-8000-000000000001'
const otherOwner = '90000000-0000-4000-8000-000000000002'
const id = (prefix: number, sequence: number) => `${prefix}0000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`
type Row = Record<string, unknown>
const tables: Record<string, Row[]> = {}
const calls: Array<{ table: string; filters: Array<[string, string, unknown]>; limit?: number }> = []
const errors = new Set<string>()
const visits = new Map<string, unknown>()
const rpcCalls: string[] = []

// The external PostgREST boundary is replaced, not the projection or pagination code.
const client = {
  from(table: string) {
    const record: (typeof calls)[number] = { table, filters: [] }
    calls.push(record)
    const orders: string[] = []
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => { record.filters.push(['eq', column, value]); return query },
      neq: (column: string, value: unknown) => { record.filters.push(['neq', column, value]); return query },
      is: (column: string, value: unknown) => { record.filters.push(['eq', column, value]); return query },
      in: (column: string, value: unknown[]) => { record.filters.push(['in', column, value]); return query },
      or: (value: string) => { record.filters.push(['or', '', value]); return query },
      order: (column: string) => { orders.push(column); return query },
      limit: (value: number) => { record.limit = value; return query },
      then: (resolve: (result: { data: Row[] | null; error: null | { message: string } }) => unknown) => {
        if (errors.has(table)) return Promise.resolve(resolve({ data: null, error: { message: 'unavailable' } }))
        let rows = [...(tables[table] ?? [])]
        for (const [operation, column, value] of record.filters) {
          if (operation === 'eq') rows = rows.filter((row) => row[column] === value)
          if (operation === 'neq') rows = rows.filter((row) => row[column] !== value)
          if (operation === 'in') rows = rows.filter((row) => (value as unknown[]).includes(row[column]))
          if (operation === 'or') {
            const match = String(value).match(/^created_at\.lt\.(.+),and\(created_at\.eq\.(.+),id\.lt\.(.+)\)$/)
            if (!match) throw new Error('Unsupported pagination expression')
            rows = rows.filter((row) => String(row.created_at) < match[1] ||
              (row.created_at === match[2] && String(row.id) < match[3]))
          }
        }
        rows.sort((a, b) => {
          for (const column of orders) {
            const comparison = String(b[column]).localeCompare(String(a[column]))
            if (comparison) return comparison
          }
          return 0
        })
        return Promise.resolve(resolve({ data: rows.slice(0, record.limit ?? rows.length), error: null }))
      }
    }
    return query
  },
  async rpc(_name: string, { p_job_id }: { p_job_id: string }) {
    rpcCalls.push(p_job_id)
    return { data: visits.get(p_job_id) ?? null, error: null }
  }
}
const session = {
  role: 'customer', profileId: owner, customerId: owner, client
} as unknown as Session
const now = '2026-10-13T12:00:00.000Z'

function request(sequence: number, customerId = owner): Row {
  return {
    id: id(1, sequence), customer_id: customerId, status: 'assigned', issue_type_id: id(7, 1),
    address_id: id(8, 1), equipment_id: id(6, 1),
    created_at: `2026-10-${String(sequence).padStart(2, '0')}T12:00:00.123456+00:00`
  }
}
function job(sequence: number, status = 'completed', customerId = owner): Row {
  return {
    id: id(2, sequence), customer_id: customerId, request_id: id(1, sequence), status,
    final_amount: 40000, completed_at: status === 'completed' ? now : null
  }
}
function quote(sequence: number, overrides: Row = {}): Row {
  return {
    id: id(3, sequence), customer_id: owner, request_id: null, status: 'ready',
    quote: { scope: 'Mantenimiento', total: 40000 }, address: { street: 'Pavón', number: '2012', city: 'CABA' },
    created_at: `2026-10-${String(sequence).padStart(2, '0')}T12:00:00.123456+00:00`,
    expires_at: '2026-10-20T12:00:00Z', ...overrides
  }
}

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key]
  tables.service_requests = []
  tables.jobs = []
  tables.service_quotes = []
  tables.marketplace_checkouts = []
  tables.service_issue_types = [{ id: id(7, 1), name: 'Mantenimiento' }]
  tables.customer_equipment = [{ id: id(6, 1), customer_id: owner, nickname: 'Aire del living' }]
  tables.customer_addresses = [{ id: id(8, 1), customer_id: owner, street: 'Pavón', number: '2012', city: 'CABA' }]
  calls.length = 0
  rpcCalls.length = 0
  errors.clear()
  visits.clear()
})

describe('customer services loader', () => {
  it('finds the job related to the request page, even when its own creation order differs', async () => {
    tables.service_requests = [request(1), request(2)]
    tables.jobs = [job(1), job(2)]
    tables.service_quotes = [quote(2, { request_id: id(1, 2), status: 'accepted' })]
    const page = await loadCustomerServices(session, { pageSize: 1 }, now)
    expect(page.items).toHaveLength(1)
    expect(page.items[0]).toMatchObject({ id: `request:${id(1, 2)}`, jobId: id(2, 2), quoteId: id(3, 2) })
    expect(page.nextServiceCursor).not.toBeNull()
    const next = await loadCustomerServices(session, { pageSize: 1, source: 'services', serviceCursor: page.nextServiceCursor! }, now)
    expect(next.items.map((item) => item.id)).toEqual([`request:${id(1, 1)}`])
    expect(next.nextServiceCursor).toBeNull()
  })

  it('applies owner predicates to every customer-specific direct lookup', async () => {
    tables.service_requests = [request(1), request(2, otherOwner)]
    tables.jobs = [job(1), job(1, 'confirmed', otherOwner)]
    tables.service_quotes = [quote(1), quote(2, { customer_id: otherOwner })]
    const page = await loadCustomerServices(session, {}, now)
    expect(page.items.map((item) => item.id)).toEqual(expect.arrayContaining([`request:${id(1, 1)}`, `quote:${id(3, 1)}`]))
    expect(page.items).toHaveLength(2)
    for (const call of calls.filter((item) => item.table !== 'service_issue_types')) {
      expect(call.filters).toContainEqual(['eq', 'customer_id', owner])
    }
  })

  it.each([{ role: 'admin' }, { customerId: undefined }])('rejects invalid customer authority before reading', async (override) => {
    await expect(loadCustomerServices({ ...session, ...override } as Session, {}, now)).rejects.toThrow()
    expect(calls).toEqual([])
  })

  it('keeps quote pagination independent and excludes accepted or substituted budgets', async () => {
    tables.service_quotes = [quote(1), quote(2), quote(3, { status: 'superseded' }), quote(4, { request_id: id(1, 4), status: 'accepted' })]
    const first = await loadCustomerServices(session, { source: 'quotes', pageSize: 1 }, now)
    expect(first.items.map((item) => item.id)).toEqual([`quote:${id(3, 2)}`])
    expect(first.nextServiceCursor).toBeNull()
    expect(first.nextQuoteCursor).not.toBeNull()
    const second = await loadCustomerServices(session, { source: 'quotes', pageSize: 1, quoteCursor: first.nextQuoteCursor! }, now)
    expect(second.items.map((item) => item.id)).toEqual([`quote:${id(3, 1)}`])
    expect(second.nextQuoteCursor).toBeNull()
  })

  it('does not mix quotes or pending conformity into the finished filter', async () => {
    tables.service_requests = [request(1), request(2)]
    tables.jobs = [job(1), job(2, 'completed_pending_customer_confirmation')]
    tables.service_quotes = [quote(1), quote(2)]
    const page = await loadCustomerServices(session, { filter: 'finished', pageSize: 1 }, now)
    expect(page.items.map((item) => item.jobId)).toEqual([id(2, 1)])
    expect(page.nextQuoteCursor).toBeNull()
    expect(calls.filter((call) => call.table === 'service_quotes' && call.filters.some(([operation, column]) => operation === 'eq' && column === 'request_id'))).toEqual([])
  })

  it('does not scan pre-job quotes under the scheduled filter', async () => {
    tables.service_quotes = [quote(1), quote(2)]
    const page = await loadCustomerServices(session, { filter: 'scheduled', source: 'quotes', pageSize: 1 }, now)
    expect(page.items).toEqual([])
    expect(page.nextQuoteCursor).toBeNull()
    expect(calls).toEqual([])
  })

  it('filters before filling the visible page instead of filtering just its first source page', async () => {
    tables.service_requests = [request(1), request(2), request(3)]
    tables.jobs = [job(1), job(2, 'in_progress'), job(3, 'in_progress')]
    const page = await loadCustomerServices(session, { source: 'services', pageSize: 1, filter: 'finished' }, now)
    expect(page.items.map((item) => item.jobId)).toEqual([id(2, 1)])
    expect(page.nextServiceCursor).toBeNull()
  })

  it('returns a continuation after four nonmatching batches without claiming the history is empty', async () => {
    tables.service_requests = Array.from({ length: 8 }, (_, index) => request(index + 1))
    tables.jobs = Array.from({ length: 8 }, (_, index) => job(index + 1, index === 0 ? 'completed' : 'in_progress'))
    const first = await loadCustomerServices(session, { source: 'services', pageSize: 1, filter: 'finished' }, now)
    expect(first.items).toEqual([])
    expect(first.nextServiceCursor).not.toBeNull()
    expect(calls.filter((call) => call.table === 'service_requests')).toHaveLength(4)
    const next = await loadCustomerServices(session, { source: 'services', pageSize: 1, filter: 'finished', serviceCursor: first.nextServiceCursor! }, now)
    expect(next.items[0].jobId).toBe(id(2, 1))
  })

  it('continues at the last examined source row when the visible page fills halfway through a batch', async () => {
    tables.service_requests = Array.from({ length: 6 }, (_, index) => request(index + 1))
    tables.jobs = Array.from({ length: 6 }, (_, index) => job(index + 1, index === 5 ? 'in_progress' : 'completed'))
    const first = await loadCustomerServices(session, { source: 'services', pageSize: 2, filter: 'finished' }, now)
    expect(first.items.map((item) => item.jobId)).toEqual([id(2, 5), id(2, 4)])
    const next = await loadCustomerServices(session, {
      source: 'services', pageSize: 2, filter: 'finished', serviceCursor: first.nextServiceCursor!
    }, now)
    expect(next.items.map((item) => item.jobId)).toEqual([id(2, 3), id(2, 2)])
    const last = await loadCustomerServices(session, {
      source: 'services', pageSize: 2, filter: 'finished', serviceCursor: next.nextServiceCursor!
    }, now)
    expect(last.items.map((item) => item.jobId)).toEqual([id(2, 1)])
    expect(last.nextServiceCursor).toBeNull()
  })

  it('binds cursors to the customer, source and filter', async () => {
    tables.service_requests = [request(1), request(2)]
    const first = await loadCustomerServices(session, { source: 'services', pageSize: 1 }, now)
    const serviceCursor = first.nextServiceCursor!
    await expect(loadCustomerServices({ ...session, profileId: otherOwner, customerId: otherOwner }, { source: 'services', serviceCursor }, now)).rejects.toThrow()
    await expect(loadCustomerServices(session, { source: 'services', filter: 'finished', serviceCursor }, now)).rejects.toThrow()
    await expect(loadCustomerServices(session, { source: 'quotes', quoteCursor: serviceCursor }, now)).rejects.toThrow()
  })

  it('does not program a confirmed service paid only by an additional checkout', async () => {
    tables.service_requests = [request(1)]
    tables.jobs = [job(1, 'confirmed')]
    tables.marketplace_checkouts = [{ customer_id: owner, job_id: id(2, 1), extra_id: id(5, 1), status: 'approved' }]
    visits.set(id(2, 1), {
      startsAt: '2026-10-14T15:00:00Z', endsAt: '2026-10-14T17:00:00Z',
      timezone: 'America/Argentina/Buenos_Aires', professionalName: 'Ana Pérez', confirmed: true
    })
    const page = await loadCustomerServices(session, { source: 'services' }, now)
    expect(page.items[0].phase).toBe('attention')
    expect(page.items[0].visit).toBeNull()
  })

  it('loads a canonical confirmed visit for an approved initial payment', async () => {
    tables.service_requests = [request(1)]
    tables.jobs = [job(1, 'confirmed')]
    tables.marketplace_checkouts = [{ customer_id: owner, job_id: id(2, 1), extra_id: null, status: 'approved' }]
    visits.set(id(2, 1), {
      startsAt: '2026-10-14T15:00:00Z', endsAt: '2026-10-14T17:00:00Z',
      timezone: 'America/Argentina/Buenos_Aires', professionalName: 'Ana Pérez', confirmed: true
    })
    const page = await loadCustomerServices(session, { source: 'services' }, now)
    expect(page.items[0]).toMatchObject({ phase: 'scheduled', visit: { professionalName: 'Ana Pérez' } })
    expect(rpcCalls).toEqual([id(2, 1)])
  })

  it.each(['review', 'refunded', 'charged_back'])(
    'does not load or advertise a schedule with contradictory approved and %s initial checkouts', async (status) => {
      tables.service_requests = [request(1)]
      tables.jobs = [job(1, 'confirmed')]
      tables.marketplace_checkouts = [
        { customer_id: owner, job_id: id(2, 1), extra_id: null, status: 'approved' },
        { customer_id: owner, job_id: id(2, 1), extra_id: null, status }
      ]
      visits.set(id(2, 1), {
        startsAt: '2026-10-14T15:00:00Z', endsAt: '2026-10-14T17:00:00Z',
        timezone: 'America/Argentina/Buenos_Aires', professionalName: 'Ana Pérez', confirmed: true
      })
      const page = await loadCustomerServices(session, { source: 'services' }, now)
      expect(page.items[0].statusLabel).toBe('Estado del pago por consultar')
      expect(page.items[0].visit).toBeNull()
      expect(rpcCalls).toEqual([])
    }
  )

  it('keeps a malformed quote expiration out of the ready cards and reports its source failure', async () => {
    tables.service_quotes = [quote(1, { expires_at: 'invalid' })]
    const page = await loadCustomerServices(session, { source: 'quotes' }, now)
    expect(page.items).toEqual([])
    expect(page.unavailableSections).toContain('presupuestos')
  })

  it('keeps surviving services when quotes fail and reports the unavailable source', async () => {
    tables.service_requests = [request(1)]
    tables.jobs = [job(1)]
    errors.add('service_quotes')
    const page = await loadCustomerServices(session, {}, now)
    expect(page.items[0].jobId).toBe(id(2, 1))
    expect(page.unavailableSections).toContain('presupuestos')
  })

  it('keeps checkout failure distinguishable from an unpaid service', async () => {
    tables.service_requests = [request(1)]
    tables.jobs = [job(1, 'confirmed')]
    errors.add('marketplace_checkouts')
    const page = await loadCustomerServices(session, { source: 'services' }, now)
    expect(page.items[0].statusLabel).toBe('Estado del pago por consultar')
    expect(page.unavailableSections).toContain('pagos')
  })

  it('does not silently project a request as jobless when its related jobs cannot be read', async () => {
    tables.service_requests = [request(1)]
    tables.jobs = [job(1)]
    tables.service_quotes = [quote(1)]
    errors.add('jobs')
    const page = await loadCustomerServices(session, {}, now)
    expect(page.items.map((item) => item.id)).toEqual([`quote:${id(3, 1)}`])
    expect(page.unavailableSections).toContain('servicios')
  })

  it.each([{ pageSize: 101 }, { pageSize: 0 }, { filter: 'bad' }, { source: 'bad' }])('rejects invalid controls %j', async (input) => {
    await expect(loadCustomerServices(session, input as never, now)).rejects.toThrow()
    expect(calls).toEqual([])
  })
})
