import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { loadReadPage, mapReadPage } from '@/lib/data-access/read-state'
import { createCustomerQueries } from '@/lib/data-access/customer-queries'
describe('read errors and presentation boundaries', () => {
  it('does not turn a database error into an empty success or expose provider internals', async () => {
    const result = await loadReadPage(async () => {
      throw Error('PRIVATE database credentials')
    })
    expect(result).toEqual({
      state: 'error',
      message: 'No pudimos cargar los datos. Intentá nuevamente.',
      retryable: true
    })
  })
  it('preserves the total and navigation independently of the displayed page length', () => {
    expect(
      mapReadPage({ items: [{ id: 'a' }], total: 137, nextCursor: 'next' }, (row) => row.id)
    ).toEqual({ items: ['a'], total: 137, nextCursor: 'next' })
  })
  it('distinguishes a truly empty collection from an exhausted cursor', async () => {
    expect(await loadReadPage(async () => ({ items: [], total: 0, nextCursor: null }))).toEqual({
      state: 'empty'
    })
    expect(
      await loadReadPage(async () => ({ items: [], total: 137, nextCursor: null }))
    ).toMatchObject({ state: 'ready', data: { total: 137 } })
  })
  it.each([
    { data: null, error: { message: 'PRIVATE' } },
    { data: [{ id: 'invalid-row' }], error: null }
  ])('rejects failed or malformed database results', async (result) => {
    const query = {
      select() {
        return this
      },
      filter() {
        return this
      },
      order() {
        return this
      },
      limit() {
        return this
      },
      then(resolve: (value: unknown) => unknown) {
        return Promise.resolve(resolve({ ...result, count: 1 }))
      }
    }
    const client = {
      auth: {
        getUser: async () => ({
          data: { user: { app_metadata: { app_role: 'customer' } } },
          error: null
        })
      },
      rpc: async () => ({
        data: {
          profile_id: '10000000-0000-4000-8000-000000000001',
          customer_id: '10000000-0000-4000-8000-000000000002',
          professional_id: null,
          professional_status: null,
          professional_eligible: false,
          role: 'customer',
          permissions: [],
          session_active: true,
          aal: 'aal1'
        },
        error: null
      }),
      from: () => query
    } as unknown as SupabaseClient<Database>
    await expect(createCustomerQueries(client).list('requests')).rejects.toMatchObject({
      code: 'unavailable'
    })
  })
})
