import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@/lib/auth/session'
import { writeCustomerAsset } from '@/lib/customer-assets/service'
import { privateRequest } from '@/lib/http/private-client'

afterEach(() => vi.unstubAllGlobals())
describe('directions linked to Hogar', () => {
  it('explains why an active home direction cannot be archived', async () => {
    const session = { role: 'customer', customerId: 'owner', client: { rpc: vi.fn().mockResolvedValue({ data: null, error: { code: 'P0001', message: 'Address linked to active home' } }) } } as unknown as Session
    await expect(writeCustomerAsset(session, 'address', {}, 'address-id', 1, true)).rejects.toMatchObject({ code: 'address_has_home', status: 409 })
  })
  it('keeps unknown database errors fail-closed instead of exposing their details', async () => {
    const session = { role: 'customer', customerId: 'owner', client: { rpc: vi.fn().mockResolvedValue({ data: null, error: { code: 'P0001', message: 'Other internal error' } }) } } as unknown as Session
    await expect(writeCustomerAsset(session, 'address', {}, 'address-id', 1, true)).rejects.toMatchObject({ code: 'service_unavailable' })
  })
  it('shows the actionable archive dependency in the existing direction manager', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ code: 'address_has_home' }) }))
    await expect(privateRequest('/api/customer/addresses', 'DELETE', {})).rejects.toThrow('Esta dirección está vinculada a un hogar. Archivá ese hogar antes de quitarla.')
  })
})
