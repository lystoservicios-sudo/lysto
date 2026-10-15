// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Session } from '@/lib/auth/session'
import type { Database } from '@/lib/supabase/database.types'

const mocks = vi.hoisted(() => ({ list: vi.fn(), addresses: vi.fn() }))
vi.mock('@/lib/data-access/customer-queries', () => ({ createCustomerQueries: () => ({ list: mocks.list }) }))
vi.mock('@/lib/data-access/professional-queries', () => ({ createProfessionalQueries: () => ({ list: mocks.list }) }))
vi.mock('@/lib/customer-assets/service', () => ({ listCustomerAddresses: mocks.addresses, listCustomerEquipment: vi.fn(), readCustomerProfile: vi.fn() }))
vi.mock('@/lib/equipment/maintenance-service', () => ({ listMaintenance: vi.fn() }))
import { listCustomerJobsLive, listCustomerRequestsLive } from '@/lib/customer/live-model'
import { listProfessionalJobsLive } from '@/lib/professional/live-model'
import { createSessionReadRepository } from '@/lib/data-access/supabase/read-repository'

const id = '10000000-0000-4000-8000-000000000001'
const jobId = '20000000-0000-4000-8000-000000000001'
const owner = '90000000-0000-4000-8000-000000000001'
const createdAt = '2026-10-14T12:00:00Z'
const snapshot = { id, street: 'Corrientes', number: '999', city: 'CABA', floor: '5', apartment: 'A' }
const job = { id: jobId, requestId: id, status: 'confirmed', createdAt, professionalId: owner,
  scheduledDate: '2026-10-16', timeWindow: '14:00-18:00', completedAt: null, finalAmount: 40000 }
let request: Record<string, unknown>
const selections: Array<{ table: string; columns: string }> = []
const filters: Array<{ table: string; column: string; value: unknown }> = []
const client = {
  auth: { getUser: async () => ({ data: { user: { app_metadata: { app_role: 'customer' } } }, error: null }) },
  rpc: async () => ({ data: { profile_id: owner, role: 'customer', customer_id: owner, professional_id: null,
    professional_status: null, permissions: [], session_active: true, aal: 'aal1' }, error: null }),
  from(table: string) {
    const rows = () => table === 'service_requests' ? [request] : table === 'service_issue_types'
      ? [{ id, name: 'Pierde agua', slug: 'pierde_agua' }] : table === 'customer_addresses'
        ? [{ id, street: 'Viejo domicilio', number: '100', city: 'CABA' }] : []
    const query = {
      select(columns: string) { selections.push({ table, columns }); return query },
      eq(column: string, value: unknown) { filters.push({ table, column, value }); return query },
      in: () => query,
      maybeSingle: async () => ({ data: rows()[0], error: null }),
      then: (resolve: (result: { data: unknown[]; error: null }) => unknown) => Promise.resolve(resolve({ data: rows(), error: null }))
    }
    return query
  }
}
const session = { client, role: 'customer', customerId: owner, profileId: owner } as unknown as Session
beforeEach(() => {
  selections.length = 0; filters.length = 0
  request = { id, created_at: createdAt, status: 'pending_payment', issue_type_id: id, address_id: id, equipment_id: id,
    preferred_date: '2026-10-16', preferred_time_window: '14:00-18:00', urgency_level: 'flexible',
    contract_source: 'automatic_customer_request', visit_address_snapshot: snapshot }
  mocks.list.mockResolvedValue({ items: [job], total: 1, nextCursor: null })
  mocks.addresses.mockResolvedValue({ items: [{ id, street: 'Viejo domicilio', number: '100', city: 'CABA' }], total: 1, nextCursor: null })
})

describe('contracted visit read adapters', () => {
  it('carries only the explicit visit metadata through the authorized request DTO', async () => {
    const dto = await createSessionReadRepository(client as unknown as SupabaseClient<Database>, 'customer').detail('requests', id)
    expect(dto).toMatchObject({ addressId: id, contractSource: 'automatic_customer_request', visitAddressSnapshot: snapshot })
    expect(selections[0].columns).toContain('visit_address_snapshot')
    expect(selections[0].columns).not.toContain('context_snapshot')
  })

  it('uses the immutable visit destination in client job summaries', async () => {
    const page = await listCustomerJobsLive(session)
    expect(page.items[0].address).toBe('Corrientes 999, Piso 5 Depto. A, CABA')
    expect(page.items[0]).toMatchObject({ contractSource: 'automatic_customer_request', requestStatus: 'pending_payment', createdAt })
    expect(filters).toContainEqual({ table: 'service_requests', column: 'customer_id', value: owner })
  })

  it('uses the immutable visit destination in client request summaries', async () => {
    mocks.list.mockResolvedValue({ items: [{ id, createdAt, status: 'pending_payment', issueTypeId: id, addressId: id,
      equipmentId: id, preferredDate: '2026-10-16', preferredWindow: '14:00-18:00', urgency: 'flexible',
      contractSource: 'automatic_customer_request', visitAddressSnapshot: snapshot }], total: 1, nextCursor: null })
    expect((await listCustomerRequestsLive(session)).items[0].address).toBe('Corrientes 999, Piso 5 Depto. A, CABA')
  })

  it('uses the immutable visit destination in assigned technician summaries', async () => {
    const page = await listProfessionalJobsLive({ ...session, role: 'professional', professionalId: owner })
    expect(page.items[0].address).toBe('Corrientes 999, Piso 5 Depto. A, CABA')
    expect(page.items[0]).toMatchObject({ contractSource:'automatic_customer_request',requestStatus:'pending_payment' })
  })

  it.each([null, {}, { ...snapshot, number: 999 }])('never directs client or technician to a historical address for %j', async (invalid) => {
    request.visit_address_snapshot = invalid
    expect((await listCustomerJobsLive(session)).items[0].address).toBe('Dirección por confirmar')
    expect((await listProfessionalJobsLive({ ...session, role: 'professional', professionalId: owner })).items[0].address).toBe('Dirección por confirmar')
  })

  it('keeps expired automatic jobs closed in the display without rewriting their persisted status', async () => {
    request.status = 'expired'
    const page = await listCustomerJobsLive(session)
    expect(page.items[0]).toMatchObject({ status: 'confirmed', statusView: { label: 'Solicitud vencida', tone: 'neutral' } })
    expect(page.items[0].nextStep).not.toMatch(/pago|visita programada/i)
    expect((await listProfessionalJobsLive({ ...session, role: 'professional', professionalId: owner })).items[0].statusLabel).toBe('Solicitud vencida')
  })

  it('preserves the historical lookup for requests without automatic provenance', async () => {
    request.contract_source = null; request.visit_address_snapshot = null
    expect((await listCustomerJobsLive(session)).items[0].address).toBe('Viejo domicilio 100, CABA')
    expect((await listProfessionalJobsLive({ ...session, role: 'professional', professionalId: owner })).items[0].address).toBe('Viejo domicilio 100, CABA')
  })
})
