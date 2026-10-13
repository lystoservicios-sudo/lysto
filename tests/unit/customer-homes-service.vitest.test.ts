import { describe, expect, it, vi } from 'vitest'
import type { Session } from '@/lib/auth/session'
import { readCustomerHomes, writeCustomerHome } from '@/lib/customer-homes/service'

const id = '00000000-0000-4000-8000-000000000001'
function session(response: { data: unknown; error: { code: string } | null }, role = 'customer') {
  return { role, customerId: id, client: { rpc: vi.fn().mockResolvedValue(response) } } as unknown as Session
}
describe('Hogar authenticated service', () => {
  it('returns the real empty snapshot without demonstration data', async () => {
    const actor = session({ data: { homes: [], addresses: [], equipment: [] }, error: null })
    expect(await readCustomerHomes(actor)).toEqual({ homes: [], addresses: [], equipment: [] })
    expect(actor.client.rpc).toHaveBeenCalledWith('read_customer_homes')
  })
  it('rejects non-customer sessions before reading or writing', async () => {
    const actor = session({ data: {}, error: null }, 'professional')
    await expect(readCustomerHomes(actor)).rejects.toMatchObject({ code: 'forbidden' })
    await expect(writeCustomerHome(actor, 'archive', {}, id, 1)).rejects.toMatchObject({ code: 'forbidden' })
    expect(actor.client.rpc).not.toHaveBeenCalled()
  })
  it.each([['42501', 'forbidden'], ['P0002', 'not_found'], ['40001', 'conflict'], ['23505', 'conflict'], ['22023', 'invalid_input'], ['23514', 'invalid_input'], ['XX000', 'service_unavailable']])('translates %s to a private %s error', async (code, expected) => {
    await expect(writeCustomerHome(session({ data: null, error: { code } }), 'save', {}, id, 1)).rejects.toMatchObject({ code: expected })
  })
  it('passes only operation payload and expected version, never client authority', async () => {
    const actor = session({ data: { archived: true }, error: null })
    expect(await writeCustomerHome(actor, 'archive', {}, id, 3)).toEqual({ archived: true })
    expect(actor.client.rpc).toHaveBeenCalledWith('write_customer_home', { p_operation: 'archive', p_id: id, p_expected_version: 3, p_data: {} })
  })
  it('fails closed on malformed aggregate data', async () => {
    await expect(readCustomerHomes(session({ data: { homes: [{ customerId: id }], addresses: [], equipment: [] }, error: null }))).rejects.toMatchObject({ code: 'service_unavailable' })
  })
})
