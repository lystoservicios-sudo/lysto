import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@/lib/auth/session'
import { readProfessionalJobContext } from '@/lib/professional/job-context'
import { professionalJobContextSchema } from '@/lib/professional/job-context-contract'
import { GET } from '@/app/api/pro/jobs/context/route'

const state = vi.hoisted(() => ({ role: 'professional', status: 'approved', eligible: true, rpc: vi.fn() }))
vi.mock('@/lib/auth/session', async (importActual) => ({
  ...await importActual<typeof import('@/lib/auth/session')>(),
  requireSession: async () => ({ role: state.role, professionalId: id(2), professionalStatus: state.status, professionalEligible: state.eligible, client: { rpc: state.rpc } })
}))
vi.mock('@/lib/observability/logger', () => ({ logEvent: vi.fn() }))
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const context = () => ({ jobId: id(1), issueLabel: 'Pierde agua', reportedProblem: 'Gotea al enfriar', accessInstructions: null, equipment: null, history: [], home: null, initialPaymentStatus: null, extraPayments: [], requestPhotoIds: [] })
const session = (patch: Partial<Session> = {}) => ({ role: 'professional', professionalId: id(2), professionalStatus: 'approved', professionalEligible: true, client: { rpc: state.rpc }, ...patch }) as Session
beforeEach(() => {
  state.role = 'professional'; state.status = 'approved'; state.eligible = true
  state.rpc.mockReset().mockResolvedValue({ data: context(), error: null })
})
describe('professional assigned job read context', () => {
  it('reads the actor-bound RPC without passing a customer or technician identity', async () => {
    expect(await readProfessionalJobContext(session(), id(1))).toEqual(context())
    expect(state.rpc).toHaveBeenCalledTimes(1)
    expect(state.rpc).toHaveBeenCalledWith('read_professional_job_context', { p_job_id: id(1) })
  })
  it('does not invent a home, equipment or approved initial payment for legacy jobs', async () => {
    expect(await readProfessionalJobContext(session(), id(1))).toMatchObject({ home: null, equipment: null, initialPaymentStatus: null, extraPayments: [] })
  })
  it.each([{ role: 'customer' }, { professionalId: undefined }, { professionalStatus: 'suspended' }, { professionalEligible: false }] as Partial<Session>[])('rejects invalid operational authority %j before RPC', async (patch) => {
    await expect(readProfessionalJobContext(session(patch), id(1))).rejects.toMatchObject({ code: 'forbidden' })
    expect(state.rpc).not.toHaveBeenCalled()
  })
  it('rejects malformed job IDs before RPC', async () => {
    await expect(readProfessionalJobContext(session(), 'not-a-uuid')).rejects.toMatchObject({ code: 'invalid_input' })
    expect(state.rpc).not.toHaveBeenCalled()
  })
  it.each([['42501', 'forbidden'], ['P0002', 'not_found'], ['XX000', 'service_unavailable']])('maps database %s without disclosing a different assignment', async (code, expected) => {
    state.rpc.mockResolvedValue({ data: null, error: { code } })
    await expect(readProfessionalJobContext(session(), id(1))).rejects.toMatchObject({ code: expected })
  })
  it.each([null, { ...context(), unexpectedInventory: [] }, { ...context(), jobId: id(9) }, { ...context(), initialPaymentStatus: 'unknown' }])('fails closed on an invalid or mismatched snapshot', async (data) => {
    state.rpc.mockResolvedValue({ data, error: null })
    await expect(readProfessionalJobContext(session(), id(1))).rejects.toMatchObject({ code: 'service_unavailable' })
  })
  it('keeps approval of extra scope separate from the extra payment status', () => {
    const value = { ...context(), initialPaymentStatus: 'approved', extraPayments: [{ extraId: id(3), status: 'pending' }] }
    expect(professionalJobContextSchema.parse(value)).toEqual(value)
  })
  it('defaults missing request photos to an empty list and accepts only attachment UUIDs', () => {
    const legacy = { ...context(), requestPhotoIds: undefined }
    expect(professionalJobContextSchema.parse(legacy)).toMatchObject({ requestPhotoIds: [] })
    expect(professionalJobContextSchema.safeParse({ ...context(), requestPhotoIds: ['https://example.test/private-image'] }).success).toBe(false)
    expect(professionalJobContextSchema.parse({ ...context(), requestPhotoIds: [id(10)] }).requestPhotoIds).toEqual([id(10)])
  })
})
describe('professional job context HTTP boundary', () => {
  it('returns the real context in a private no-store response', async () => {
    const response = await GET(new Request(`http://localhost/api/pro/jobs/context?jobId=${id(1)}`))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(await response.json()).toEqual({ context: context() })
  })
  it.each(['', '?jobId=invalid', `?jobId=${id(1)}&jobId=${id(9)}`, `?jobId=${id(1)}&customerId=${id(8)}`])('rejects missing, duplicate, invalid or authority query parameters: %s', async (query) => {
    const response = await GET(new Request(`http://localhost/api/pro/jobs/context${query}`))
    expect(response.status).toBe(400)
    expect(state.rpc).not.toHaveBeenCalled()
  })
  it('rejects a non-professional session before reading job data', async () => {
    state.role = 'customer'
    const response = await GET(new Request(`http://localhost/api/pro/jobs/context?jobId=${id(1)}`))
    expect(response.status).toBe(403)
    expect(state.rpc).not.toHaveBeenCalled()
  })
})
