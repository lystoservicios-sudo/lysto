import { describe, expect, it, vi } from 'vitest'
import type { Session } from '@/lib/auth/session'
import { readCustomerHomes, writeCustomerHome } from '@/lib/customer-homes/service'
import { writeCustomerAsset } from '@/lib/customer-assets/service'
import { createCustomerRequestService } from '@/lib/customer-requests/service'
import { throwPricingDatabaseError } from '@/lib/pricing/server'
import { ApiError, apiErrorResponse } from '@/lib/http/api-error'

const id = '20000000-0000-4000-8000-000000000001'
const input = {
  equipmentId: id, expectedEquipmentVersion: 1, addressId: id,
  issue: 'no_enfria', preferredDate: '2026-10-15', timeWindow: '10:00 – 12:00', urgency: 'flexible'
}

function boundaries(code: string) {
  // Only the database transport is injected. Service authorization, validation,
  // error translation and the HTTP error response stay real.
  const response = { data: null, error: { code, message: 'Database details must stay private' } }
  const rpc = vi.fn().mockResolvedValue(response)
  const session = {
    role: 'customer', customerId: id, userId: id, profileId: id, sessionId: id,
    client: { rpc }, permissions: [], assuranceLevel: 'aal1'
  } as unknown as Session
  const service = createCustomerRequestService({
    write: rpc,
    travel: async () => { throw new Error('Routing must not run after an RPC error') },
    seller: async () => { throw new Error('Seller calls must not run after an RPC error') },
    mode: () => false,
    now: () => new Date('2026-10-13T12:00:00Z')
  })
  return {
    'Hogar read': () => readCustomerHomes(session),
    'Hogar write': () => writeCustomerHome(session, 'save', {}, id, 1),
    'Customer asset write': () => writeCustomerAsset(session, 'equipment', {}, id, 1),
    'Pedir preview': () => service.preview(session, input),
    'Pedir prepare': () => service.prepare(session, { previewId: id, commandId: id }),
    'Pricing mapping': async () => throwPricingDatabaseError(response.error)
  }
}

const names = Object.keys(boundaries('PT409')) as (keyof ReturnType<typeof boundaries>)[]

describe('RPC business-conflict compatibility', () => {
  it.each(names.flatMap(name => ['PT409', '40001', '23505'].map(code => [name, code] as const)))
    ('%s keeps %s as a private HTTP 409 conflict', async (name, code) => {
      const operation = boundaries(code)[name]
      const error = await operation().then(() => null, caught => caught)
      expect(error).toBeInstanceOf(ApiError)
      expect(error).toMatchObject({ code: 'conflict', status: 409 })
      const response = apiErrorResponse(error)
      expect(response.status).toBe(409)
      expect(response.headers.get('Cache-Control')).toContain('no-store')
      expect(await response.json()).toEqual({
        code: 'conflict', error: 'Los datos cambiaron. Recargá la información antes de volver a guardar.'
      })
    })

  it.each(['Pedir preview', 'Pedir prepare'] as const)
    ('%s preserves the exclusion-constraint conflict code', async name => {
      await expect(boundaries('23P01')[name]()).rejects.toMatchObject({ code: 'conflict', status: 409 })
    })

  it.each(names.flatMap(name => [
    ['42501', 'forbidden'], ['P0002', 'not_found'],
    ['22023', 'invalid_input'], ['XX000', 'service_unavailable']
  ].map(([code, expected]) => [name, code, expected] as const)))
    ('%s preserves %s as %s', async (name, code, expected) => {
      await expect(boundaries(code)[name]()).rejects.toMatchObject({ code: expected })
    })
})
