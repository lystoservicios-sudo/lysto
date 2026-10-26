import { expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { createSessionReadRepository } from '@/lib/data-access/supabase/read-repository'

it('reads customer payments through the safe summary RPC with scoped pagination', async () => {
  const profile = '00000000-0000-4000-8000-000000000001'
  const row = { id: '00000000-0000-4000-8000-000000000002', created_at: '2026-10-25T12:00:00Z',
    request_id: null, job_id: null, amount: 100000, status: 'approved', currency: 'ARS' }
  const from = vi.fn(() => { throw new Error('The customer must not read the internal financial projection') })
  const rpc = vi.fn(async name => ({ error: null, data: name === 'get_session_context'
    ? { profile_id: profile, role: 'customer', customer_id: profile, professional_id: null, professional_status: null,
      permissions: [], session_active: true, aal: 'aal1' }
    : { items: [row], total: 1 } }))
  const client = { from, rpc, auth: { getUser: async () => ({ error: null, data: { user: { app_metadata: { app_role: 'customer' } } } }) } } as unknown as SupabaseClient<Database>
  const result = await createSessionReadRepository(client, 'customer').list('payments', { pageSize: 25 })
  expect(result.items[0]).toMatchObject({ amount: 100000, status: 'approved' })
  expect(result.total).toBe(1)
  expect(from).not.toHaveBeenCalled()
  expect(rpc).toHaveBeenCalledWith('read_customer_payment_summaries', expect.objectContaining({ p_limit: 26 }))
})
