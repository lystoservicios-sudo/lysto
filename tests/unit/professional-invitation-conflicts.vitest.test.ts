import { afterEach, expect, it, vi } from 'vitest'
import { privateRequest } from '@/lib/http/private-client'

afterEach(() => vi.unstubAllGlobals())

it.each([
  ['professional_invitation_exists', 'Ya existe una invitación para este correo'],
  ['professional_account_exists', 'Este correo ya tiene una cuenta']
])('shows a specific explanation for %s', async (code, message) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code }), { status: 409 })))
  await expect(privateRequest('/api/admin/invite-professional', 'POST', {}))
    .rejects.toMatchObject({ status: 409, code, message: expect.stringContaining(message) })
})
