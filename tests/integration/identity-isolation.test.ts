import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { accountNames, createFixtureAccounts } from './fixtures'

describe('real Auth identities and RLS', () => {
  let fixture: Awaited<ReturnType<typeof createFixtureAccounts>>
  let pending: ReturnType<typeof createFixtureAccounts> | undefined
  beforeAll(async () => { pending = createFixtureAccounts(); fixture = await pending })
  // Cleanup is available before setup resolves and cancels pending operations.
  afterAll(async () => { await pending?.cleanup() })
  it('obtains eight distinct real user sessions', async () => {
    expect(new Set(Object.values(fixture.accounts).map(a => a.authId)).size).toBe(8)
    for (const name of accountNames) {
      const account = fixture.accounts[name]
      const { data, error } = await account.client.auth.getUser()
      expect(error).toBeNull()
      expect(data.user?.id).toBe(account.authId)
      expect(data.user?.app_metadata.app_role).toBe(name.startsWith('customer') ? 'customer' : name.startsWith('professional') ? 'professional' : 'admin')
    }
  })
  it('lets customer A read their address but prevents customer B reading it', async () => {
    const { customerA: a, customerB: b } = fixture.accounts
    const own = await a.client.from('customer_addresses').select('id').eq('customer_id', a.entityId)
    expect(own.error).toBeNull()
    expect(own.data).toHaveLength(1)
    const foreign = await b.client.from('customer_addresses').select('id').eq('customer_id', a.entityId)
    expect(foreign.error).toBeNull()
    expect(foreign.data).toEqual([])
  })
  it('denies user JWTs direct access to OAuth credentials', async () => {
    for (const name of ['customerA', 'professionalApproved', 'owner'] as const) {
      const { error } = await fixture.accounts[name].client.from('mp_split_connected_accounts').select('seller_id')
      expect(error?.code).toBe('42501')
    }
  })
})
