// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import { saveProfessionalAddress } from '@/lib/professional/onboarding-service'
import { privateRequest } from '@/lib/http/private-client'

const mocks = vi.hoisted(() => ({ verify: vi.fn() }))
vi.mock('@/lib/location/proof', () => ({ verifyFormattedLocationProof: mocks.verify }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => ({ auth: { getUser: async () => ({ data: { user: { email_confirmed_at: '2026-01-01T00:00:00Z' } }, error: null }) } }) }))
afterEach(() => vi.unstubAllGlobals())

it('explains a typed but unconfirmed address before attempting persistence', async () => {
  mocks.verify.mockImplementation(() => { throw new Error('location_proof_invalid') })
  await expect(saveProfessionalAddress({ address: 'Calle 23 5871', locationProof: '', expectedVersion: 4 }))
    .rejects.toMatchObject({ code: 'location_selection_required', status: 400 })
  expect(mocks.verify).not.toHaveBeenCalled()
})

it('shows the address selection instruction instead of a generic validation error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'location_selection_required' }), { status: 400 })))
  await expect(privateRequest('/api/professional/onboarding/address', 'POST', {}))
    .rejects.toMatchObject({ status: 400, message: expect.stringContaining('Seleccioná una dirección de la lista') })
})
