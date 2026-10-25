import { describe, expect, it, vi } from 'vitest'
import type { Session } from '@/lib/auth/session'
import { readAdminRequests, saveAdminRequest } from '@/lib/admin/service-request-service'
import { throwPricingDatabaseError } from '@/lib/pricing/server'

function session(permissions: Session['permissions'], role: Session['role'] = 'admin', aal = 'aal2') {
  const rpc = vi.fn().mockResolvedValue({ data: { items: [], total: 0 }, error: null })
  return { role, permissions, assuranceLevel: aal, profileId: '00000000-0000-4000-8000-000000000001', client: { rpc } } as unknown as Session
}
describe('administrative request authorization', () => {
  it('explains when a technician is unavailable instead of losing the request details', () => {
    try { throwPricingDatabaseError({ code: '22023', message: 'professional_ineligible_or_unavailable' }) }
    catch (error) { expect(error).toMatchObject({ code: 'professional_unavailable' }); return }
    throw new Error('Expected an actionable assignment error')
  })
  it.each([['operations'], ['finance'], []].map(permissions => ({ permissions })))('requires both financial and operational authority', async ({ permissions }) => {
    const actor = session(permissions as Session['permissions'])
    await expect(readAdminRequests(actor)).rejects.toMatchObject({ code: 'forbidden' })
    expect(actor.client.rpc).not.toHaveBeenCalled()
  })
  it('lets the owner list drafts without accepting or paying for the customer', async () => {
    const actor = session(['owner'])
    expect(await readAdminRequests(actor)).toEqual({ items: [], total: 0, nextCursor: null })
    expect(actor.client.rpc).toHaveBeenCalledWith('read_admin_service_requests', expect.objectContaining({ p_id: undefined, p_limit: 25 }))
  })
  it('keeps older drafts reachable using a cursor at the last visible update', async () => {
    const actor = session(['owner'])
    const rows = Array.from({ length: 26 }, (_, i) => ({ id: `00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`, updatedAt: '2026-10-25T12:00:00Z' }))
    vi.mocked(actor.client.rpc).mockResolvedValue({ data: { items: rows, total: 75 }, error: null } as never)
    const first = await readAdminRequests(actor)
    expect(first.items).toHaveLength(25)
    expect(first.total).toBe(75)
    expect(first.nextCursor).toEqual(expect.any(String))
    await readAdminRequests(actor, undefined, { cursor: first.nextCursor! })
    expect(actor.client.rpc).toHaveBeenLastCalledWith('read_admin_service_requests', expect.objectContaining({
      p_cursor_at: rows[24].updatedAt, p_cursor_id: rows[24].id
    }))
  })
  it('rejects malformed financial input before calling the database', async () => {
    const actor = session(['owner'])
    await expect(saveAdminRequest(actor, { total: 1, platformFee: 1 })).rejects.toThrow()
    expect(actor.client.rpc).not.toHaveBeenCalled()
  })
  it('denies roles and weak sessions even with claimed permission names', async () => {
    await expect(readAdminRequests(session(['owner'], 'customer'))).rejects.toThrow()
    await expect(readAdminRequests(session(['owner'], 'admin', 'aal1'))).rejects.toThrow()
  })
  it('reports concurrency conflicts without announcing a save', async () => {
    const actor = session(['owner'])
    vi.mocked(actor.client.rpc).mockResolvedValue({ data: null, error: { code: '40001', message: 'draft_version_conflict' } } as never)
    await expect(readAdminRequests(actor)).rejects.toMatchObject({ code: 'conflict' })
  })
})
