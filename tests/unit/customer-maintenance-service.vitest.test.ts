// @vitest-environment node
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import type { Session } from '@/lib/auth/session'
import { listMaintenance, manageMaintenance } from '@/lib/equipment/maintenance-service'

const owner = '10000000-0000-4000-8000-000000000001'
const equipmentId = '10000000-0000-4000-8000-000000000002'
const sourceJobId = '10000000-0000-4000-8000-000000000003'
const plan = { id: '10000000-0000-4000-8000-000000000004', equipmentId,
  equipmentName: 'Aire del living', recommendation: 'filters_60_days', dueAt: '2026-11-14',
  status: 'planned', version: 4, sourceJobId,
  history: [{ id: '10000000-0000-4000-8000-000000000005', jobId: sourceJobId,
    performedAt: '2026-09-14T15:00:00Z', diagnosis: 'Filtros sucios', workDone: 'Limpieza', professionalId: null }] }
function job(index: number, status = 'confirmed', requestStatus = 'assigned') {
  return { id: `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`, status,
    created_at: '2026-10-15T15:00:00Z', service_requests: { customer_id: owner,
      equipment_id: equipmentId, status: requestStatus, contract_source: 'automatic_customer_request' as string | null } }
}
function fixture(jobs: ReturnType<typeof job>[][], plans = [plan], unavailable = false) {
  const urls: URL[] = []
  const client = createClient('https://example.supabase.co', 'public-anon-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input) => {
      const url = new URL(String(input)); urls.push(url)
      if (url.pathname.endsWith('/rpc/list_customer_maintenance')) return Response.json(plans)
      if (url.pathname.endsWith('/rpc/manage_maintenance_plan')) return Response.json({
        id: plan.id, status: 'deferred', dueAt: '2099-01-01', version: 5,
        requestId: null, reservationCreated: false, paymentCreated: false
      })
      if (url.pathname.endsWith('/jobs')) return unavailable
        ? Response.json({ message: 'Unavailable' }, { status: 401 })
        : Response.json(jobs.shift() ?? [])
      throw new Error(`Unexpected query ${url.pathname}`)
    } }
  })
  return { session: { client, customerId: owner, role: 'customer' } as unknown as Session, urls }
}

describe('maintenance authenticated projection', () => {
  it('finds the canonical active service for the owned equipment and scopes both relations', async () => {
    const { session, urls } = fixture([[job(1)]])
    const [result] = await listMaintenance(session)
    expect(result).toMatchObject({ activeJobId: job(1).id, contextVerified: true, superseded: false })
    const query = urls.find((url) => url.pathname.endsWith('/jobs'))!
    expect(query.searchParams.get('select')).toContain('service_requests!jobs_request_id_fkey!inner(')
    expect(query.searchParams.get('customer_id')).toBe(`eq.${owner}`)
    expect(query.searchParams.get('service_requests.customer_id')).toBe(`eq.${owner}`)
  })
  it.each(['completed', 'cancelled_by_customer', 'cancelled_by_professional', 'cancelled_by_admin'])('does not mistake %s for a current service', async (status) => {
    const { session } = fixture([[job(1, status)]])
    expect((await listMaintenance(session))[0]).toMatchObject({ activeJobId: null, contextVerified: true })
  })
  it.each(['cancelled', 'expired'])('ignores a service whose request is %s', async (status) => {
    const { session } = fixture([[job(1, 'confirmed', status)]])
    expect((await listMaintenance(session))[0].activeJobId).toBeNull()
  })
  it('retains a legacy active job when only its old request expired', async () => {
    const active = job(1, 'confirmed', 'expired')
    const { session } = fixture([[{ ...active,
      service_requests: { ...active.service_requests, contract_source: null } }]])
    expect((await listMaintenance(session))[0].activeJobId).toBe(active.id)
  })
  it('defers a valid current plan with its real optimistic version', async () => {
    const { session, urls } = fixture([[]])
    await expect(manageMaintenance(session, { planId: plan.id, action: 'defer',
      expectedVersion: 4, dueDate: '2099-01-01' })).resolves.toMatchObject({
      status: 'deferred', version: 5, reservationCreated: false, paymentCreated: false
    })
    expect(urls.filter((url) => url.pathname.endsWith('/rpc/manage_maintenance_plan'))).toHaveLength(1)
  })
  it('scans subsequent pages rather than silently assuming no service after the first batch', async () => {
    const first = Array.from({ length: 200 }, (_, index) => ({ ...job(400 - index),
      service_requests: { ...job(1).service_requests, equipment_id: '30000000-0000-4000-8000-000000000001' } }))
    const { session, urls } = fixture([first, [job(200)]])
    expect((await listMaintenance(session))[0].activeJobId).toBe(job(200).id)
    expect(urls.filter((url) => url.pathname.endsWith('/jobs'))).toHaveLength(3)
  })
  it('keeps history available but fails closed when current service context cannot be verified', async () => {
    const { session } = fixture([], [plan], true)
    expect((await listMaintenance(session))[0]).toMatchObject({ contextVerified: false, activeJobId: null, history: plan.history })
  })
  it('marks an older plan obsolete when a later recorded service replaced its source', async () => {
    const newer = { ...plan.history[0], id: '40000000-0000-4000-8000-000000000001',
      jobId: '40000000-0000-4000-8000-000000000002', performedAt: '2026-10-15T15:00:00Z' }
    const { session } = fixture([[]], [{ ...plan, history: [newer, ...plan.history] }])
    expect((await listMaintenance(session))[0].superseded).toBe(true)
  })
  it.each(['completed', 'cancelled', 'suppressed_by_case'])('rejects defer for a %s plan before invoking its mutation', async (status) => {
    const { session, urls } = fixture([[]], [{ ...plan, status }])
    await expect(manageMaintenance(session, { planId: plan.id, action: 'defer',
      expectedVersion: 4, dueDate: '2099-01-01' })).rejects.toMatchObject({ code: 'conflict' })
    expect(urls.some((url) => url.pathname.endsWith('/rpc/manage_maintenance_plan'))).toBe(false)
  })
})
