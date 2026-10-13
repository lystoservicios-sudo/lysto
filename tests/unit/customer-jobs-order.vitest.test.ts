// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Session } from '@/lib/auth/session'
import type { JobDto } from '@/lib/data-access/read-contracts'

const mocks = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), addresses: vi.fn() }))
vi.mock('@/lib/data-access/customer-queries', () => ({
  createCustomerQueries: () => ({ list: mocks.list, detail: mocks.detail })
}))
vi.mock('@/lib/customer-assets/service', () => ({
  listCustomerAddresses: mocks.addresses,
  listCustomerEquipment: vi.fn(), readCustomerProfile: vi.fn()
}))
vi.mock('@/lib/equipment/maintenance-service', () => ({ listMaintenance: vi.fn() }))

import { listCustomerJobsLive, listLastCompletedCustomerJobLive } from '@/lib/customer/live-model'

const firstCreated: JobDto = {
  id: 'job-created-earlier', requestId: 'request-one', status: 'completed',
  createdAt: '2026-09-01T12:00:00.000Z', completedAt: '2026-10-12T18:00:00.000Z',
  professionalId: null, scheduledDate: '2026-09-03', timeWindow: null, finalAmount: 40000
}
const lastCreated: JobDto = {
  ...firstCreated, id: 'job-created-later', requestId: 'request-two',
  createdAt: '2026-10-01T12:00:00.000Z', completedAt: '2026-10-10T18:00:00.000Z'
}
const orders: Array<{ column: string; options: unknown }> = []
const filters: Array<{ column: string; value: unknown }> = []
const tables: string[] = []
const client = {
  from: vi.fn((table: string) => {
    tables.push(table)
    let orderedBy = 'created_at'
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((column: string, value: unknown) => {
        filters.push({ column, value })
        return query
      }),
      order: vi.fn((column: string, options: unknown) => {
        orders.push({ column, options })
        if (column !== 'id') orderedBy = column
        return query
      }),
      limit: vi.fn(async () => ({
        data: [{ id: orderedBy === 'completed_at' ? firstCreated.id : lastCreated.id }],
        count: 2, error: null
      })),
      in: vi.fn(async () => ({
        data: table === 'service_requests'
          ? [{ id: firstCreated.requestId, issue_type_id: 'issue', status: 'assigned', created_at: firstCreated.createdAt, address_id: null, equipment_id: null, preferred_date: null, preferred_time_window: null, urgency_level: 'flexible' },
             { id: lastCreated.requestId, issue_type_id: 'issue', status: 'assigned', created_at: lastCreated.createdAt, address_id: null, equipment_id: null, preferred_date: null, preferred_time_window: null, urgency_level: 'flexible' }]
          : [{ id: 'issue', slug: 'mantenimiento', name: 'Mantenimiento' }],
        error: null
      }))
    }
    return query
  })
}
const session = {
  client, role: 'customer', userId: 'user', profileId: 'profile', customerId: 'owner',
  permissions: [], sessionId: 'session', assuranceLevel: 'aal1'
} as unknown as Session

beforeEach(() => {
  vi.clearAllMocks()
  orders.length = 0
  filters.length = 0
  tables.length = 0
  mocks.list.mockResolvedValue({ items: [lastCreated], total: 2, nextCursor: null })
  mocks.detail.mockImplementation(async (_resource, id) =>
    id === firstCreated.id ? firstCreated : lastCreated
  )
  mocks.addresses.mockResolvedValue({ items: [], total: 0, nextCursor: null })
})

describe('customer jobs completion order', () => {
  it('selects the last real completion before applying the one-record limit', async () => {
    const job = await listLastCompletedCustomerJobLive(session)

    expect(job).toMatchObject({ id: firstCreated.id, completedAt: firstCreated.completedAt })
    expect(orders).toContainEqual({ column: 'completed_at', options: { ascending: false, nullsFirst: false } })
    expect(filters).toContainEqual({ column: 'customer_id', value: session.customerId })
    expect(filters).toContainEqual({ column: 'status', value: 'completed' })
    expect(mocks.detail).toHaveBeenCalledWith('jobs', firstCreated.id)
  })

  it('keeps the existing repository list path when no completion ordering is requested', async () => {
    const page = await listCustomerJobsLive(session, { pageSize: 25 })
    expect(page.items[0].id).toBe(lastCreated.id)
    expect(mocks.list).toHaveBeenCalledWith('jobs', { pageSize: 25 })
    expect(tables).not.toContain('jobs')
  })

  it('does not return a job whose completed status changed before the guarded detail read', async () => {
    mocks.detail.mockResolvedValue({ ...firstCreated, status: 'warranty_claim' })
    expect(await listLastCompletedCustomerJobLive(session)).toBeNull()
  })

  it('does not run an unscoped lookup when customer authority is absent', async () => {
    await expect(listLastCompletedCustomerJobLive({ ...session, customerId: undefined })).rejects.toThrow()
    expect(tables).toEqual([])
  })
})
