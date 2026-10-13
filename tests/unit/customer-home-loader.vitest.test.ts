// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Session } from '@/lib/auth/session'

const mocks = vi.hoisted(() => ({
  profile: vi.fn(), addresses: vi.fn(), equipment: vi.fn(), requests: vi.fn(),
  jobs: vi.fn(), completedJob: vi.fn(), maintenance: vi.fn(), support: vi.fn()
}))
vi.mock('@/lib/customer-assets/service', () => ({
  readCustomerProfile: mocks.profile,
  listCustomerAddresses: mocks.addresses,
  listCustomerEquipment: mocks.equipment
}))
vi.mock('@/lib/customer/live-model', () => ({
  listCustomerRequestsLive: mocks.requests,
  listCustomerJobsLive: mocks.jobs,
  listLastCompletedCustomerJobLive: mocks.completedJob
}))
vi.mock('@/lib/equipment/maintenance-service', () => ({ listMaintenance: mocks.maintenance }))
vi.mock('@/lib/support/service', () => ({ listSupportCases: mocks.support }))

import { loadCustomerHome } from '@/lib/customer/home-model'

const now = '2026-10-12T15:00:00.000Z'
const equipment = {
  id: 'equipment-living', nickname: 'Aire del living', addressId: null,
  equipmentType: 'split', brand: 'Marca registrada', model: null, serialNumber: null,
  frigorias: null, version: 1, createdAt: now, archivedAt: null
}
const completedJob = {
  id: 'job-completed', requestId: 'request-completed', equipmentId: equipment.id,
  status: 'completed', statusView: { label: 'Completado', tone: 'success' },
  issueLabel: 'Mantenimiento', address: 'Dirección registrada', scheduledAt: '2026-10-01',
  timeWindow: 'Horario registrado', amount: 40000, finalAmount: 40000,
  nextStep: 'Consultar el servicio', canReview: true, completedAt: '2026-10-10T18:00:00.000Z'
}
const from = vi.fn((table: string) => {
  if (!['service_quotes', 'marketplace_checkouts'].includes(table)) {
    throw new Error(`Unexpected home query: ${table}`)
  }
  const query = {
    select: vi.fn(() => query), eq: vi.fn(() => query), order: vi.fn(() => query),
    limit: vi.fn(async () => ({ data: [], error: null }))
  }
  return query
})
const session = {
  client: { from }, userId: 'user-owner', profileId: 'profile-owner',
  customerId: 'customer-owner', role: 'customer', permissions: [],
  sessionId: 'session-owner', assuranceLevel: 'aal1'
} as unknown as Session

beforeEach(() => {
  vi.clearAllMocks()
  mocks.profile.mockResolvedValue({ id: session.profileId, firstName: 'Cliente' })
  mocks.addresses.mockResolvedValue({ items: [], total: 1, nextCursor: null })
  mocks.equipment.mockResolvedValue({ items: [equipment], total: 1, nextCursor: null })
  mocks.requests.mockResolvedValue({ items: [], total: 0, nextCursor: null })
  mocks.jobs.mockResolvedValue({ items: [], total: 0, nextCursor: null })
  mocks.completedJob.mockResolvedValue(completedJob)
  mocks.maintenance.mockResolvedValue([])
  mocks.support.mockResolvedValue([])
})

describe('customer home loader summaries', () => {
  it('loads a separate completed page for the same authorized customer', async () => {
    const model = await loadCustomerHome(session, now)

    expect(mocks.completedJob).toHaveBeenCalledWith(session)
    expect(model.lastService).toMatchObject({
      id: completedJob.id, equipmentName: equipment.nickname,
      completedAt: completedJob.completedAt,
      action: { href: `/app/trabajos/${completedJob.id}` }
    })
    expect(model.household).toMatchObject({ id: equipment.id, title: equipment.nickname })
    expect(from.mock.calls.every(([table]) => table !== 'job_final_reports')).toBe(true)
  })

  it('uses the already loaded equipment to name an active job', async () => {
    mocks.jobs.mockResolvedValue({
      items: [{ ...completedJob, status: 'technician_on_way' }], total: 1, nextCursor: null
    })
    mocks.completedJob.mockResolvedValue(null)
    const model = await loadCustomerHome(session, now)
    expect(model.activity[0].subject).toBe(equipment.nickname)
  })

  it('keeps existing summaries and decisions usable when completed history fails', async () => {
    mocks.completedJob.mockRejectedValue(new Error('temporarily unavailable'))
    mocks.jobs.mockResolvedValue({ items: [{ ...completedJob, status: 'waiting_customer_approval' }], total: 1, nextCursor: null })
    const model = await loadCustomerHome(session, now)
    expect(model.activity[0].kind).toBe('decision')
    expect(model.household?.title).toBe(equipment.nickname)
    expect(model.lastService).toBeNull()
    expect(model.unavailableSections).toContain('historial')
  })

  it('loads multiple owned equipment records for active care and the last completed service', async () => {
    const bedroom = { ...equipment, id: 'equipment-bedroom', nickname: 'Aire del dormitorio' }
    mocks.equipment.mockImplementation(async (_session, input) => ({
      items: input.pageSize === 100 ? [equipment, bedroom] : [equipment],
      total: 2, nextCursor: null
    }))
    mocks.jobs.mockResolvedValue({
      items: [{ ...completedJob, equipmentId: bedroom.id, status: 'technician_on_way' }],
      total: 1, nextCursor: null
    })
    mocks.completedJob.mockResolvedValue({ ...completedJob, equipmentId: bedroom.id })
    mocks.maintenance.mockResolvedValue([{
      id: 'maintenance-bedroom', equipmentId: bedroom.id, equipmentName: 'Nombre anterior del equipo',
      recommendation: 'filters_60_days', dueAt: '2026-10-20', status: 'planned',
      version: 1, sourceJobId: null, history: []
    }])

    const model = await loadCustomerHome(session, now)

    expect(mocks.equipment).toHaveBeenCalledWith(session, { pageSize: 100 })
    expect(model.activity.find((item) => item.kind === 'progress')?.subject).toBe(bedroom.nickname)
    expect(model.household).toMatchObject({
      id: bedroom.id, title: bedroom.nickname, maintenanceId: 'maintenance-bedroom'
    })
    expect(model.lastService?.equipmentName).toBe(bedroom.nickname)
    expect(model.setupInvite).toBeNull()
  })
})
